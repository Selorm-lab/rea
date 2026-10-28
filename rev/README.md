# Rev — ride local, go far

Rev is a full-stack ride-hailing and intercity travel product built for university students and everyone else. It borrows the interaction models that make Bolt and Uber feel effortless — tiered fares, live driver tracking, one-tap rebooking — and adds an intercity coach marketplace on the same account so a rider can get from a hostel in Legon to a lecture, then to Tamale for the weekend.

Everything here is a working product, not a mock: sessions, hashed passwords, SQLite persistence, live trip state machine, seat inventory, wallet ledger, refunds, and an operator console for publishing departures.

```
Landing page → sign in → dashboard → book a ride (live tracking) → book a coach seat → manage everything
```

## Quick start

```bash
cd rev
npm install
npm run seed      # demo data (skipped automatically if the database already has rows)
npm run dev       # API on :3000, Vite web app on :5173
```

Open **http://localhost:5173**.

For a single-process production run:

```bash
npm run serve     # builds the client, then serves app + API from http://localhost:3000
```

### Demo accounts

| Account | Email | Password | What to look at |
| --- | --- | --- | --- |
| Rider (student) | `ama@rev.app` | `rev1234` | Dashboard, live ride, bookings, wallet |
| Driver | `kwame@rev.app` | `rev1234` | Vehicles, driver profile |
| Operator | `ops@rev.app` | `rev1234` | Operator console (all departures) |

Or press **Try demo** on the sign-in screen. New sign-ups start with a GH₵150 demo wallet.

## What's inside

### Local rides
- **Four tiers** — Rev Bike, RevGo, Rev Comfort, Rev XL — with server-computed fares (distance × road factor, duration, tier rate, peak multiplier, minimum fare). The client never sets the price.
- **Live trip state machine** — `scheduled → searching → arriving → in_progress → completed`, with `cancelled` from any live state. A driver is dispatched ~2s after request; the UI polls and updates itself.
- **Fare charge on completion** from the wallet, with a ledger entry; late cancellation (driver already en route) charges a GH₵3 fee.
- **Rebooking** reuses stored coordinates, tier and route.
- Search, filters, ratings and reviews, receipts, saved places.

### Intercity
- 14 corridors and ~670 seeded departures across 10 days, with realistic operator mix (Vibe Express, OA Travel, VIP Jeoun, STC, Metro Mass), vehicle types, amenities, and per-day price variation.
- Search by corridor/date, sort by earliest/cheapest/fastest, filter by operator, max fare, amenities.
- **Live seat inventory**: every booking reserves specific seat labels, so the seat map stays truthful and concurrent bookings can't double-sell a seat.
- Cancel up to 24h before departure for a full refund (50% inside 24h), refunds applied to the wallet instantly; closed bookings can be removed from history.
- Booking confirmation with reference, seat list, and `.ics` calendar download.
- **Operator console**: publish/edit/delete departures, occupancy bars, seat revenue. Anyone can manage what they publish; the `operator` role can manage everything.

### Account
- Cookie sessions (HttpOnly, SameSite=Lax), scrypt password hashing, password change, sign out of all devices.
- Wallet with top-ups (MoMo/card/bank), full transaction statement and filters.
- Payment methods with a single default, optimistic switching.
- Saved places CRUD, vehicles CRUD, notification preferences, profile.
- JSON data export of everything Rev stores for the signed-in user.

### UI
- Dark ink sidebar + light workspace, brand green/lime accents, Plus Jakarta Sans, custom SVG design system.
- Hand-drawn **SVG maps** (Accra street grid with animated route + Ghana corridor map) — no map API keys, works offline.
- Loading skeletons everywhere, empty states with a next action, optimistic updates with rollback on failure, toasts, confirmation dialogs, responsive layout down to 360px with a mobile bottom bar.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| API | Express 4 + TypeScript (`tsx`) | Minimal, transparent routing |
| Database | `node:sqlite` (built into Node 22) | Zero external services, synchronous, file-persisted |
| Auth | DB-backed sessions, scrypt hashes, HttpOnly cookies | No token juggling in the client |
| Web | React 18 + React Router 6 + Vite | Fast HMR, tiny config |
| Icons | lucide-react | Consistent 1.8px stroke set |
| Validation | Hand-rolled guards in `server/lib.ts` | Predictable error messages |

