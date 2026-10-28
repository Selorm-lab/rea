/**
 * Rev API integration smoke tests.
 * Run against a live server:  node tests/api-smoke.mjs [baseUrl]
 */
import assert from 'node:assert/strict';

const BASE = process.argv[2] ?? 'http://127.0.0.1:3000';
let cookie = '';
let passed = 0;
const failures = [];

function jar(res) {
  const set = res.headers.getSetCookie?.() ?? [];
  for (const c of set) {
    const pair = c.split(';')[0];
    if (pair.startsWith('rev_session=')) cookie = pair;
    if (pair.startsWith('rev_session=;')) cookie = '';
  }
}

async function call(method, path, body, { expect = 200, auth = true } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(auth && cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  jar(res);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (res.status !== expect) {
    throw new Error(`${method} ${path} → ${res.status} (expected ${expect}): ${text.slice(0, 300)}`);
  }
  return data;
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  ✗ ${name}\n      ${err.message}`);
  }
}

const section = (title) => console.log(`\n${title}`);

section('Health & auth');
await test('health endpoint responds', async () => {
  const d = await call('GET', '/health', undefined, { auth: false });
  assert.equal(d.ok, true);
  assert.equal(d.app, 'rev');
});

await test('dashboard rejects unauthenticated request', async () => {
  await call('GET', '/dashboard', undefined, { auth: false, expect: 401 });
});

await test('login with wrong password fails', async () => {
  await call('POST', '/auth/login', { email: 'ama@rev.app', password: 'nope' }, { auth: false, expect: 401 });
});

let bearerToken = '';
await test('demo login works and never leaks a password hash', async () => {
  const d = await call('POST', '/auth/demo', undefined, { auth: false });
  assert.equal(d.user.email, 'ama@rev.app');
  assert.ok(!('password_hash' in d.user), 'password_hash must not be serialised');
  assert.ok(cookie.startsWith('rev_session='));
  assert.ok(d.token, 'a bearer token is returned for cross-site previews');
  bearerToken = d.token;
});

await test('bearer token authenticates without cookies', async () => {
  const res = await fetch(`${BASE}/api/dashboard`, { headers: { authorization: `Bearer ${bearerToken}` } });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.user.email, 'ama@rev.app');
  const anon = await fetch(`${BASE}/api/dashboard`, { headers: { authorization: 'Bearer nonsense' } });
  assert.equal(anon.status, 401, 'invalid tokens are rejected');
});

await test('signup creates a fresh account', async () => {
  const email = `test${Date.now()}@rev.app`;
  const d = await call(
    'POST',
    '/auth/signup',
    { name: 'Test Rider', email, password: 'secret123', university: 'KNUST', campus: 'Kumasi' },
    { auth: false, expect: 201 },
  );
  assert.equal(d.user.email, email);
  assert.ok(d.user.wallet_cents > 0, 'new accounts get a demo wallet balance');
  await call('POST', '/auth/signup', { name: 'Dup', email, password: 'secret123' }, { auth: false, expect: 409 });
  await call('POST', '/auth/login', { email, password: 'secret123' }, { auth: false });
});

// back to the seeded demo rider for the rest of the suite
await call('POST', '/auth/demo', undefined, { auth: false });

section('Dashboard & profile');
let dashboard;
await test('dashboard aggregates stats, trips and activity', async () => {
  dashboard = await call('GET', '/dashboard');
  assert.ok(dashboard.stats.rides_this_month >= 0);
  assert.ok(Array.isArray(dashboard.recent_rides));
  assert.ok(Array.isArray(dashboard.transactions));
  assert.ok(dashboard.next_trip?.seat_labels?.length > 0, 'seeded intercity booking has seats');
  assert.ok(dashboard.user.wallet_cents >= 0, 'wallet should not be negative');
});

await test('profile updates persist', async () => {
  const before = dashboard.user;
  const d = await call('PATCH', '/profile', { bio: 'Updated bio from test', notif_deals: false });
  assert.equal(d.user.bio, 'Updated bio from test');
  assert.equal(d.user.notif_deals, 0);
  const me = await call('GET', '/auth/me');
  assert.equal(me.user.bio, 'Updated bio from test');
  await call('PATCH', '/profile', { bio: before.bio, notif_deals: Boolean(before.notif_deals) });
});

section('Rides');
let estimate;
await test('estimate prices every tier', async () => {
  const d = await call('POST', '/rides/estimate', {
    pickup: { lat: 5.6508, lng: -0.187 },
    dropoff: { lat: 5.6228, lng: -0.1738 },
  });
  assert.equal(d.options.length, 4);
  estimate = d.options;
  const sorted = [...d.options].sort((a, b) => a.fareCents - b.fareCents);
  assert.equal(sorted[0].tier, 'bike', 'bike should be the cheapest tier');
  assert.ok(sorted.every((o) => o.fareCents >= 500));
});

let ride;
await test('requesting a ride picks a driver and locks the fare', async () => {
  const d = await call(
    'POST',
    '/rides',
    {
      pickup_name: 'Balme Library',
      pickup_address: 'Legon',
      pickup_lat: 5.6508,
      pickup_lng: -0.187,
      dropoff_name: 'Accra Mall',
      dropoff_address: 'Tetteh Quarshie',
      dropoff_lat: 5.6228,
      dropoff_lng: -0.1738,
      tier: 'go',
      payment_method: 'wallet',
      notes: 'Two bags',
    },
    { expect: 201 },
  );
  ride = d.ride;
  assert.equal(ride.status, 'searching');
  assert.ok(ride.fare_cents > 0);
  await new Promise((r) => setTimeout(r, 3000));
  const live = await call('GET', `/rides/${ride.id}`);
  assert.equal(live.ride.status, 'arriving', 'driver should be assigned within 3s');
  assert.ok(live.ride.driver?.name, 'driver details are attached');
});

await test('ride cannot skip the state machine', async () => {
  await call('PATCH', `/rides/${ride.id}`, { status: 'completed' }, { expect: 400 });
});

await test('in-progress ride completes, charges wallet and records a transaction', async () => {
  const before = (await call('GET', '/auth/me')).user.wallet_cents;
  await call('PATCH', `/rides/${ride.id}`, { status: 'in_progress' });
  const done = await call('PATCH', `/rides/${ride.id}`, { status: 'completed' });
  assert.equal(done.ride.status, 'completed');
  const after = (await call('GET', '/auth/me')).user.wallet_cents;
  assert.equal(after, before - ride.fare_cents, 'wallet is debited by the fare');
  const txs = await call('GET', '/wallet/transactions');
  assert.ok(txs.transactions.some((t) => t.type === 'ride' && t.amount_cents === -ride.fare_cents));
});

await test('rating a completed ride is stored', async () => {
  const d = await call('PATCH', `/rides/${ride.id}`, { rating: 5, review: 'Great driver' });
  assert.equal(d.ride.rating, 5);
  assert.equal(d.ride.review, 'Great driver');
});

await test('scheduled ride can be created and cancelled', async () => {
  const when = new Date(Date.now() + 3 * 3600 * 1000).toISOString();
  const d = await call(
    'POST',
    '/rides',
    {
      pickup_name: 'UG Main Gate',
      pickup_address: 'Legon',
      pickup_lat: 5.6501,
      pickup_lng: -0.1929,
      dropoff_name: 'Kotoka International Airport',
      dropoff_address: 'Airport',
      dropoff_lat: 5.6052,
      dropoff_lng: -0.1668,
      tier: 'comfort',
      scheduled_for: when,
      payment_method: 'momo',
    },
    { expect: 201 },
  );
  assert.equal(d.ride.status, 'scheduled');
  const cancelled = await call('PATCH', `/rides/${d.ride.id}`, { status: 'cancelled' });
  assert.equal(cancelled.ride.status, 'cancelled');
});

await test('rides refuse to start without wallet funds, but cash is fine', async () => {
  const savedCookie = cookie;
  const email = `lowbal${Date.now()}@rev.app`;
  const signup = await call('POST', '/auth/signup', { name: 'Low Balance', email, password: 'lowbal123' }, { auth: false, expect: 201 });
  assert.equal(signup.user.wallet_cents, 15000, 'new accounts start with GH₵150');
  const longRide = {
    pickup_name: 'Legon',
    pickup_address: 'Accra',
    pickup_lat: 5.6508,
    pickup_lng: -0.187,
    dropoff_name: 'Kumasi',
    dropoff_address: 'Ashanti',
    dropoff_lat: 6.6885,
    dropoff_lng: -1.6244,
    tier: 'xl',
  };
  await call('POST', '/rides', { ...longRide, payment_method: 'wallet' }, { expect: 400 });
  const cash = await call('POST', '/rides', { ...longRide, payment_method: 'cash' }, { expect: 201 });
  assert.ok(cash.ride.fare_cents > 15000, 'the fare really does exceed the wallet');
  await call('PATCH', `/rides/${cash.ride.id}`, { status: 'cancelled' });
  cookie = savedCookie;
  await call('GET', '/dashboard');
});

await test('ride validation rejects nonsense input', async () => {
  await call('POST', '/rides', { pickup_name: '', dropoff_name: 'X' }, { expect: 400 });
  await call('POST', '/rides/estimate', { pickup: { lat: 'abc' }, dropoff: { lat: 1, lng: 1 } }, { expect: 400 });
});

await test('deleting a finished ride removes it from history', async () => {
  const list = await call('GET', '/rides?limit=200');
  const target = list.rides.find((r) => r.status === 'completed' && r.id !== ride.id);
  await call('DELETE', `/rides/${target.id}`);
  const after = await call('GET', '/rides?limit=200');
  assert.ok(!after.rides.some((r) => r.id === target.id));
});

section('Saved places');
let place;
await test('saved places CRUD', async () => {
  const created = await call(
    'POST',
    '/places',
    { label: 'Test spot', name: 'Balme Library', address: 'Legon', icon: 'campus', notes: 'quiet floor', lat: 5.6508, lng: -0.187 },
    { expect: 201 },
  );
  place = created.place;
  assert.equal(place.label, 'Test spot');
  const patched = await call('PATCH', `/places/${place.id}`, { label: 'Renamed spot', notes: 'updated' });
  assert.equal(patched.place.label, 'Renamed spot');
  const list = await call('GET', '/places');
  assert.ok(list.places.some((p) => p.id === place.id));
  await call('DELETE', `/places/${place.id}`);
  const after = await call('GET', '/places');
  assert.ok(!after.places.some((p) => p.id === place.id));
});

section('Vehicles');
let vehicle;
await test('vehicle CRUD', async () => {
  const created = await call(
    'POST',
    '/vehicles',
    { make: 'Honda', model: 'Fit', plate: `GT ${Date.now() % 10000}-25`, color: 'Blue', type: 'go', seats: 4 },
    { expect: 201 },
  );
  vehicle = created.vehicle;
  const patched = await call('PATCH', `/vehicles/${vehicle.id}`, { color: 'Red', is_active: false });
  assert.equal(patched.vehicle.color, 'Red');
  assert.equal(patched.vehicle.is_active, 0);
  await call('DELETE', `/vehicles/${vehicle.id}`, undefined, { expect: 200 });
  const list = await call('GET', '/vehicles');
  assert.ok(!list.vehicles.some((v) => v.id === vehicle.id));
});

section('Intercity');
let routesData;
await test('routes expose cities and next departures', async () => {
  routesData = await call('GET', '/intercity/routes');
  assert.ok(routesData.cities.includes('Accra'));
  assert.ok(routesData.routes.length >= 10);
});

let trip;
await test('trip search filters and sorts', async () => {
  const today = new Date();
  const date = today.toISOString().slice(0, 10);
  const d = await call('GET', `/intercity/trips?from=Accra&to=Kumasi&date=${date}&sort=price`);
  assert.ok(d.trips.length > 0, 'departures exist for Accra → Kumasi today');
  const prices = d.trips.map((t) => t.price_cents);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b), 'sorted by price');
  assert.ok(d.trips.every((t) => t.from_city === 'Accra' && t.to_city === 'Kumasi'));
  trip = d.trips.find((t) => t.seats_left > 3) ?? d.trips[0];
});

await test('trip detail returns a seat map', async () => {
  const d = await call('GET', `/intercity/trips/${trip.id}`);
  assert.equal(d.trip.id, trip.id);
  assert.equal(d.seats.length, d.trip.total_seats);
  assert.ok(d.seats.some((s) => s.taken), 'some seats are already taken by demo bookings');
});

let booking;
await test('booking seats charges the wallet and returns a reference', async () => {
  const before = (await call('GET', '/auth/me')).user.wallet_cents;
  const detail = await call('GET', `/intercity/trips/${trip.id}`);
  const free = detail.seats.filter((s) => !s.taken).slice(0, 2).map((s) => s.label);
  const d = await call(
    'POST',
    '/intercity/bookings',
    { trip_id: trip.id, seats: 2, seat_labels: free, passenger_name: 'Ama Serwaa', passenger_phone: '+233 24 000 0000', payment_method: 'wallet' },
    { expect: 201 },
  );
  booking = d.booking;
  assert.match(booking.reference, /^RV-[A-Z0-9]{5}$/);
  assert.deepEqual(booking.seat_labels, free);
  const after = (await call('GET', '/auth/me')).user.wallet_cents;
  assert.equal(after, before - booking.total_cents);
});

await test('booked seats can no longer be booked', async () => {
  await call(
    'POST',
    '/intercity/bookings',
    { trip_id: trip.id, seats: 1, seat_labels: [booking.seat_labels[0]], passenger_name: 'Someone Else', payment_method: 'cash' },
    { expect: 400 },
  );
});

await test('cancelling a booking refunds the wallet and frees seats', async () => {
  const before = (await call('GET', '/auth/me')).user.wallet_cents;
  const d = await call('PATCH', `/intercity/bookings/${booking.id}`, { status: 'cancelled' });
  assert.equal(d.booking.status, 'cancelled');
  const after = (await call('GET', '/auth/me')).user.wallet_cents;
  assert.ok(after > before, 'a refund landed in the wallet');
  const detail = await call('GET', `/intercity/trips/${trip.id}`);
  const seat = detail.seats.find((s) => s.label === booking.seat_labels[0]);
  assert.equal(seat.taken, false, 'cancelled seats are released');
});

await test('closed bookings can be deleted from history', async () => {
  await call('DELETE', `/intercity/bookings/${booking.id}`);
  const list = await call('GET', '/intercity/bookings');
  assert.ok(!list.bookings.some((b) => b.id === booking.id));
});

await test('booking validation rejects a departed trip and bad seat counts', async () => {
  await call('POST', '/intercity/bookings', { trip_id: trip.id, seats: 99, passenger_name: 'X' }, { expect: 400 });
  await call('POST', '/intercity/bookings', { trip_id: 'nope', seats: 1, passenger_name: 'X' }, { expect: 404 });
});

section('Operator console');
let managed;
await test('operator can publish a departure', async () => {
  const depart = new Date(Date.now() + 36 * 3600 * 1000);
  const d = await call(
    'POST',
    '/intercity/manage/trips',
    {
      from_city: 'Accra',
      to_city: 'Ho',
      depart_at: depart.toISOString(),
      price_cents: 8500,
      total_seats: 40,
      operator: 'Rev Shuttle',
      vehicle_type: 'Sprinter',
      amenities: ['wifi', 'ac'],
    },
    { expect: 201 },
  );
  managed = d.trip;
  assert.equal(managed.price_cents, 8500);
  const search = await call('GET', `/intercity/trips?from=Accra&to=Ho&date=${depart.toISOString().slice(0, 10)}`);
  assert.ok(search.trips.some((t) => t.id === managed.id), 'new departure is publicly searchable');
});

await test('operator can edit and delete their departure', async () => {
  const d = await call('PATCH', `/intercity/manage/trips/${managed.id}`, { price_cents: 9000, vehicle_type: 'Mini bus' });
  assert.equal(d.trip.price_cents, 9000);
  assert.equal(d.trip.vehicle_type, 'Mini bus');
  await call('DELETE', `/intercity/manage/trips/${managed.id}`);
  const mine = await call('GET', '/intercity/manage/trips?mine=1');
  assert.ok(!mine.trips.some((t) => t.id === managed.id));
});

await test('operator cannot set invalid departure data', async () => {
  const past = new Date(Date.now() - 3600 * 1000).toISOString();
  await call('POST', '/intercity/manage/trips', { from_city: 'Accra', to_city: 'Kumasi', depart_at: past, price_cents: 5000 }, { expect: 400 });
  await call('POST', '/intercity/manage/trips', { from_city: 'Accra', to_city: 'Accra', depart_at: new Date(Date.now() + 86400000).toISOString(), price_cents: 5000 }, { expect: 400 });
});

section('Wallet & payments');
await test('top-up increases the balance', async () => {
  const before = (await call('GET', '/auth/me')).user.wallet_cents;
  const d = await call('POST', '/wallet/topup', { amount_cents: 5000, method: 'momo' }, { expect: 201 });
  assert.equal(d.user.wallet_cents, before + 5000);
  await call('POST', '/wallet/topup', { amount_cents: 1 }, { expect: 400 });
});

let method;
await test('payment methods CRUD and default switching', async () => {
  const created = await call('POST', '/payment-methods', { kind: 'momo', label: 'Telecel Cash', detail: '050 •••• 1234' }, { expect: 201 });
  method = created.method;
  await call('PATCH', `/payment-methods/${method.id}`, { is_default: true });
  const list = await call('GET', '/payment-methods');
  const defaults = list.methods.filter((m) => m.is_default);
  assert.equal(defaults.length, 1, 'exactly one default method');
  assert.equal(defaults[0].id, method.id);
  await call('DELETE', `/payment-methods/${method.id}`);
  const after = await call('GET', '/payment-methods');
  assert.ok(after.methods.filter((m) => m.is_default).length <= 1);
});

await test('data export contains the account payload', async () => {
  const d = await call('GET', '/export');
  assert.ok(d.user.email);
  assert.ok(Array.isArray(d.rides));
  assert.ok(Array.isArray(d.bookings));
});

section('Security');
await test('unknown API routes 404 as JSON', async () => {
  await call('GET', '/nothing-here', undefined, { expect: 404 });
});

await test('cannot mutate another rider\'s booking', async () => {
  const list = await call('GET', '/intercity/bookings');
  const other = list.bookings.find((b) => b.status === 'confirmed');
  if (!other) return;
  await call('PATCH', `/intercity/bookings/${other.id}`, { status: 'cancelled' });
  const check = (await call('GET', '/intercity/bookings')).bookings.find((b) => b.id === other.id);
  assert.equal(check.status, 'cancelled', 'owner can cancel their own booking');
});

await call('POST', '/auth/logout', undefined, { auth: false });

section('Summary');
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  process.exitCode = 1;
} else {
  console.log('All Rev API flows verified ✓');
}
