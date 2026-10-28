import { Router } from 'express';
import { all, get, nowIso, run, uid } from '../db.ts';
import { requireAuth } from '../auth.ts';
import { bad, notFound, num, oneOf, parseJsonArray, str } from '../lib.ts';

export const intercityRouter = Router();
intercityRouter.use(requireAuth);

type TripRow = {
  id: string;
  route_id: string;
  operator: string;
  vehicle_type: string;
  depart_at: string;
  arrive_at: string;
  price_cents: number;
  total_seats: number;
  amenities: string;
  status: string;
  created_by: string | null;
  created_at: string;
  from_city?: string;
  to_city?: string;
  distance_km?: number;
  duration_min?: number;
  seats_taken?: number;
};

type BookingRow = {
  id: string;
  user_id: string;
  trip_id: string;
  reference: string;
  passenger_name: string;
  passenger_phone: string;
  seats: number;
  seat_labels: string;
  total_cents: number;
  status: string;
  payment_method: string;
  created_at: string;
  depart_at?: string;
  arrive_at?: string;
  operator?: string;
  vehicle_type?: string;
  from_city?: string;
  to_city?: string;
  duration_min?: number;
  distance_km?: number;
};

const TRIP_JOIN = `SELECT t.*, r.from_city, r.to_city, r.distance_km, r.duration_min,
  (SELECT COALESCE(SUM(b.seats), 0) FROM bookings b WHERE b.trip_id = t.id AND b.status IN ('confirmed','completed')) AS seats_taken
  FROM trips t JOIN routes r ON r.id = t.route_id`;

const BOOKING_JOIN = `SELECT b.*, t.depart_at, t.arrive_at, t.operator, t.vehicle_type, t.total_seats,
  r.from_city, r.to_city, r.duration_min, r.distance_km
  FROM bookings b JOIN trips t ON t.id = b.trip_id JOIN routes r ON r.id = t.route_id`;

function serializeTrip(t: TripRow) {
  return {
    ...t,
    amenities: parseJsonArray(t.amenities),
    seats_left: Math.max(0, t.total_seats - (t.seats_taken ?? 0)),
  };
}

function serializeBooking(b: BookingRow) {
  return { ...b, seat_labels: parseJsonArray(b.seat_labels) };
}

function seatLabelsFor(total: number): string[] {
  const labels: string[] = [];
  const rows = Math.ceil(total / 4);
  for (let r = 1; r <= rows; r++) {
    for (const col of ['A', 'B', 'C', 'D']) {
      if (labels.length < total) labels.push(`${r}${col}`);
    }
  }
  return labels;
}

function takenLabels(tripId: string): Set<string> {
  const rows = all<{ seat_labels: string }>(
    `SELECT seat_labels FROM bookings WHERE trip_id = ? AND status IN ('confirmed','completed')`,
    tripId,
  );
  const set = new Set<string>();
  for (const r of rows) parseJsonArray(r.seat_labels).forEach((l) => set.add(l));
  return set;
}

function cityOptions() {
  return all<{ city: string }>(
    `SELECT from_city AS city FROM routes UNION SELECT to_city AS city FROM routes ORDER BY city`,
  ).map((r) => r.city);
}

/* ------------------------------- routes ------------------------------- */

intercityRouter.get('/routes', (_req, res) => {
  const routes = all<{
    id: string;
    from_city: string;
    to_city: string;
    distance_km: number;
    duration_min: number;
    base_price_cents: number;
    departures: number;
    min_price: number | null;
    next_depart: string | null;
  }>(
    `SELECT r.*,
      (SELECT COUNT(*) FROM trips t WHERE t.route_id = r.id AND t.depart_at > datetime('now') AND t.status = 'scheduled') AS departures,
      (SELECT MIN(t.price_cents) FROM trips t WHERE t.route_id = r.id AND t.depart_at > datetime('now') AND t.status = 'scheduled') AS min_price,
      (SELECT MIN(t.depart_at) FROM trips t WHERE t.route_id = r.id AND t.depart_at > datetime('now') AND t.status = 'scheduled') AS next_depart
     FROM routes r ORDER BY departures DESC`,
  );
  res.json({ cities: cityOptions(), routes });
});

