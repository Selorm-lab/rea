import { Router } from 'express';
import { all, get, nowIso, run, uid } from '../db.ts';
import { requireAuth } from '../auth.ts';
import { bad, notFound, num, oneOf, str } from '../lib.ts';
import { estimateRide, TIERS, type TierId } from '../../shared/travel.ts';

export const ridesRouter = Router();
ridesRouter.use(requireAuth);

type RideRow = {
  id: string;
  user_id: string;
  pickup_name: string;
  pickup_address: string;
  dropoff_name: string;
  dropoff_address: string;
  tier: string;
  distance_km: number;
  duration_min: number;
  fare_cents: number;
  status: string;
  driver_id: string | null;
  payment_method: string;
  scheduled_for: string | null;
  notes: string;
  rating: number | null;
  review: string;
  created_at: string;
  completed_at: string | null;
  is_deleted: number;
  driver_name?: string | null;
  driver_vehicle?: string | null;
  driver_plate?: string | null;
  driver_rating?: number | null;
  driver_trips?: number | null;
  driver_color?: string | null;
};

const RIDE_STATUSES = ['scheduled', 'searching', 'arriving', 'in_progress', 'completed', 'cancelled'] as const;

const DRIVER_SELECT = `SELECT r.*, d.name AS driver_name, d.vehicle AS driver_vehicle, d.plate AS driver_plate,
  d.rating AS driver_rating, d.trips AS driver_trips, d.avatar_color AS driver_color
  FROM rides r LEFT JOIN drivers d ON d.id = r.driver_id`;

export function serializeRide(r: RideRow) {
  const tier = TIERS.find((t) => t.id === r.tier);
  return {
    ...r,
    tier_name: tier?.name ?? r.tier,
    tier_emoji: tier?.emoji ?? '🚗',
    driver: r.driver_id
      ? {
          id: r.driver_id,
          name: r.driver_name,
          vehicle: r.driver_vehicle,
          plate: r.driver_plate,
          rating: r.driver_rating,
          trips: r.driver_trips,
          color: r.driver_color,
        }
      : null,
  };
}

export function assignDriver(rideId: string) {
  const ride = get<RideRow>('SELECT * FROM rides WHERE id = ?', rideId);
  if (!ride || ride.status !== 'searching') return;
  const pool = all<{ id: string }>('SELECT id FROM drivers WHERE tier = ?', ride.tier);
  const drivers = pool.length ? pool : all<{ id: string }>('SELECT id FROM drivers');
  const driver = drivers[Math.floor(Math.random() * drivers.length)];
  const etaStatus = 'arriving';
  run('UPDATE rides SET driver_id = ?, status = ? WHERE id = ?', driver?.id ?? null, etaStatus, rideId);
}

const pendingTimers = new Map<string, NodeJS.Timeout>();

export function queueDriverAssignment(rideId: string) {
  const t = setTimeout(() => {
    pendingTimers.delete(rideId);
    try {
      assignDriver(rideId);
    } catch {
      /* ignore */
    }
  }, 2200);
  pendingTimers.set(rideId, t);
}

/** Repair rides left in `searching` after a restart. */
export function sweepSearchingRides() {
  const stale = all<{ id: string }>('SELECT id FROM rides WHERE status = ? AND is_deleted = 0', 'searching');
  for (const r of stale) assignDriver(r.id);
}