No external APIs, no secrets, no cloud dependencies. `npm install && npm run seed && npm run dev` is the whole setup.

## Project layout

```
rev/
├── server/
│   ├── index.ts            # Express app, static serving, error handling
│   ├── db.ts               # schema, migrations, query helpers
│   ├── auth.ts             # sessions, scrypt hashing, guards
│   ├── seed.ts             # realistic demo dataset
│   └── routes/             # auth, rides, intercity, places, vehicles, account
├── shared/travel.ts        # places, cities, fare engine, formatters (server + web)
├── src/
│   ├── App.tsx             # routes + guards
│   ├── components/         # AppShell, UI kit, maps, ride bits
│   ├── lib/                # api client, auth context, toasts, formatters
│   ├── pages/              # 15 screens
│   └── index.css           # design system
├── tests/
│   ├── api-smoke.mjs       # 33 API integration checks
│   └── ui-smoke.tsx        # renders all 15 routes in jsdom against the live API
└── data/rev.db             # created on first boot (gitignored)
```

## API surface

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Liveness |
| `POST` | `/api/auth/signup` \| `/login` \| `/demo` \| `/logout` | Session lifecycle |
| `GET` | `/api/auth/me` | Current user |
| `PATCH` | `/api/profile` | Profile + notification prefs |
| `POST` | `/api/rides/estimate` | Price every tier for a pair of points |
| `GET/POST` | `/api/rides` | List / request a ride |
| `GET/PATCH/DELETE` | `/api/rides/:id` | Track, transition, rate, soft-delete |
| `GET` | `/api/intercity/routes` \| `/trips` \| `/trips/:id` | Corridors, search, seat map |
| `GET/POST` | `/api/intercity/bookings` | My bookings / reserve seats |
| `PATCH/DELETE` | `/api/intercity/bookings/:id` | Cancel (refund) / remove |
| `GET/POST` | `/api/intercity/manage/trips` | Operator inventory |
| `PATCH/DELETE` | `/api/intercity/manage/trips/:id` | Edit / remove a departure |
| `GET/POST/PATCH/DELETE` | `/api/places` | Saved places |
| `GET/POST/PATCH/DELETE` | `/api/vehicles` | Driver vehicles |
| `GET/POST/DELETE` | `/api/wallet/topup`, `/wallet/transactions`, `/payment-methods` | Money |
| `GET` | `/api/dashboard`, `/api/export` | Aggregates, data export |

All endpoints except `/health`, `/auth/*`, `/places/suggestions` require a session cookie. IDs are always scoped by `user_id`; ownership is re-checked server-side on every mutation.

## Testing

```bash
npm run test:api   # 33 integration checks against a running server
npm run test:ui    # renders every route in jsdom against the live API
npm run test       # both
npm run typecheck  # strict TS, noUnusedLocals on
```

`test:api` exercises signup/login, the full ride state machine (including illegal transitions), wallet debits/refunds, seat double-booking attempts, operator CRUD, and validation failures. `test:ui` boots jsdom, signs in through the real API, renders all 15 routes, and fails on missing content or console errors.

Tests mutate demo data. Restore a pristine dataset with:

```bash
npm run seed:reset
```

## Design notes

- **Fare integrity** — the estimate endpoint returns all four tiers; booking recomputes the fare server-side and ignores any client-sent price.
- **Seat integrity** — availability is derived from confirmed bookings' seat labels; the booking endpoint re-validates the requested labels and fails with a friendly message if a seat was taken in the meantime.
- **Wallet integrity** — every balance change writes a `transactions` row; seeded balances are derived from the ledger so the statement always reconciles.
- **Optimistic UI** — cancel/delete/toggle actions apply instantly and roll back with a toast if the server rejects them.
- **Errors** — the API returns `{ error }` with a human sentence; the UI surfaces it inline and as a toast, never as a raw stack trace.

Rev is an original implementation inspired by the ride-hailing category. It is not affiliated with Bolt, Uber, or any transport operator; operators and drivers in the seed data are fictional.