/* -------------------------------- trips ------------------------------- */

intercityRouter.get('/trips', (req, res) => {
  const from = typeof req.query.from === 'string' ? req.query.from : '';
  const to = typeof req.query.to === 'string' ? req.query.to : '';
  const date = typeof req.query.date === 'string' ? req.query.date : '';
  const operators = typeof req.query.operators === 'string' && req.query.operators ? req.query.operators.split(',') : [];
  const amenities = typeof req.query.amenities === 'string' && req.query.amenities ? req.query.amenities.split(',') : [];
  const maxPrice = req.query.max_price ? Number(req.query.max_price) : null;
  const sort = typeof req.query.sort === 'string' ? req.query.sort : 'departure';
  const limit = Math.min(Number(req.query.limit ?? 60) || 60, 120);

  let sql = `${TRIP_JOIN} WHERE t.status = 'scheduled'`;
  const params: any[] = [];
  if (from) {
    sql += ' AND r.from_city = ?';
    params.push(from);
  }
  if (to) {
    sql += ' AND r.to_city = ?';
    params.push(to);
  }
  if (date) {
    const start = new Date(`${date}T00:00:00`);
    if (Number.isNaN(start.getTime())) bad('Invalid date');
    const end = new Date(start.getTime() + 86400000);
    sql += ' AND t.depart_at >= ? AND t.depart_at < ?';
    params.push(start.toISOString(), end.toISOString());
  } else {
    sql += ' AND t.depart_at > ?';
    params.push(new Date(Date.now() - 60000).toISOString());
  }
  if (operators.length) {
    sql += ` AND t.operator IN (${operators.map(() => '?').join(',')})`;
    params.push(...operators);
  }
  if (maxPrice) {
    sql += ' AND t.price_cents <= ?';
    params.push(Math.round(maxPrice));
  }
  sql +=
    sort === 'price'
      ? ' ORDER BY t.price_cents ASC, t.depart_at ASC'
      : sort === 'duration'
        ? ' ORDER BY r.duration_min ASC, t.depart_at ASC'
        : ' ORDER BY t.depart_at ASC';
  sql += ' LIMIT ?';
  params.push(limit);

  const trips = all<TripRow>(sql, ...params)
    .map(serializeTrip)
    .filter((t) => (amenities.length ? amenities.every((a: string) => t.amenities.includes(a)) : true));

  const operatorsAvailable = [...new Set(trips.map((t) => t.operator))];
  res.json({ trips, operators: operatorsAvailable });
});

intercityRouter.get('/trips/:id', (req, res) => {
  const trip = get<TripRow>(`${TRIP_JOIN} WHERE t.id = ?`, req.params.id);
  if (!trip) notFound('Departure not found');
  const taken = takenLabels(trip.id);
  const total = trip.total_seats;
  const seatMap = seatLabelsFor(total).map((label) => ({
    label,
    taken: taken.has(label),
    window: label.endsWith('A') || label.endsWith('D'),
  }));
  res.json({ trip: serializeTrip(trip), seats: seatMap });
});

/* ------------------------------ bookings ------------------------------ */

intercityRouter.get('/bookings', (req, res) => {
  const scope = req.query.scope === 'all' && ['operator', 'driver'].includes(req.user!.role) ? 'all' : 'mine';
  const where = scope === 'all' ? '' : ' WHERE b.user_id = ?';
  const params = scope === 'all' ? [] : [req.user!.id];
  const rows = all<BookingRow>(`${BOOKING_JOIN}${where} ORDER BY t.depart_at DESC`, ...params);
  res.json({ bookings: rows.map(serializeBooking), scope });
});

