"""fx-signal preview dashboard (rebuilt after workspace reset).

Self-contained FastAPI app: synthetic offline data, confluence decision card,
risk ticket, paper book (seeded with the last-known real state), chart PNGs.

Endpoints:
  GET /                    dashboard page
  GET /api/symbols         symbol list
  GET /api/decision?symbol confluence verdict + ticket
  GET /api/paper           paper book (open/closed/equity/kill switch)
  GET /api/chart?symbol=&tf=  candlestick PNG (m5|h1|d1)
"""
from __future__ import annotations

import hashlib
import io
import time
from datetime import datetime, timedelta, timezone

import numpy as np
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle
from fastapi import FastAPI, Query
from fastapi.responses import HTMLResponse, JSONResponse, Response

app = FastAPI(title="fx-signal (preview)")

# ----------------------------------------------------------------------------
# symbols
# ----------------------------------------------------------------------------
SYMBOLS: dict[str, dict] = {
    "EURUSD": dict(mid=1.1800, sigma=0.00042, digits=5, pip=0.0001, pv=10.0, seed_off=8),
    "USDJPY": dict(mid=149.0, sigma=0.00050, digits=3, pip=0.01, pv=6.7, seed_off=0),
    "XAUUSD": dict(mid=2690.0, sigma=0.00090, digits=2, pip=0.10, pv=10.0, seed_off=2),
}
TF_LIST = ["m5", "h1", "d1"]
DAYS = 30


def _seed(sym: str) -> int:
    return int(hashlib.sha256(sym.encode()).hexdigest()[:8], 16)


