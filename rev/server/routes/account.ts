import { Router } from 'express';
import { all, get, nowIso, run, uid } from '../db.ts';
import { requireAuth, USER_COLUMNS } from '../auth.ts';
import { bad, notFound, num, oneOf, parseJsonArray, str } from '../lib.ts';

export const accountRouter = Router();
accountRouter.use(requireAuth);

accountRouter.get('/dashboard', (req, res) => {
  const userId = req.user!.id;
  const user = get<any>(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, userId)!;

  const completed = all<any>(
    `SELECT * FROM rides WHERE user_id = ? AND is_deleted = 0 AND status = 'completed' ORDER BY created_at DESC`,
    userId,
  );
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const spendRows = all<{ type: string; total: number }>(
    `SELECT type, COALESCE(SUM(-amount_cents), 0) AS total FROM transactions
     WHERE user_id = ? AND amount_cents < 0 AND created_at >= ? GROUP BY type`,
    userId,
    monthStart.toISOString(),
  );
  const monthSpend = spendRows.reduce((sum, r) => sum + r.total, 0);
  const kmThisMonth = completed
    .filter((r) => new Date(r.created_at) >= monthStart)
    .reduce((sum, r) => sum + r.distance_km, 0);

  const upcomingRide = get<any>(
    `SELECT r.*, d.name AS driver_name, d.vehicle AS driver_vehicle, d.plate AS driver_plate, d.rating AS driver_rating, d.avatar_color AS driver_color
     FROM rides r LEFT JOIN drivers d ON d.id = r.driver_id
     WHERE r.user_id = ? AND r.is_deleted = 0 AND r.status IN ('scheduled','searching','arriving','in_progress')
     ORDER BY CASE r.status WHEN 'in_progress' THEN 0 WHEN 'arriving' THEN 1 WHEN 'searching' THEN 2 ELSE 3 END,
              COALESCE(r.scheduled_for, r.created_at) ASC LIMIT 1`,
    userId,
  );

  const nextTrip = get<any>(
    `SELECT b.*, t.depart_at, t.arrive_at, t.operator, t.vehicle_type, r.from_city, r.to_city, r.duration_min
     FROM bookings b JOIN trips t ON t.id = b.trip_id JOIN routes r ON r.id = t.route_id
     WHERE b.user_id = ? AND b.status = 'confirmed' AND t.depart_at > ?
     ORDER BY t.depart_at ASC LIMIT 1`,
    userId,
    new Date().toISOString(),
  );

  const recentRides = all<any>(
    `SELECT r.*, d.name AS driver_name, d.avatar_color AS driver_color FROM rides r LEFT JOIN drivers d ON d.id = r.driver_id
     WHERE r.user_id = ? AND r.is_deleted = 0 AND r.status IN ('completed','cancelled')
     ORDER BY r.created_at DESC LIMIT 4`,
    userId,
  ).map((r) => ({ ...r, driver: r.driver_name ? { name: r.driver_name, color: r.driver_color } : null }));

  const upcomingBookings = all<any>(
    `SELECT b.*, t.depart_at, t.arrive_at, t.operator, t.vehicle_type, r.from_city, r.to_city, r.duration_min
     FROM bookings b JOIN trips t ON t.id = b.trip_id JOIN routes r ON r.id = t.route_id
     WHERE b.user_id = ? AND b.status = 'confirmed' AND t.depart_at > ?
     ORDER BY t.depart_at ASC LIMIT 5`,
    userId,
    new Date().toISOString(),
  ).map((b) => ({ ...b, seat_labels: parseJsonArray(b.seat_labels) }));

  const transactions = all<any>('SELECT * FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 6', userId);
  const places = all<any>('SELECT * FROM places WHERE user_id = ? ORDER BY created_at DESC LIMIT 4', userId);

  res.json({
    user,
    stats: {
      rides_total: completed.length,
      rides_this_month: completed.filter((r) => new Date(r.created_at) >= monthStart).length,
      km_this_month: Math.round(kmThisMonth * 10) / 10,
      spend_this_month: monthSpend,
      co2_saved_g: Math.round(kmThisMonth * 118),
      rating: user.rating,
    },
    upcoming_ride: upcomingRide ?? null,
    next_trip: nextTrip ? { ...nextTrip, seat_labels: parseJsonArray(nextTrip.seat_labels) } : null,
    upcoming_bookings: upcomingBookings,
    recent_rides: recentRides,
    transactions,
    places,
  });
});