intercityRouter.post('/bookings', (req, res) => {
  const tripId = str(req.body?.trip_id, 'Departure', { max: 80 });
  const seats = Math.round(num(req.body?.seats ?? 1, 'Seats', { min: 1, max: 6 }));
  const passengerName = str(req.body?.passenger_name, 'Passenger name', { max: 120 });
  const passengerPhone = str(req.body?.passenger_phone, 'Passenger phone', { max: 40, optional: true });
  const method = oneOf(req.body?.payment_method ?? 'wallet', ['wallet', 'momo', 'card', 'cash'] as const, 'Payment method');

  const trip = get<TripRow>(`${TRIP_JOIN} WHERE t.id = ?`, tripId);
  if (!trip) notFound('Departure not found');
  if (trip.status !== 'scheduled' || new Date(trip.depart_at).getTime() < Date.now()) {
    bad('This departure has already left. Pick another departure.');
  }
  const taken = takenLabels(trip.id);
  const free = seatLabelsFor(trip.total_seats).filter((l) => !taken.has(l));
  if (free.length < seats) bad(`Only ${free.length} seat${free.length === 1 ? '' : 's'} left on this departure`);

  const chosen = Array.isArray(req.body?.seat_labels) && req.body.seat_labels.length === seats
    ? (req.body.seat_labels as string[]).filter((l) => free.includes(l))
    : free.slice(0, seats);
  if (chosen.length !== seats) bad('One of those seats was just taken. Please pick again.');

  const total = trip.price_cents * seats;
  if (method === 'wallet') {
    const user = get<{ wallet_cents: number }>('SELECT wallet_cents FROM users WHERE id = ?', req.user!.id)!;
    if (user.wallet_cents < total) bad('Not enough wallet balance for this booking. Top up or pay another way.');
    run('UPDATE users SET wallet_cents = wallet_cents - ? WHERE id = ?', total, req.user!.id);
  }
  const id = uid('bkg');
  let reference = `RV-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  while (get('SELECT id FROM bookings WHERE reference = ?', reference)) {
    reference = `RV-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }
  run(
    `INSERT INTO bookings (id, user_id, trip_id, reference, passenger_name, passenger_phone, seats, seat_labels, total_cents, status, payment_method, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?)`,
    id,
    req.user!.id,
    trip.id,
    reference,
    passengerName,
    passengerPhone,
    seats,
    JSON.stringify(chosen),
    total,
    method,
    nowIso(),
  );
  run(
    `INSERT INTO transactions (id, user_id, type, amount_cents, description, method, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    uid('txn'),
    req.user!.id,
    'booking',
    -total,
    `Intercity · ${trip.from_city} → ${trip.to_city}`,
    method,
    'completed',
    nowIso(),
  );
  const booking = get<BookingRow>(`${BOOKING_JOIN} WHERE b.id = ?`, id)!;
  res.status(201).json({ booking: serializeBooking(booking) });
});

intercityRouter.patch('/bookings/:id', (req, res) => {
  const booking = get<BookingRow>(`${BOOKING_JOIN} WHERE b.id = ?`, req.params.id);
  if (!booking) notFound('Booking not found');
  const isOwner = booking.user_id === req.user!.id;
  const isStaff = ['operator', 'driver'].includes(req.user!.role);
  if (!isOwner && !isStaff) notFound('Booking not found');

  const next = oneOf(req.body?.status, ['confirmed', 'cancelled', 'completed'] as const, 'Status');
  if (booking.status === next) return res.json({ booking: serializeBooking(booking) });
  if (['cancelled', 'completed'].includes(booking.status)) bad('This booking is already closed');

  if (next === 'cancelled') {
    const hoursToDeparture = (new Date(booking.depart_at!).getTime() - Date.now()) / 3600000;
    const refund = hoursToDeparture > 24 ? booking.total_cents : Math.round(booking.total_cents * 0.5);
    run('UPDATE users SET wallet_cents = wallet_cents + ? WHERE id = ?', refund, booking.user_id);
    run(
      `INSERT INTO transactions (id, user_id, type, amount_cents, description, method, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      uid('txn'),
      booking.user_id,
      'refund',
      refund,
      `Refund · ${booking.from_city} → ${booking.to_city} (${booking.reference})`,
      'wallet',
      'completed',
      nowIso(),
    );
    run('UPDATE bookings SET status = ? WHERE id = ?', 'cancelled', booking.id);
  } else if (next === 'completed') {
    run('UPDATE bookings SET status = ? WHERE id = ?', 'completed', booking.id);
  } else {
    bad('Only cancellation is supported here');
  }
  res.json({ booking: serializeBooking(get<BookingRow>(`${BOOKING_JOIN} WHERE b.id = ?`, booking.id)!) });
});