export function chargeRide(ride: RideRow) {
  const user = get<{ wallet_cents: number }>('SELECT wallet_cents FROM users WHERE id = ?', ride.user_id)!;
  if (ride.payment_method === 'wallet' && user.wallet_cents < ride.fare_cents) {
    throw Object.assign(new Error(`Not enough wallet balance. You need GH₵${(ride.fare_cents / 100).toFixed(2)} — top up in Wallet.`), {
      status: 400,
    });
  }
  if (ride.payment_method === 'wallet') {
    run('UPDATE users SET wallet_cents = wallet_cents - ? WHERE id = ?', ride.fare_cents, ride.user_id);
  }
  run(
    `INSERT INTO transactions (id, user_id, type, amount_cents, description, method, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    uid('txn'),
    ride.user_id,
    'ride',
    -ride.fare_cents,
    `Ride · ${ride.pickup_name} → ${ride.dropoff_name}`,
    ride.payment_method,
    'completed',
    nowIso(),
  );
  run('UPDATE users SET rides_count = rides_count + 1 WHERE id = ?', ride.user_id);
}

export function completeRide(rideId: string) {
  const ride = get<RideRow>('SELECT * FROM rides WHERE id = ?', rideId);
  if (!ride) notFound('Ride not found');
  if (ride.status === 'completed') return ride;
  chargeRide(ride);
  run('UPDATE rides SET status = ?, completed_at = ? WHERE id = ?', 'completed', nowIso(), rideId);
  return get<RideRow>('SELECT * FROM rides WHERE id = ?', rideId)!;
}

ridesRouter.get('/', (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : '';
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const limit = Math.min(Number(req.query.limit ?? 100) || 100, 200);
  let sql = `${DRIVER_SELECT} WHERE r.user_id = ? AND r.is_deleted = 0`;
  const params: any[] = [req.user!.id];
  if (status && status !== 'all') {
    if (status === 'upcoming') {
      sql += ` AND r.status IN ('scheduled','searching','arriving','in_progress')`;
    } else if (status === 'past') {
      sql += ` AND r.status IN ('completed','cancelled')`;
    } else {
      sql += ' AND r.status = ?';
      params.push(status);
    }
  }
  if (q) {
    sql += ' AND (r.pickup_name LIKE ? OR r.dropoff_name LIKE ? OR r.pickup_address LIKE ? OR r.dropoff_address LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY r.created_at DESC LIMIT ?';
  params.push(limit);
  res.json({ rides: all<RideRow>(sql, ...params).map(serializeRide) });
});

ridesRouter.get('/:id', (req, res) => {
  const ride = get<RideRow>(`${DRIVER_SELECT} WHERE r.id = ? AND r.user_id = ? AND r.is_deleted = 0`, req.params.id, req.user!.id);
  if (!ride) notFound('Ride not found');
  res.json({ ride: serializeRide(ride) });
});

/** All tier prices for a pickup/dropoff pair. */
ridesRouter.post('/estimate', (req, res) => {
  const pickup = req.body?.pickup ?? {};
  const dropoff = req.body?.dropoff ?? {};
  const pLat = num(pickup.lat, 'Pickup latitude', { min: -90, max: 90 });
  const pLng = num(pickup.lng, 'Pickup longitude', { min: -180, max: 180 });
  const dLat = num(dropoff.lat, 'Dropoff latitude', { min: -90, max: 90 });
  const dLng = num(dropoff.lng, 'Dropoff longitude', { min: -180, max: 180 });
  const when = typeof req.body?.when === 'string' && req.body.when ? new Date(req.body.when) : new Date();
  const at = Number.isNaN(when.getTime()) ? new Date() : when;
  const options = TIERS.map((t) => ({
    ...estimateRide({ lat: pLat, lng: pLng }, { lat: dLat, lng: dLng }, t.id, at),
    name: t.name,
    blurb: t.blurb,
    seats: t.seats,
    emoji: t.emoji,
  }));
  res.json({
    options,
    pickup: { lat: pLat, lng: pLng },
    dropoff: { lat: dLat, lng: dLng },
  });
});

ridesRouter.post('/', (req, res) => {
  const pickupName = str(req.body?.pickup_name, 'Pickup', { max: 160 });
  const pickupAddress = str(req.body?.pickup_address, 'Pickup address', { max: 240, optional: true });
  const dropoffName = str(req.body?.dropoff_name, 'Destination', { max: 160 });
  const dropoffAddress = str(req.body?.dropoff_address, 'Destination address', { max: 240, optional: true });
  const pLat = num(req.body?.pickup_lat, 'Pickup latitude', { min: -90, max: 90 });
  const pLng = num(req.body?.pickup_lng, 'Pickup longitude', { min: -180, max: 180 });
  const dLat = num(req.body?.dropoff_lat, 'Dropoff latitude', { min: -90, max: 90 });
  const dLng = num(req.body?.dropoff_lng, 'Dropoff longitude', { min: -180, max: 180 });
  const tierId = oneOf(req.body?.tier ?? 'go', TIERS.map((t) => t.id), 'Ride type') as TierId;
  const payment = oneOf(req.body?.payment_method ?? 'wallet', ['wallet', 'momo', 'card', 'cash'] as const, 'Payment method');
  const notes = str(req.body?.notes, 'Notes', { max: 400, optional: true });
  const whenRaw = typeof req.body?.scheduled_for === 'string' ? req.body.scheduled_for : '';
  const scheduled = whenRaw ? new Date(whenRaw) : null;
  if (scheduled && Number.isNaN(scheduled.getTime())) bad('Scheduled time is invalid');
  if (scheduled && scheduled.getTime() < Date.now() + 60_000) bad('Schedule a ride at least a minute from now');

  const est = estimateRide({ lat: pLat, lng: pLng }, { lat: dLat, lng: dLng }, tierId, scheduled ?? new Date());

  if (payment === 'wallet') {
    const wallet = get<{ wallet_cents: number }>('SELECT wallet_cents FROM users WHERE id = ?', req.user!.id)!;
    if (wallet.wallet_cents < est.fareCents) {
      bad(
        `Not enough wallet balance for this ride — you need GH₵${(est.fareCents / 100).toFixed(2)}. Top up or pay with Mobile Money.`,
      );
    }
  }

  const id = uid('rid');
  const status = scheduled ? 'scheduled' : 'searching';
  run(
    `INSERT INTO rides (id, user_id, pickup_name, pickup_address, pickup_lat, pickup_lng, dropoff_name, dropoff_address, dropoff_lat, dropoff_lng, tier, distance_km, duration_min, fare_cents, status, driver_id, payment_method, scheduled_for, notes, rating, review, created_at, completed_at, is_deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, NULL, '', ?, NULL, 0)`,
    id,
    req.user!.id,
    pickupName,
    pickupAddress || pickupName,
    pLat,
    pLng,
    dropoffName,
    dropoffAddress || dropoffName,
    dLat,
    dLng,
    tierId,
    est.distanceKm,
    est.durationMin,
    est.fareCents,
    status,
    payment,
    scheduled ? scheduled.toISOString() : null,
    notes,
    nowIso(),
  );
  if (!scheduled) queueDriverAssignment(id);
  const ride = get<RideRow>(`${DRIVER_SELECT} WHERE r.id = ?`, id)!;
  res.status(201).json({ ride: serializeRide(ride) });
});

ridesRouter.patch('/:id', (req, res) => {
  const ride = get<RideRow>('SELECT * FROM rides WHERE id = ? AND user_id = ? AND is_deleted = 0', req.params.id, req.user!.id);
  if (!ride) notFound('Ride not found');
  const body = req.body ?? {};

  if (body.status !== undefined) {
    const next = oneOf(body.status, RIDE_STATUSES, 'Status');
    const allowed: Record<string, string[]> = {
      searching: ['cancelled'],
      arriving: ['cancelled', 'in_progress'],
      in_progress: ['completed', 'cancelled'],
      scheduled: ['cancelled', 'searching'],
      completed: [],
      cancelled: [],
    };
    if (!allowed[ride.status]?.includes(next)) {
      bad(`A ${ride.status} ride cannot move to ${next}`);
    }
    if (next === 'completed') {
      completeRide(ride.id);
    } else if (next === 'cancelled') {
      const fee = ride.driver_id && ['arriving', 'in_progress'].includes(ride.status) ? 300 : 0;
      if (fee) {
        const user = get<{ wallet_cents: number }>('SELECT wallet_cents FROM users WHERE id = ?', req.user!.id)!;
        if (user.wallet_cents >= fee) {
          run('UPDATE users SET wallet_cents = wallet_cents - ? WHERE id = ?', fee, req.user!.id);
          run(
            `INSERT INTO transactions (id, user_id, type, amount_cents, description, method, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            uid('txn'),
            req.user!.id,
            'cancellation_fee',
            -fee,
            'Late cancellation fee',
            'wallet',
            'completed',
            nowIso(),
          );
        }
      }
      run('UPDATE rides SET status = ?, completed_at = ? WHERE id = ?', 'cancelled', nowIso(), ride.id);
    } else if (next === 'searching') {
      run('UPDATE rides SET status = ?, driver_id = NULL WHERE id = ?', 'searching', ride.id);
      queueDriverAssignment(ride.id);
    } else {
      run('UPDATE rides SET status = ? WHERE id = ?', next, ride.id);
    }
  }

  if (body.rating !== undefined) {
    const rating = num(body.rating, 'Rating', { min: 1, max: 5 });
    const review = str(body.review, 'Review', { max: 500, optional: true });
    run('UPDATE rides SET rating = ?, review = ? WHERE id = ?', Math.round(rating), review, ride.id);
    if (ride.driver_id) {
      const d = get<{ rating: number; trips: number }>('SELECT rating, trips FROM drivers WHERE id = ?', ride.driver_id);
      if (d) {
        const nextRating = Math.round(((d.rating * d.trips + rating) / (d.trips + 1)) * 10) / 10;
        run('UPDATE drivers SET rating = ?, trips = trips + 1 WHERE id = ?', nextRating, ride.driver_id);
      }
    }
  }

  if (body.notes !== undefined) {
    run('UPDATE rides SET notes = ? WHERE id = ?', str(body.notes, 'Notes', { max: 400, optional: true }), ride.id);
  }
  if (body.payment_method !== undefined) {
    const method = oneOf(body.payment_method, ['wallet', 'momo', 'card', 'cash'] as const, 'Payment method');
    if (['completed', 'cancelled'].includes(ride.status)) bad('Cannot change payment on a finished ride');
    run('UPDATE rides SET payment_method = ? WHERE id = ?', method, ride.id);
  }

  const updated = get<RideRow>(`${DRIVER_SELECT} WHERE r.id = ?`, ride.id)!;
  res.json({ ride: serializeRide(updated) });
});

ridesRouter.delete('/:id', (req, res) => {
  const ride = get<RideRow>('SELECT * FROM rides WHERE id = ? AND user_id = ?', req.params.id, req.user!.id);
  if (!ride) notFound('Ride not found');
  if (['arriving', 'in_progress'].includes(ride.status)) bad('Finish or cancel this ride before removing it');
  run('UPDATE rides SET is_deleted = 1 WHERE id = ?', ride.id);
  res.json({ ok: true });
});