accountRouter.patch('/profile', (req, res) => {
  const body = req.body ?? {};
  const user = req.user!;
  const emailNext = body.email !== undefined ? str(body.email, 'Email', { max: 200 }).toLowerCase() : user.email;
  if (emailNext !== user.email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailNext)) bad('Enter a valid email address');
    if (get('SELECT id FROM users WHERE email = ? AND id != ?', emailNext, user.id)) bad('That email is already in use');
  }
  run(
    `UPDATE users SET name = ?, email = ?, phone = ?, university = ?, campus = ?, bio = ?,
       notif_email = ?, notif_push = ?, notif_deals = ? WHERE id = ?`,
    body.name !== undefined ? str(body.name, 'Name', { max: 120 }) : user.name,
    emailNext,
    body.phone !== undefined ? str(body.phone, 'Phone', { max: 40, optional: true }) : user.phone,
    body.university !== undefined ? str(body.university, 'University', { max: 120, optional: true }) : user.university,
    body.campus !== undefined ? str(body.campus, 'Campus', { max: 120, optional: true }) : user.campus,
    body.bio !== undefined ? str(body.bio, 'Bio', { max: 300, optional: true }) : user.bio,
    body.notif_email !== undefined ? (body.notif_email ? 1 : 0) : user.notif_email,
    body.notif_push !== undefined ? (body.notif_push ? 1 : 0) : user.notif_push,
    body.notif_deals !== undefined ? (body.notif_deals ? 1 : 0) : user.notif_deals,
    user.id,
  );
  res.json({ user: get(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, user.id) });
});

accountRouter.post('/wallet/topup', (req, res) => {
  const amount = Math.round(num(req.body?.amount_cents, 'Amount', { min: 500, max: 500000 }));
  const method = oneOf(req.body?.method ?? 'momo', ['momo', 'card', 'bank'] as const, 'Method');
  run('UPDATE users SET wallet_cents = wallet_cents + ? WHERE id = ?', amount, req.user!.id);
  run(
    `INSERT INTO transactions (id, user_id, type, amount_cents, description, method, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    uid('txn'),
    req.user!.id,
    'topup',
    amount,
    `Wallet top-up · ${method === 'momo' ? 'Mobile Money' : method === 'card' ? 'Card' : 'Bank transfer'}`,
    method,
    'completed',
    nowIso(),
  );
  res.status(201).json({ user: get(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, req.user!.id) });
});

accountRouter.get('/wallet/transactions', (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 100) || 100, 200);
  const type = typeof req.query.type === 'string' && req.query.type !== 'all' ? req.query.type : '';
  let sql = 'SELECT * FROM transactions WHERE user_id = ?';
  const params: any[] = [req.user!.id];
  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }
  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);
  res.json({ transactions: all(sql, ...params) });
});

accountRouter.get('/payment-methods', (req, res) => {
  res.json({ methods: all('SELECT * FROM payment_methods WHERE user_id = ? ORDER BY is_default DESC, created_at ASC', req.user!.id) });
});

accountRouter.post('/payment-methods', (req, res) => {
  const kind = oneOf(req.body?.kind, ['momo', 'card', 'cash'] as const, 'Method type');
  const id = uid('pmt');
  const count = get<{ c: number }>('SELECT COUNT(*) AS c FROM payment_methods WHERE user_id = ?', req.user!.id)!.c;
  run(
    `INSERT INTO payment_methods (id, user_id, kind, label, detail, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    req.user!.id,
    kind,
    str(req.body?.label, 'Label', { max: 60 }),
    str(req.body?.detail, 'Detail', { max: 60, optional: true }),
    count === 0 ? 1 : 0,
    nowIso(),
  );
  res.status(201).json({ method: get('SELECT * FROM payment_methods WHERE id = ?', id) });
});

accountRouter.patch('/payment-methods/:id', (req, res) => {
  const m = get<any>('SELECT * FROM payment_methods WHERE id = ? AND user_id = ?', req.params.id, req.user!.id);
  if (!m) notFound('Payment method not found');
  if (req.body?.is_default) {
    run('UPDATE payment_methods SET is_default = 0 WHERE user_id = ?', req.user!.id);
    run('UPDATE payment_methods SET is_default = 1 WHERE id = ?', m.id);
  }
  if (req.body?.label !== undefined) {
    run('UPDATE payment_methods SET label = ? WHERE id = ?', str(req.body.label, 'Label', { max: 60 }), m.id);
  }
  res.json({ method: get('SELECT * FROM payment_methods WHERE id = ?', m.id) });
});

accountRouter.delete('/payment-methods/:id', (req, res) => {
  const m = get<any>('SELECT * FROM payment_methods WHERE id = ? AND user_id = ?', req.params.id, req.user!.id);
  if (!m) notFound('Payment method not found');
  run('DELETE FROM payment_methods WHERE id = ?', m.id);
  if (m.is_default) {
    const next = get<any>('SELECT id FROM payment_methods WHERE user_id = ? ORDER BY created_at ASC LIMIT 1', req.user!.id);
    if (next) run('UPDATE payment_methods SET is_default = 1 WHERE id = ?', next.id);
  }
  res.json({ ok: true });
});

accountRouter.get('/export', (req, res) => {
  const userId = req.user!.id;
  res.json({
    exported_at: nowIso(),
    user: get(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, userId),
    places: all('SELECT * FROM places WHERE user_id = ?', userId),
    vehicles: all('SELECT * FROM vehicles WHERE user_id = ?', userId),
    rides: all('SELECT * FROM rides WHERE user_id = ?', userId),
    bookings: all('SELECT * FROM bookings WHERE user_id = ?', userId),
    transactions: all('SELECT * FROM transactions WHERE user_id = ?', userId),
  });
});