intercityRouter.delete('/bookings/:id', (req, res) => {
  const booking = get<BookingRow>('SELECT * FROM bookings WHERE id = ?', req.params.id);
  if (!booking || booking.user_id !== req.user!.id) notFound('Booking not found');
  if (booking.status === 'confirmed') bad('Cancel this booking before removing it from your history');
  run('DELETE FROM bookings WHERE id = ?', booking.id);
  res.json({ ok: true });
});

/* --------------------------- operator console -------------------------- */

intercityRouter.get('/manage/trips', (req, res) => {
  const mine = req.query.mine === '1';
  let sql = `${TRIP_JOIN}`;
  const params: any[] = [];
  if (mine) {
    sql += ' WHERE t.created_by = ?';
    params.push(req.user!.id);
  }
  sql += ' ORDER BY t.depart_at ASC';
  res.json({ trips: all<TripRow>(sql, ...params).map(serializeTrip) });
});

intercityRouter.post('/manage/trips', (req, res) => {
  const fromCity = str(req.body?.from_city, 'From city', { max: 80 });
  const toCity = str(req.body?.to_city, 'To city', { max: 80 });
  if (fromCity.toLowerCase() === toCity.toLowerCase()) bad('Origin and destination must be different');
  const departAt = new Date(str(req.body?.depart_at, 'Departure time'));
  if (Number.isNaN(departAt.getTime())) bad('Departure time is invalid');
  if (departAt.getTime() < Date.now()) bad('Departure must be in the future');
  const price = Math.round(num(req.body?.price_cents ?? req.body?.price ?? 0, 'Price', { min: 100, max: 500000 }));
  const seats = Math.round(num(req.body?.total_seats ?? 32, 'Seats', { min: 4, max: 80 }));
  const operator = str(req.body?.operator ?? 'Rev Shuttle', 'Operator', { max: 80 });
  const vehicleType = str(req.body?.vehicle_type ?? 'Coach', 'Vehicle type', { max: 80 });
  const amenities = Array.isArray(req.body?.amenities) ? (req.body.amenities as string[]).slice(0, 8) : [];

  let route = get<{ id: string; distance_km: number; duration_min: number }>(
    'SELECT id, distance_km, duration_min FROM routes WHERE (from_city = ? AND to_city = ?) OR (from_city = ? AND to_city = ?)',
    fromCity,
    toCity,
    toCity,
    fromCity,
  );
  if (!route) {
    const id = uid('rte');
    const duration = Math.max(45, Math.round((Math.abs(fromCity.length - toCity.length) + 8) * 22));
    run(
      'INSERT INTO routes (id, from_city, to_city, distance_km, duration_min, base_price_cents) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      fromCity,
      toCity,
      duration * 0.8,
      duration,
      price,
    );
    route = { id, distance_km: duration * 0.8, duration_min: duration };
  }
  const arriveAt = new Date(departAt.getTime() + route.duration_min * 60000);
  const id = uid('trp');
  run(
    `INSERT INTO trips (id, route_id, operator, vehicle_type, depart_at, arrive_at, price_cents, total_seats, amenities, status, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, ?)`,
    id,
    route.id,
    operator,
    vehicleType,
    departAt.toISOString(),
    arriveAt.toISOString(),
    price,
    seats,
    JSON.stringify(amenities.length ? amenities : ['ac']),
    req.user!.id,
    nowIso(),
  );
  const trip = get<TripRow>(`${TRIP_JOIN} WHERE t.id = ?`, id)!;
  res.status(201).json({ trip: serializeTrip(trip) });
});

