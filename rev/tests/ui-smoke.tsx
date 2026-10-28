/**
 * Rev UI render tests — renders every page in jsdom against the live API.
 * Run: npx tsx tests/ui-smoke.tsx
 */
import { JSDOM } from 'jsdom';

const API = process.env.REV_API ?? 'http://127.0.0.1:3000';
const BASE = 'http://localhost:5173';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: BASE,
  pretendToBeVisual: true,
});

const g = globalThis as any;
g.window = dom.window;
g.document = dom.window.document;
Object.defineProperty(g, 'navigator', { value: dom.window.navigator, configurable: true });
g.location = dom.window.location;
g.history = dom.window.history;
g.localStorage = dom.window.localStorage;
g.sessionStorage = dom.window.sessionStorage;
g.HTMLElement = dom.window.HTMLElement;
g.HTMLInputElement = dom.window.HTMLInputElement;
g.Element = dom.window.Element;
g.Node = dom.window.Node;
g.Event = dom.window.Event;
g.MouseEvent = dom.window.MouseEvent;
g.KeyboardEvent = dom.window.KeyboardEvent;
g.getComputedStyle = dom.window.getComputedStyle;
g.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0) as unknown as number;
g.cancelAnimationFrame = (id: number) => clearTimeout(id);
g.Blob = dom.window.Blob;
g.FormData = dom.window.FormData;
g.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.HTMLElement.prototype.scrollIntoView = () => {};
dom.window.scrollTo = () => {};
dom.window.print = () => {};

/* ------------------------- cookie-aware fetch ------------------------- */
let cookie = '';
const realFetch = globalThis.fetch;
g.fetch = async (input: any, init: any = {}) => {
  const url = String(input).startsWith('http') ? String(input) : API + String(input);
  const headers = new Headers(init.headers ?? {});
  if (cookie) headers.set('cookie', cookie);
  const res = await realFetch(url, { ...init, headers });
  const set = res.headers.getSetCookie?.() ?? [];
  for (const c of set) {
    const pair = c.split(';')[0];
    if (pair.startsWith('rev_session=')) cookie = pair === 'rev_session=' ? '' : pair;
  }
  return res;
};

/* ------------------------------ helpers ------------------------------ */
const { act } = await import('react');
const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { MemoryRouter } = await import('react-router-dom');
const { AuthProvider } = await import('../src/lib/auth');
const { ToastProvider } = await import('../src/lib/toast');
const App = (await import('../src/App')).default;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function settled(timeout = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const text = document.body.textContent ?? '';
    if (!text.includes('Starting Rev') && !text.includes('Loading…') && text.length > 60) {
      await sleep(120);
      return;
    }
    await sleep(80);
  }
}

const results: Array<{ route: string; ok: boolean; note: string; preview?: string }> = [];
const errors: string[] = [];
const origError = console.error;
console.error = (...args: any[]) => {
  const msg = args.map(String).join(' ');
  if (!msg.includes('not wrapped in act') && !msg.includes('ReactDOM.render')) errors.push(msg);
  if (process.env.VERBOSE) origError(...args);
};

async function renderRoute(route: string, mustInclude: string[], mustNotInclude: string[] = [], guest = false) {
  const savedCookie = cookie;
  if (guest) cookie = '';
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.getElementById('root')!;
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries: [route] },
          React.createElement(ToastProvider, null, React.createElement(AuthProvider, null, React.createElement(App))),
        ),
      );
    });
    await settled();
    const text = container.textContent ?? '';
    const missing = mustInclude.filter((m) => !text.includes(m));
    const leaked = mustNotInclude.filter((m) => text.includes(m));
    const crashed = /Something went wrong|Cannot read properties|is not a function|Rendered more hooks|Minified React error|\[object Object\]|>undefined<|NaN/i.test(text);
    const ok = missing.length === 0 && leaked.length === 0 && !crashed;
    results.push({
      route,
      ok,
      preview: text.replace(/\s+/g, ' ').trim().slice(0, 900),
      note: crashed
        ? 'render crash'
        : missing.length
          ? `missing: ${missing.join(' | ')}`
          : leaked.length
            ? `unexpected: ${leaked.join(' | ')}`
            : 'ok',
    });
  } catch (err: any) {
    results.push({ route, ok: false, note: err?.message ?? String(err) });
  } finally {
    await act(async () => root.unmount());
    cookie = savedCookie;
  }
}

