# fx-signal preview (rebuilt)

Self-contained preview of the fx-signal trade-signal dashboard, rebuilt after
the original project was lost in a sandbox workspace reset. Runs fully
offline on **synthetic** data — it is a functional stand-in, not the original
10-commit project (112 tests), which is pending restore from the Arena
patchset.

## Run it

```bash
python3 -m venv .venv
.venv/bin/pip install fastapi uvicorn numpy matplotlib
.venv/bin/python app.py            # -> http://localhost:8000
```

No data setup, no config: on startup it generates 30 days of synthetic M5
candles for EURUSD / USDJPY / XAUUSD (deterministic per symbol), computes
indicators + S/R levels, and seeds the paper book with the last-known real
state (XAUUSD short 0.71 @ 2690.6, 3 closed EURUSD trades, equity ~10,055).

## Endpoints

| Path | What |
|---|---|
| `/` | dashboard (charts, decision card, paper book, 60 s refresh) |
| `/api/symbols` | symbol + timeframe list |
| `/api/decision?symbol=EURUSD` | confluence verdict (5 components, 0–100 score, A/B/C grade) + full risk ticket (entry/stop/TP1-3/lots/risk/expiry) |
| `/api/paper` | book: open positions marked to latest bar, closed trades, equity, kill switch |
| `/api/chart?symbol=EURUSD&tf=m5\|h1\|d1` | candlestick PNG (EMA 20/50/200, S/R levels) |

## Honest caveats

- **Synthetic prices** — do not read any signal here as real market data.
- The decision engine is a compact re-implementation (trend ±25, structure
  ±20, levels ±20, momentum ±20, session ±15) — same *shape* as the original
  confluence card, but not bit-identical code.
- When the original project is restored, this preview is disposable — the
  real repo replaces it (`fx-signal serve` in the restored repo).