intercityRouter.patch('/manage/trips/:id', (req, res) => {
  const trip = get<TripRow>('SELECT * FROM trips WHERE id = ?', req.params.id);
  if (!trip) notFound('Departure not found');
  if (req.user!.role !== 'operator' && trip.created_by !== req.user!.id) {
    return res.status(403).json({ error: 'You can only edit departures you published' });
  }
  const body = req.body ?? {};
  if (body.depart_at !== undefined) {
    const d = new Date(str(body.depart_at, 'Departure time'));
    if (Number.isNaN(d.getTime())) bad('Departure time is invalid');
    const route = get<{ duration_min: number }>('SELECT duration_min FROM routes WHERE id = ?', trip.route_id)!;
    run('UPDATE trips SET depart_at = ?, arrive_at = ? WHERE id = ?', d.toISOString(), new Date(d.getTime() + route.duration_min * 60000).toISOString(), trip.id);
  }
  if (body.price_cents !== undefined) {
    run('UPDATE trips SET price_cents = ? WHERE id = ?', Math.round(num(body.price_cents, 'Price', { min: 100, max: 500000 })), trip.id);
  }
  if (body.total_seats !== undefined) {
    const seats = Math.round(num(body.total_seats, 'Seats', { min: 4, max: 80 }));
    const taken = get<{ c: number }>(`SELECT COALESCE(SUM(seats),0) AS c FROM bookings WHERE trip_id = ? AND status IN ('confirmed','completed')`, trip.id)!.c;
    if (seats < taken) bad(`Already ${taken} seats booked — cannot reduce below that`);
    run('UPDATE trips SET total_seats = ? WHERE id = ?', seats, trip.id);
  }
  if (body.operator !== undefined) run('UPDATE trips SET operator = ? WHERE id = ?', str(body.operator, 'Operator', { max: 80 }), trip.id);
  if (body.vehicle_type !== undefined) run('UPDATE trips SET vehicle_type = ? WHERE id = ?', str(body.vehicle_type, 'Vehicle type', { max: 80 }), trip.id);
  if (body.amenities !== undefined && Array.isArray(body.amenities)) {
    run('UPDATE trips SET amenities = ? WHERE id = ?', JSON.stringify(body.amenities.slice(0, 8)), trip.id);
  }
  if (body.status !== undefined) {
    const status = oneOf(body.status, ['scheduled', 'cancelled', 'departed'] as const, 'Status');
    run('UPDATE trips SET status = ? WHERE id = ?', status, trip.id);
  }
  res.json({ trip: serializeTrip(get<TripRow>(`${TRIP_JOIN} WHERE t.id = ?`, trip.id)!) });
});

intercityRouter.delete('/manage/trips/:id', (req, res) => {
  const trip = get<TripRow>('SELECT * FROM trips WHERE id = ?', req.params.id);
  if (!trip) notFound('Departure not found');
  if (req.user!.role !== 'operator' && trip.created_by !== req.user!.id) {
    return res.status(403).json({ error: 'You can only delete departures you published' });
  }
  const booked = get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM bookings WHERE trip_id = ? AND status = 'confirmed'`,
    trip.id,
  )!.c;
  if (booked > 0) bad(`${booked} passenger${booked === 1 ? ' has' : 's have'} confirmed seats. Cancel the departure instead.`);
  run('DELETE FROM trips WHERE id = ?', trip.id);
  res.json({ ok: true });
});