/* ------------------------------- setup ------------------------------- */
const demo = await realFetch(`${API}/api/auth/demo`, { method: 'POST' });
const demoCookies = demo.headers.getSetCookie?.() ?? [];
cookie = demoCookies.map((c) => c.split(';')[0]).find((c) => c.startsWith('rev_session=')) ?? '';
if (!cookie) {
  console.log('✗ could not sign in to the demo account — is the API running?');
  process.exit(1);
}
const tripsRes = await realFetch(`${API}/api/intercity/trips?from=Accra&to=Kumasi`, { headers: { cookie } });
const trips = (await tripsRes.json()) as any;
const tripId = trips.trips?.[0]?.id;

/* ------------------- phase 2: bearer token, no cookies ---------------- */
// Mirrors how the app authenticates inside cross-site preview iframes.
const demoJson = await demo.clone().json().catch(() => null as any);
if (demoJson?.token) {
  cookie = '';
  dom.window.localStorage.setItem('rev_token', demoJson.token);
  await renderRoute('/app', ['Rides this month', 'Book a ride']);
  await renderRoute('/app/wallet', ['REV WALLET BALANCE']);
  dom.window.localStorage.removeItem('rev_token');
} else {
  results.push({ route: '(bearer)', ok: false, note: 'demo login did not return a token' });
}
// restore the cookie for the guest-only route checks below
cookie = demoCookies.map((c) => c.split(';')[0]).find((c) => c.startsWith('rev_session=')) ?? '';

/* -------------- phase 3: a brand-new account sees empty states --------- */
const freshEmail = `fresh${Date.now()}@rev.app`;
const signupRes = await realFetch(`${API}/api/auth/signup`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ name: 'Fresh Rider', email: freshEmail, password: 'fresh1234', university: 'KNUST', campus: 'Kumasi' }),
});
const fresh = (await signupRes.json()) as any;
if (fresh?.token) {
  cookie = '';
  dom.window.localStorage.setItem('rev_token', fresh.token);
  await renderRoute('/app', ['Where are we going, Fresh', 'No intercity trips yet', 'Your ride history is empty']);
  await renderRoute('/app/bookings', ['No upcoming trips']);
  await renderRoute('/app/places', ['No saved places yet']);
  await renderRoute('/app/vehicles', ['No vehicles registered']);
  dom.window.localStorage.removeItem('rev_token');
} else {
  results.push({ route: '(fresh account)', ok: false, note: 'signup did not return a token' });
}
cookie = demoCookies.map((c) => c.split(';')[0]).find((c) => c.startsWith('rev_session=')) ?? '';

/* -------------------------------- tests ------------------------------- */
await renderRoute('/', ['Campus rides', 'Intercity travel'.replace('Intercity travel', 'Country-wide')], []);
await renderRoute('/login', ['Sign in to Rev', 'Try demo'], [], true);
await renderRoute('/signup', ['Create your Rev account', 'University'], [], true);
await renderRoute('/app', ['Good ', 'Rides this month', 'Book a ride']);
await renderRoute('/app/ride', ['Book a ride', 'Where are you going?', 'Fare summary']);
await renderRoute('/app/rides', ['Ride history', 'All rides']);
await renderRoute('/app/intercity', ['Intercity travel', 'Leaving from', 'Popular corridors']);
if (tripId) await renderRoute(`/app/intercity/${tripId}`, ['Pick your seats', 'Your trip', 'Pay & confirm']);
await renderRoute('/app/bookings', ['My bookings', 'Upcoming']);
await renderRoute('/app/places', ['Saved places']);
await renderRoute('/app/wallet', ['Wallet', 'REV WALLET BALANCE', 'Payment methods']);
await renderRoute('/app/vehicles', ['Your vehicles']);
await renderRoute('/app/operator', ['Operator console', 'Published departures']);
await renderRoute('/app/settings', ['Settings', 'Personal information', 'Notifications', 'Security']);
await renderRoute('/does-not-exist', ['Off the route']);

/* -------------------------------- report ------------------------------ */
console.log('\nRev UI render checks');
for (const r of results) {
  console.log(`  ${r.ok ? '✓' : '✗'} ${r.route}${r.ok ? '' : ` — ${r.note}`}`);
}
if (errors.length) {
  console.log('\nConsole errors:');
  for (const e of [...new Set(errors)].slice(0, 12)) console.log('  ·', e.slice(0, 240));
}
const failed = results.filter((r) => !r.ok);
if (process.env.DUMP) {
  for (const r of results) {
    if (r.route === '/app' || r.route === '/') console.log(`\n──── ${r.route} ────\n${r.preview}`);
  }
}
console.log(`\n${results.length - failed.length}/${results.length} pages rendered, ${failed.length} failed, ${errors.length} console errors`);
if (failed.length || errors.length) process.exitCode = 1;
process.exit(process.exitCode ?? 0);