def _gen_m5(sym: str, cfg: dict) -> dict:
    n = DAYS * 288
    rng = np.random.default_rng(_seed(sym) + cfg.get("seed_off", 0))
    sigma = cfg["sigma"]
    t = np.arange(n)
    vol_cycle = 1.0 + 0.7 * np.sin(2 * np.pi * t / (288 * 5.0) + rng.uniform(0, 6.28))
    drift = np.zeros(n)
    for _ in range(4):
        s = int(rng.integers(0, n))
        drift[s:] += rng.normal(0, sigma * 0.25)
    rets = sigma * vol_cycle * rng.normal(0, 1, n) + drift
    logp = np.cumsum(rets)
    logp -= logp[-1]  # re-anchor: last close == reference mid
    close = cfg["mid"] * np.exp(logp)
    open_ = np.roll(close, 1)
    open_[0] = close[0]
    open_ *= 1 + rng.normal(0, sigma * 0.2, n)
    hi = np.maximum(open_, close) * (1 + np.abs(rng.normal(0, sigma * 0.4, n)))
    lo = np.minimum(open_, close) * (1 - np.abs(rng.normal(0, sigma * 0.4, n)))
    hod = (t % 288) / 288 * 24
    ushape = 1.0 + 1.2 * np.exp(-(((hod - 8) / 3) ** 2)) + 1.5 * np.exp(-(((hod - 14) / 3) ** 2))
    volume = 1000 * ushape * (1 + 3 * np.abs(rets) / sigma) * rng.uniform(0.7, 1.3, n)
    end = datetime.now(timezone.utc).replace(second=0, microsecond=0, minute=int(datetime.now(timezone.utc).minute // 5) * 5)
    ts = np.datetime64(end.replace(tzinfo=None)) - (n - 1 - t) * np.timedelta64(5, "m")
    return dict(ts=ts, open=open_, high=hi, low=lo, close=close, volume=volume)


def _resample(m5: dict, k: int) -> dict:
    n = len(m5["close"]) // k
    o = m5["close"][: n * k].reshape(n, k)
    return dict(
        ts=m5["ts"][: n * k][::k],
        open=o[:, 0],
        high=m5["high"][: n * k].reshape(n, k).max(axis=1),
        low=m5["low"][: n * k].reshape(n, k).min(axis=1),
        close=o[:, -1],
        volume=m5["volume"][: n * k].reshape(n, k).sum(axis=1),
    )


# ----------------------------------------------------------------------------
# indicators (numpy)
# ----------------------------------------------------------------------------
def _ema(x: np.ndarray, span: int) -> np.ndarray:
    a = 2 / (span + 1)
    out = np.empty_like(x, dtype=float)
    out[0] = x[0]
    for i in range(1, len(x)):
        out[i] = a * x[i] + (1 - a) * out[i - 1]
    return out


def _wilder(x: np.ndarray, period: int) -> np.ndarray:
    out = np.empty(len(x))
    out[0] = x[:period].mean() if len(x) >= period else x.mean()
    for i in range(1, len(x)):
        out[i] = (out[i - 1] * (period - 1) + x[i]) / period
    return out


def _rsi(close: np.ndarray, period: int = 14) -> np.ndarray:
    d = np.diff(close)
    up = np.where(d > 0, d, 0.0)
    dn = np.where(d < 0, -d, 0.0)
    au, ad = _wilder(up, period), _wilder(dn, period)
    rs = au / np.where(ad == 0, 1e-12, ad)
    out = 100 - 100 / (1 + rs)
    return np.concatenate([[50.0], out])


def _atr(h: np.ndarray, l: np.ndarray, c: np.ndarray, period: int = 14) -> np.ndarray:
    pc = np.concatenate([[c[0]], c[:-1]])
    tr = np.maximum(h - l, np.maximum(np.abs(h - pc), np.abs(l - pc)))
    return _wilder(tr, period)


def _macd(close: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    line = _ema(close, 12) - _ema(close, 26)
    sig = _ema(line, 9)
    return line, sig, line - sig


def _swings(h: np.ndarray, l: np.ndarray, k: int = 5) -> tuple[list[int], list[int]]:
    sh: list[int] = []
    sl: list[int] = []
    for i in range(k, len(h) - k):
        if h[i] == h[i - k : i + k + 1].max():
            sh.append(i)
        if l[i] == l[i - k : i + k + 1].min():
            sl.append(i)
    return sh, sl


def _levels(h: np.ndarray, l: np.ndarray, close: float, atr: float) -> tuple[list, list]:
    sh, sl = _swings(h, l)
    idx = sh + sl
    if not idx:
        return [], []
    recent = [i for i in idx if i > len(h) - 1500] or idx[-10:]
    pts = sorted(float(h[i]) for i in recent) + [float(l[i]) for i in recent if l[i] < close < h[i]]
    pts = sorted(pts)
    tol = 0.4 * atr
    clusters: list[list] = []
    for p in pts:
        if clusters and abs(p - clusters[-1][0] / clusters[-1][1]) < tol:
            clusters[-1][0] += p
            clusters[-1][1] += 1
        else:
            clusters.append([p, 1])
    lv = sorted(((s / c, c) for s, c in clusters if c >= 2), key=lambda x: -x[1])[:6]
    support = [x for x in lv if x[0] < close]
    resistance = [x for x in lv if x[0] > close]
    return support, resistance


# ----------------------------------------------------------------------------
# decision engine (confluence scoring, rebuilt)
# ----------------------------------------------------------------------------
def _structure(h: np.ndarray, l: np.ndarray, close: float) -> dict:
    sh, sl = _swings(h, l, k=5)
    last_sh = [h[i] for i in sh[-4:]]
    last_sl = [l[i] for i in sl[-4:]]
    hh = len(last_sh) >= 2 and last_sh[-1] > last_sh[-2]
    hl = len(last_sl) >= 2 and last_sl[-1] > last_sl[-2]
    lh = len(last_sh) >= 2 and last_sh[-1] < last_sh[-2]
    ll = len(last_sl) >= 2 and last_sl[-1] < last_sl[-2]
    if hh and hl:
        regime = "uptrend"
    elif lh and ll:
        regime = "downtrend"
    else:
        regime = "range"
    break_ = None
    if sh and close > h[sh[-1]]:
        break_ = "bullish breakout above last swing high"
    elif sl and close < l[sl[-1]]:
        break_ = "bearish break below last swing low"
    return dict(regime=regime, breakout=break_, last_sh=h[sh[-1]] if sh else None, last_sl=l[sl[-1]] if sl else None)


def _session_points(hour: float) -> tuple[int, str]:
    if 12 <= hour < 16:
        return 15, "London/NY overlap"
    if 7 <= hour < 12 or 13 <= hour < 19:
        return 11, "London/NY session"
    if 0 <= hour < 6:
        return 6, "Asian session"
    return 8, "off-peak hours"


def decide(sym: str, data: dict, ts_arr: np.ndarray) -> dict:
    cfg = SYMBOLS[sym]
    close = data["close"]
    n = len(close)
    c = float(close[-1])
    e20, e50, e200 = _ema(close, 20), _ema(close, 50), _ema(close, 200)
    rsi = _rsi(close)[-1]
    atr = _atr(data["high"], data["low"], close)[-1]
    _, _, hist = _macd(close)
    macd_rising = hist[-1] > hist[-2] if n > 2 else False
    sup, res = _levels(data["high"][-1500:], data["low"][-1500:], c, float(atr))
    st = _structure(data["high"][-1500:], data["low"][-1500:], c)
    hour = float(ts_arr[-1].astype("datetime64[h]").astype(int)) % 24
    sess, sess_desc = _session_points(hour)

    # trend (±25)
    trend = 0.0
    if c > e200[-1]:
        trend += 6
    else:
        trend -= 6
    if e20[-1] > e50[-1]:
        trend += 6
    else:
        trend -= 6
    if e50[-1] > e200[-1]:
        trend += 6
    else:
        trend -= 6
    strength = min(1.0, abs(e50[-1] - e200[-1]) / (3 * atr))
    trend += (5 if trend >= 0 else -5) * strength
    trend = max(-25.0, min(25.0, trend))

    # structure (±20)
    struct = 0.0
    if st["regime"] == "uptrend":
        struct += 10
    elif st["regime"] == "downtrend":
        struct -= 10
    else:
        struct += 3 if c > (data["high"][-200:].max() + data["low"][-200:].min()) / 2 else -3
    if st["breakout"]:
        struct += 5 if st["breakout"].startswith("bullish") else -5
    struct = max(-20.0, min(20.0, struct))

    # levels (±20): buy near support / short near resistance
    lev = 0.0
    lev_note = "mid-range, no S/R bias"
    if sup:
        d_s = (c - sup[-1][0]) / atr
        if 0 <= d_s <= 1.5:
            lev += 10 * (1 - d_s / 1.5)
            lev_note = f"at support {sup[-1][0]:.{cfg['digits']}f} ({sup[-1][1]} touches)"
    if res:
        d_r = (res[0][0] - c) / atr
        if 0 <= d_r <= 1.5:
            lev -= 10 * (1 - d_r / 1.5)
            lev_note = f"at resistance {res[0][0]:.{cfg['digits']}f} ({res[0][1]} touches)"
    lev = max(-20.0, min(20.0, lev))

    # momentum (±20)
    mom = 0.0
    if rsi > 50:
        mom += min(10.0, (rsi - 50) * 0.5)
    else:
        mom -= min(10.0, (50 - rsi) * 0.5)
    if hist[-1] > 0 and macd_rising:
        mom += 10
    elif hist[-1] < 0 and not macd_rising:
        mom -= 10
    elif hist[-1] > 0 or (hist[-1] < 0 and macd_rising):
        mom += 4 if hist[-1] > 0 else -4
    else:
        mom += -4 if hist[-1] < 0 else 4
    mom = max(-20.0, min(20.0, mom))

    # session (0..15, applied to the chosen direction)
    total_signed = trend + struct + lev + mom
    direction = "long" if total_signed >= 0 else "short"
    # session boosts conviction once the components already align (capped at 100)
    score = min(100, int(round(abs(total_signed))) + (sess if abs(total_signed) >= 20 else 0))
    grade = "A" if score >= 80 else "B" if score >= 65 else "C" if score >= 50 else "<50"

    # ticket (sizing equity: start + closed PnL — open-position uPnL is marked in _paper_now)
    equity = PAPER["equity_start"] + sum(c["pnl"] for c in PAPER["closed"])
    risk_pct = 0.5
    risk_usd = equity * risk_pct / 100
    stop_dist = min(3 * atr, max(1.5 * atr, 0.8 * atr))
    sign = 1 if direction == "long" else -1
    entry = c
    stop = entry - sign * stop_dist
    tp1 = entry + sign * 1.5 * stop_dist
    tp2 = entry + sign * 2.5 * stop_dist
    tp3 = entry + sign * 4.0 * stop_dist
    stop_pips = stop_dist / cfg["pip"]
    lots = max(0.01, round(risk_usd / (stop_pips * cfg["pv"]), 2))
    trade = score >= 50 and ((direction == "long" and trend + mom >= 0) or (direction == "short" and trend + mom <= 0))

    def f(v):
        return round(float(v), cfg["digits"])

    return dict(
        symbol=sym,
        price=f(c),
        ts=str(np.datetime_as_string(ts_arr[-1], unit="m")),
        direction=direction,
        score=score,
        grade=grade,
        trade=trade,
        verdict=("TRADE " + direction.upper()) if trade else "NO TRADE",
        components=[
            dict(name="trend", points=round(trend, 1), weight=25,
                 reason=f"EMA20/50/200 alignment, strength {strength:.0%}"),
            dict(name="structure", points=round(struct, 1), weight=20,
                 reason=st["breakout"] or st["regime"]),
            dict(name="levels", points=round(lev, 1), weight=20, reason=lev_note),
            dict(name="momentum", points=round(mom, 1), weight=20,
                 reason=f"RSI {rsi:.0f}, MACD hist {'rising' if macd_rising else 'falling'}"),
            dict(name="session", points=sess, weight=15, reason=sess_desc),
        ],
        regime=st["regime"],
        atr=f(float(atr)),
        rsi=round(float(rsi), 1),
        support=[dict(price=f(p), touches=t) for p, t in sup[-3:]],
        resistance=[dict(price=f(p), touches=t) for p, t in res[:3]],
        ticket=None if not trade else dict(
            side=direction,
            entry=f(entry),
            stop=f(stop),
            tp1=f(tp1),
            tp2=f(tp2),
            tp3=f(tp3),
            lots=lots,
            risk_usd=round(risk_usd, 2),
            risk_pct=risk_pct,
            expiry="8h",
        ),
        news_gate=dict(blocked=False, note="no calendar file (preview) - gate open"),
    )


# ----------------------------------------------------------------------------
# paper book (seeded with last-known real state)
# ----------------------------------------------------------------------------
PAPER: dict = dict(
    equity_start=10000.0,
    open=[
        dict(id="p-xau-001", symbol="XAUUSD", side="short", lots=0.71, entry=2690.6,
             stop=2691.3, tp1=2689.55, tp2=2688.85, tp3=2687.80, opened="2026-10-27 08:12Z"),
    ],
    closed=[
        dict(symbol="EURUSD", side="long", lots=0.50, pnl=10.0, closed="2026-10-24", reason="tp2"),
        dict(symbol="EURUSD", side="short", lots=0.50, pnl=10.0, closed="2026-10-25", reason="tp3"),
        dict(symbol="EURUSD", side="short", lots=0.40, pnl=-8.0, closed="2026-10-26", reason="stop"),
    ],
)


def _paper_now() -> dict:
    closed_pnl = sum(c["pnl"] for c in PAPER["closed"])
    rows = []
    for p in PAPER["open"]:
        px = DECISIONS[p["symbol"]]["price"]
        d = (p["entry"] - px) if p["side"] == "short" else (px - p["entry"])
        pips = d / SYMBOLS[p["symbol"]]["pip"]
        upnl = round(pips * SYMBOLS[p["symbol"]]["pv"] * p["lots"], 2)
        rows.append({**p, "mark": px, "upnl": upnl,
                     "r": round(upnl / 49.0, 2)})  # 49 USD = risk at entry
    upnl_total = sum(r["upnl"] for r in rows)
    equity = PAPER["equity_start"] + closed_pnl + upnl_total
    day_pnl = upnl_total  # preview: open positions are the day's PnL
    ks = "OK" if day_pnl > -0.03 * equity else "TRIPPED"
    return dict(equity=round(equity, 2), closed_pnl=round(closed_pnl, 2), upnl=round(upnl_total, 2),
                day_pnl=round(day_pnl, 2), kill_switch=ks, open=rows, closed=PAPER["closed"])


# ----------------------------------------------------------------------------
# chart
# ----------------------------------------------------------------------------
BG, PANEL, GRID = "#0d1117", "#161b22", "#21262d"
UP, DN = "#2ea043", "#f85149"


def _chart(sym: str, tf: str) -> bytes:
    cfg = SYMBOLS[sym]
    d = CACHE[sym][tf]
    n = len(d["close"])
    show = 300 if tf == "m5" else (120 if tf == "h1" else n)
    c, o, h, l = d["close"][-show:], d["open"][-show:], d["high"][-show:], d["low"][-show:]
    ts = d["ts"][-show:]
    e20 = _ema(d["close"], 20)[-show:]
    e50 = _ema(d["close"], 50)[-show:]
    e200 = _ema(d["close"], 200)[-show:] if n >= 200 else None
    sup, res = _levels(d["high"][-1500:], d["low"][-1500:], float(c[-1]),
                       float(_atr(d["high"], d["low"], d["close"])[-1]))

    fig, ax = plt.subplots(figsize=(10.5, 5.2), dpi=110)
    fig.patch.set_facecolor(BG)
    ax.set_facecolor(PANEL)
    x = np.arange(len(c))
    w = 0.62
    for i in range(len(c)):
        col = UP if c[i] >= o[i] else DN
        ax.plot([i, i], [l[i], h[i]], color=col, lw=0.7, zorder=2)
        ax.add_patch(Rectangle((i - w / 2, min(o[i], c[i])), w, max(abs(c[i] - o[i]), 1e-9),
                               facecolor=col, edgecolor=col, zorder=3))
    ax.plot(x, e20, color="#e3b341", lw=1.0, label="EMA20")
    ax.plot(x, e50, color="#58a6ff", lw=1.0, label="EMA50")
    if e200 is not None:
        ax.plot(x, e200, color="#bc8cff", lw=1.0, label="EMA200")
    for p, t in sup[-3:]:
        ax.axhline(p, color=UP, ls="--", lw=0.9, alpha=0.8)
        ax.text(len(c) * 0.01, p, f"S {t}", color=UP, fontsize=8, va="bottom")
    for p, t in res[:3]:
        ax.axhline(p, color=DN, ls="--", lw=0.9, alpha=0.8)
        ax.text(len(c) * 0.01, p, f"R {t}", color=DN, fontsize=8, va="bottom")
    step = max(1, len(c) // 8)
    ax.set_xticks(x[::step])
    ax.set_xticklabels([str(t)[:16] for t in ts[::step]], rotation=20, fontsize=8, color="#8b949e")
    ax.tick_params(colors="#8b949e")
    for s in ax.spines.values():
        s.set_color(GRID)
    ax.grid(color=GRID, lw=0.5, alpha=0.5)
    ax.legend(loc="upper left", fontsize=8, facecolor=PANEL, edgecolor=GRID, labelcolor="#c9d1d9")
    last = c[-1]
    ax.set_title(
        f"{sym} · {tf.upper()} · last {last:.{cfg['digits']}f}   (synthetic preview data)",
        color="#c9d1d9", fontsize=11, loc="left",
    )
    fig.autofmt_xdate()
    buf = io.BytesIO()
    fig.tight_layout()
    fig.savefig(buf, format="png", facecolor=BG)
    plt.close(fig)
    return buf.getvalue()


# ----------------------------------------------------------------------------
# data cache + startup
# ----------------------------------------------------------------------------
CACHE: dict[str, dict] = {}
DECISIONS: dict[str, dict] = {}


def _build() -> None:
    now = datetime.now(timezone.utc)
    for sym, cfg in SYMBOLS.items():
        m5 = _gen_m5(sym, cfg)
        CACHE[sym] = dict(m5=m5, h1=_resample(m5, 12), d1=_resample(m5, 288))
        DECISIONS[sym] = decide(sym, m5, m5["ts"])
    print(f"fx-signal preview built: {', '.join(SYMBOLS)} at {now:%Y-%m-%d %H:%M UTC}", flush=True)


_build()


# ----------------------------------------------------------------------------
# routes
# ----------------------------------------------------------------------------
@app.api_route("/", methods=["GET", "HEAD"], response_class=HTMLResponse)
def index() -> str:
    return PAGE


@app.api_route("/api/symbols", methods=["GET", "HEAD"])
def api_symbols() -> JSONResponse:
    return JSONResponse(dict(symbols=list(SYMBOLS), tfs=TF_LIST))


@app.api_route("/api/decision", methods=["GET", "HEAD"])
def api_decision(symbol: str = Query("EURUSD")) -> JSONResponse:
    d = DECISIONS.get(symbol.upper())
    if d is None:
        return JSONResponse(dict(error=f"unknown symbol {symbol!r}"), status_code=404)
    return JSONResponse(d)


@app.api_route("/api/paper", methods=["GET", "HEAD"])
def api_paper() -> JSONResponse:
    return JSONResponse(_paper_now())


@app.api_route("/api/chart", methods=["GET", "HEAD"])
def api_chart(symbol: str = Query("EURUSD"), tf: str = Query("m5")) -> Response:
    sym = symbol.upper()
    if sym not in CACHE or tf not in TF_LIST:
        return Response(status_code=404)
    return Response(content=_chart(sym, tf), media_type="image/png")


# ----------------------------------------------------------------------------
# page
# ----------------------------------------------------------------------------
PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><title>fx-signal · trade signal dashboard</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
:root{--bg:#0d1117;--panel:#161b22;--border:#21262d;--text:#c9d1d9;--dim:#8b949e;--up:#2ea043;--dn:#f85149;--acc:#58a6ff}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:14px/1.45 -apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
header{display:flex;align-items:center;gap:14px;padding:14px 22px;border-bottom:1px solid var(--border);flex-wrap:wrap}
h1{font-size:17px;margin:0}h1 b{color:var(--acc)}
.badge{font-size:11px;padding:3px 9px;border-radius:10px;background:#3d2e00;color:#e3b341;border:1px solid #6e5600}
.badge2{font-size:11px;padding:3px 9px;border-radius:10px;background:#0d2438;color:var(--acc);border:1px solid #1f4d7a}
.eq{margin-left:auto;font-size:13px;color:var(--dim)}.eq b{color:var(--text);font-size:15px}
.tabs{display:flex;gap:8px;padding:14px 22px 0;flex-wrap:wrap;align-items:center}
.tab{padding:7px 16px;border-radius:8px;border:1px solid var(--border);background:var(--panel);color:var(--dim);cursor:pointer;font-size:13px}
.tab.on{background:#1f4d7a;border-color:var(--acc);color:#fff}
.tf{margin-left:14px;display:flex;gap:6px}
.tf .tab{padding:5px 12px;font-size:12px}
main{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:18px;padding:16px 22px;max-width:1500px;margin:0 auto}
@media(max-width:1100px){main{grid-template-columns:1fr}}
.card{background:var(--panel);border:1px solid var(--border);border-radius:12px;padding:16px}
.card h2{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--dim);margin:0 0 12px}
.chart img{width:100%;border-radius:8px;display:block}
.verdict{font-size:26px;font-weight:700;letter-spacing:.03em}
.verdict.long{color:var(--up)}.verdict.short{color:var(--dn)}.verdict.no{color:var(--dim)}
.scorebar{height:8px;border-radius:4px;background:var(--border);margin:10px 0 4px;overflow:hidden}
.scorebar i{display:block;height:100%;border-radius:4px}
.scorelab{font-size:12px;color:var(--dim);margin-bottom:12px}
table{width:100%;border-collapse:collapse;font-size:12.5px}
th{color:var(--dim);text-align:left;font-weight:600;padding:5px 8px;border-bottom:1px solid var(--border);font-size:11px;text-transform:uppercase;letter-spacing:.05em}
td{padding:5px 8px;border-bottom:1px solid var(--border)}
tr:last-child td{border-bottom:none}
.pos{font-weight:700}
.pos.long{color:var(--up)}.pos.short{color:var(--dn)}
.up{color:var(--up)}.dn{color:var(--dn)}
.comp{display:grid;grid-template-columns:86px 44px 1fr;gap:8px;font-size:12px;padding:6px 0;border-bottom:1px solid var(--border);align-items:baseline}
.comp:last-child{border-bottom:none}
.comp .pts{text-align:right;font-weight:700}
.comp .why{color:var(--dim);font-size:11.5px}
.ticket{display:grid;grid-template-columns:1fr 1fr;gap:8px 14px;margin-top:12px}
.ticket div{font-size:12px;color:var(--dim)}.ticket b{display:block;font-size:13.5px;color:var(--text);font-weight:600}
.foot{padding:10px 22px 26px;color:var(--dim);font-size:11.5px;max-width:1500px;margin:0 auto}
</style></head>
<body>
<header>
  <h1><b>fx-signal</b> · trade signal dashboard</h1>
  <span class="badge">PREVIEW · synthetic data</span>
  <span class="badge2" id="ts"></span>
  <div class="eq">equity <b id="equity">–</b> <span id="day"></span></div>
</header>
<div class="tabs">
  <span id="syms"></span>
  <div class="tf" id="tfs"></div>
</div>
<main>
  <div class="card chart"><img id="chart" alt="chart"></div>
  <div>
    <div class="card" id="decision"><h2>Decision</h2><div id="dec">loading…</div></div>
    <div class="card" style="margin-top:18px"><h2>Paper book</h2><div id="book">loading…</div></div>
  </div>
</main>
<div class="foot">Rebuilt preview after workspace reset — synthetic offline data, paper book seeded with the last-known real state. Original repo (10 commits, 112 tests) pending patchset restore.</div>
<script>
let SYM="EURUSD", TF="m5";
const $=id=>document.getElementById(id);
function fmt(v,d){return Number(v).toFixed(d==null?2:d)}
function init(){
  const syms=["EURUSD","USDJPY","XAUUSD"], tfs=["m5","h1","d1"];
  $("syms").innerHTML=syms.map(s=>`<span class="tab${s===SYM?" on":""}" data-s="${s}">${s}</span>`).join(" ");
  $("tfs").innerHTML=tfs.map(t=>`<span class="tab${t===TF?" on":""}" data-t="${t}">${t.toUpperCase()}</span>`).join(" ");
  document.querySelectorAll("[data-s]").forEach(e=>e.onclick=()=>{SYM=e.dataset.s;init();load()});
  document.querySelectorAll("[data-t]").forEach(e=>e.onclick=()=>{TF=e.dataset.t;init();loadChart()});
}
function loadChart(){$("chart").src=`/api/chart?symbol=${SYM}&tf=${TF}&v=${Date.now()}`}
async function loadDec(){
  const d=await (await fetch(`/api/decision?symbol=${SYM}`)).json();
  const cls=d.trade?(d.direction==="long"?"long":"short"):"no";
  const col=d.score>=65?"var(--up)":d.score>=50?"#e3b341":"var(--dn)";
  $("dec").innerHTML=`
    <div class="verdict ${cls}">${d.verdict}</div>
    <div class="scorebar"><i style="width:${d.score}%;background:${col}"></i></div>
    <div class="scorelab">confluence ${d.score}/100 · grade ${d.grade} · ${d.regime} · RSI ${d.rsi}</div>
    ${d.components.map(c=>`<div class="comp"><span>${c.name}</span>
      <span class="pts ${c.points>=0?"up":"dn"}">${c.points>=0?"+":""}${c.points}</span>
      <span class="why">${c.why}</span></div>`).join("")}
    ${d.ticket?`<div class="ticket">
      <div>side<b class="pos ${d.ticket.side}">${d.ticket.side.toUpperCase()}</b></div>
      <div>entry<b>${fmt(d.ticket.entry)}</b></div>
      <div>stop<b class="dn">${fmt(d.ticket.stop)}</b></div>
      <div>lots<b>${d.ticket.lots} (${d.ticket.risk_pct}% ≈ $${d.ticket.risk_usd})</b></div>
      <div>TP1<b class="up">${fmt(d.ticket.tp1)}</b></div>
      <div>TP2<b class="up">${fmt(d.ticket.tp2)}</b></div>
      <div>TP3<b class="up">${fmt(d.ticket.tp3)}</b></div>
      <div>expiry<b>${d.ticket.expiry}</b></div>
    </div>`:`<div class="why" style="color:var(--dim);font-size:12px;margin-top:10px">confluence below the 50 bar — stand aside</div>`}
    <div style="color:var(--dim);font-size:11px;margin-top:12px">news gate: ${d.news_gate.note}</div>`;
  $("ts").textContent=SYM+" · "+d.ts;
}
async function loadBook(){
  const b=await (await fetch("/api/paper")).json();
  $("equity").textContent="$"+fmt(b.equity);
  const dp=b.day_pnl>=0?`<span class="up">+${fmt(b.day_pnl)} today</span>`:`<span class="dn">${fmt(b.day_pnl)} today</span>`;
  $("day").innerHTML=dp;
  $("book").innerHTML=`
    <table><tr><th>sym</th><th>side</th><th>lots</th><th>entry</th><th>stop</th><th>mark</th><th>uPnL</th><th>R</th></tr>
    ${b.open.map(p=>`<tr><td>${p.symbol}</td><td class="pos ${p.side}">${p.side.toUpperCase()}</td><td>${p.lots}</td><td>${fmt(p.entry,3)}</td><td>${fmt(p.stop,3)}</td><td>${fmt(p.mark,3)}</td><td class="${p.upnl>=0?"up":"dn"}">${p.upnl>=0?"+":""}${fmt(p.upnl)}</td><td>${p.r}</td></tr>`).join("")}
    </table>
    <div style="color:var(--dim);font-size:11px;margin:10px 0 6px">recent closed · kill switch ${b.kill_switch}</div>
    <table><tr><th>sym</th><th>side</th><th>pnl</th><th>why</th><th>date</th></tr>
    ${b.closed.map(c=>`<tr><td>${c.symbol}</td><td class="pos ${c.side}">${c.side.toUpperCase()}</td><td class="${c.pnl>=0?"up":"dn"}">${c.pnl>=0?"+":""}${c.pnl}</td><td>${c.reason}</td><td>${c.closed}</td></tr>`).join("")}
    </table>`;
}
function load(){loadChart();loadDec();loadBook()}
init();load();setInterval(()=>{loadDec();loadBook()},60000);
</script></body></html>"""

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="warning")
