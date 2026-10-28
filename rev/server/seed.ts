import { initSchema, db, run, uid, all } from './db.ts';
import { hashPassword } from './auth.ts';
import { ACCRA_PLACES, estimateRide, type TierId } from '../shared/travel.ts';

type SeedUser = {
  name: string;
  email: string;
  phone: string;
  role: 'rider' | 'driver' | 'operator';
  university: string;
  campus: string;
  color: string;
  rating: number;
  bio?: string;
};

const DEMO_PASSWORD = 'rev1234';

const USERS: SeedUser[] = [
  {
    name: 'Ama Serwaa',
    email: 'ama@rev.app',
    phone: '+233 24 482 1190',
    role: 'rider',
    university: 'University of Ghana',
    campus: 'Legon',
    color: '#0FA968',
    rating: 4.9,
    bio: 'Level 300 Political Science. Always running late for a lecture.',
  },
  {
    name: 'Kwame Mensah',
    email: 'kwame@rev.app',
    phone: '+233 20 771 3320',
    role: 'driver',
    university: 'KNUST',
    campus: 'Ayeduase',
    color: '#2563EB',
    rating: 4.8,
    bio: 'Rev driver since 2024. KNUST alum, Engineering.',
  },
  {
    name: 'Nana Boateng',
    email: 'ops@rev.app',
    phone: '+233 55 900 1188',
    role: 'operator',
    university: '',
    campus: '',
    color: '#F59E0B',
    rating: 4.7,
    bio: 'Fleet operations, Rev Intercity.',
  },
  {
    name: 'Efua Asante',
    email: 'efua@rev.app',
    phone: '+233 26 334 8821',
    role: 'rider',
    university: 'University of Cape Coast',
    campus: 'Cape Coast',
    color: '#DB2777',
    rating: 5.0,
  },
  {
    name: 'Yaw Oppong',
    email: 'yaw@rev.app',
    phone: '+233 24 118 7742',
    role: 'rider',
    university: 'KNUST',
    campus: 'Kumasi',
    color: '#7C3AED',
    rating: 4.6,
  },
  {
    name: 'Akosua Danso',
    email: 'akosua@rev.app',
    phone: '+233 54 662 0091',
    role: 'rider',
    university: 'UPSA',
    campus: 'Madina',
    color: '#0891B2',
    rating: 4.9,
  },
  {
    name: 'Kojo Antwi',
    email: 'kojo@rev.app',
    phone: '+233 27 445 1120',
    role: 'rider',
    university: 'GIMPA',
    campus: 'Achimota',
    color: '#EA580C',
    rating: 4.4,
  },
  {
    name: 'Adjoa Nyarko',
    email: 'adjoa@rev.app',
    phone: '+233 24 990 3345',
    role: 'rider',
    university: 'University of Ghana',
    campus: 'Legon',
    color: '#16A34A',
    rating: 4.8,
  },
  {
    name: 'Selorm Agbeko',
    email: 'selorm@rev.app',
    phone: '+233 20 553 1177',
    role: 'rider',
    university: 'University of Ghana',
    campus: 'Legon',
    color: '#0E7490',
    rating: 4.7,
  },
  {
    name: 'Mabel Tetteh',
    email: 'mabel@rev.app',
    phone: '+233 55 221 0987',
    role: 'rider',
    university: 'Central University',
    campus: 'Miotso',
    color: '#BE123C',
    rating: 4.5,
  },
  {
    name: 'Fiifi Quaye',
    email: 'fiifi@rev.app',
    phone: '+233 24 780 4453',
    role: 'rider',
    university: 'University of Ghana',
    campus: 'Legon',
    color: '#4338CA',
    rating: 4.3,
  },
  {
    name: 'Abena Owusu',
    email: 'abena@rev.app',
    phone: '+233 27 118 9002',
    role: 'rider',
    university: 'KNUST',
    campus: 'Kumasi',
    color: '#CA8A04',
    rating: 4.9,
  },
];

const DRIVERS = [
  { name: 'Kofi Boateng', phone: '+233 24 301 7712', vehicle: 'Toyota Corolla', plate: 'GC 4821-24', rating: 4.9, trips: 3184, color: '#0F766E', tier: 'go' },
  { name: 'Ibrahim Fuseini', phone: '+233 20 544 1123', vehicle: 'Toyota Vitz', plate: 'AS 1177-23', rating: 4.8, trips: 2210, color: '#1D4ED8', tier: 'go' },
  { name: 'Samuel Tetteh', phone: '+233 55 902 3311', vehicle: 'Hyundai Elantra', plate: 'GT 7742-25', rating: 4.9, trips: 1465, color: '#7C3AED', tier: 'comfort' },
  { name: 'Grace Amoah', phone: '+233 26 118 4400', vehicle: 'Kia Rio', plate: 'GE 2280-24', rating: 5.0, trips: 980, color: '#DB2777', tier: 'comfort' },
  { name: 'Mensah Osei', phone: '+233 24 660 0172', vehicle: 'Toyota Hiace', plate: 'GS 9901-22', rating: 4.7, trips: 4102, color: '#B45309', tier: 'xl' },
  { name: 'Abdul Rahman', phone: '+233 20 223 6612', vehicle: 'Bajaj Boxer', plate: 'M 4412-25', rating: 4.8, trips: 6120, color: '#0E7490', tier: 'bike' },
  { name: 'Emmanuel Nkrumah', phone: '+233 54 889 0021', vehicle: 'Honda Civic', plate: 'GR 3344-23', rating: 4.9, trips: 1870, color: '#15803D', tier: 'go' },
  { name: 'Comfort Adjei', phone: '+233 27 661 2299', vehicle: 'Nissan Almera', plate: 'GW 5521-24', rating: 4.8, trips: 1120, color: '#BE185D', tier: 'comfort' },
];

const ROUTES: Array<{ from: string; to: string; km: number; min: number; price: number }> = [
  { from: 'Accra', to: 'Kumasi', km: 250, min: 255, price: 12000 },
  { from: 'Accra', to: 'Cape Coast', km: 145, min: 165, price: 7000 },
  { from: 'Accra', to: 'Takoradi', km: 220, min: 240, price: 11000 },
  { from: 'Accra', to: 'Ho', km: 160, min: 180, price: 8000 },
  { from: 'Accra', to: 'Tamale', km: 640, min: 600, price: 22000 },
  { from: 'Accra', to: 'Koforidua', km: 95, min: 110, price: 4500 },
  { from: 'Accra', to: 'Sunyani', km: 400, min: 360, price: 13000 },
  { from: 'Accra', to: 'Aflao', km: 180, min: 210, price: 9000 },
  { from: 'Kumasi', to: 'Tamale', km: 400, min: 390, price: 15000 },
  { from: 'Kumasi', to: 'Cape Coast', km: 230, min: 240, price: 9500 },
  { from: 'Kumasi', to: 'Techiman', km: 120, min: 120, price: 5500 },
  { from: 'Tamale', to: 'Bolgatanga', km: 160, min: 180, price: 7000 },
  { from: 'Ho', to: 'Hohoe', km: 90, min: 105, price: 4000 },
  { from: 'Accra', to: 'Lomé', km: 210, min: 240, price: 16000 },
];

const OPERATORS = ['Vibe Express', 'OA Travel', 'VIP Jeoun', 'STC Intercity', 'Metro Mass', 'Rev Shuttle'];
const VEHICLE_TYPES = ['Executive Coach', 'Air-conditioned Coach', 'Sprinter', 'Double-decker', 'Mini bus'];
const AMENITY_POOL = ['wifi', 'ac', 'usb', 'reclining', 'snack', 'toilet', 'entertainment'];
const DEPART_HOURS = [5.5, 7, 9.5, 12, 15.5, 18, 21];

function iso(d: Date) {
  return d.toISOString();
}
function at(daysFromNow: number, hour: number, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(Math.floor(hour), minute, 0, 0);
  return d;
}
function pick<T>(arr: T[], rng = Math.random): T {
  return arr[Math.floor(rng() * arr.length)];
}
function refCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `RV-${s}`;
}

function insertUser(u: SeedUser, createdAt: Date): string {
  return (() => {
    const id = uid('usr');
    run(
      `INSERT INTO users (id, name, email, phone, password_hash, role, avatar_color, university, campus, bio, wallet_cents, rating, rides_count, notif_email, notif_push, notif_deals, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      u.name,
      u.email,
      u.phone,
      hashPassword(DEMO_PASSWORD),
      u.role,
      u.color,
      u.university,
      u.campus,
      u.bio ?? '',
      0,
      u.rating,
      0,
      1,
      1,
      u.role === 'rider' ? 1 : 0,
      iso(createdAt),
    );
    return id;
  })();
}

export function seed() {
  initSchema();
  const existing = all<{ c: number }>('SELECT COUNT(*) AS c FROM users')[0]?.c ?? 0;
  if (existing > 0) return { seeded: false };

  const now = new Date();
  const userIds: Record<string, string> = {};
  USERS.forEach((u, i) => {
    const created = new Date(now.getTime() - (120 - i * 7) * 86400000);
    userIds[u.email] = insertUser(u, created);
  });
  const ama = userIds['ama@rev.app'];
  const kwame = userIds['kwame@rev.app'];
  const otherRiders = USERS.filter((u) => u.role === 'rider' && u.email !== 'ama@rev.app').map((u) => userIds[u.email]);

  // ---- drivers
  const driverIds: string[] = [];
  for (const d of DRIVERS) {
    const id = uid('drv');
    driverIds.push(id);
    run(
      `INSERT INTO drivers (id, name, phone, vehicle, plate, rating, trips, avatar_color, tier)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      d.name,
      d.phone,
      d.vehicle,
      d.plate,
      d.rating,
      d.trips,
      d.color,
      d.tier,
    );
  }

  // ---- saved places
  const place = (userId: string, label: string, name: string, address: string, icon: string, notes: string, lat: number, lng: number, days: number) => {
    run(
      `INSERT INTO places (id, user_id, label, name, address, icon, notes, lat, lng, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      uid('plc'),
      userId,
      label,
      name,
      address,
      icon,
      notes,
      lat,
      lng,
      iso(new Date(now.getTime() - days * 86400000)),
    );
  };
  place(ama, 'Home', 'Hostel 4, East Legon', 'American House, East Legon', 'home', 'Room B12 — call when you reach the gate', 5.6379, -0.1521, 96);
  place(ama, 'Campus', 'Balme Library', 'University of Ghana, Legon', 'campus', 'Main entrance, not the Annex', 5.6508, -0.187, 96);
  place(ama, 'Part-time job', 'Accra Mall', 'Spintex Road, Tetteh Quarshie', 'work', 'Shift starts 9am, use the west wing drop-off', 5.6228, -0.1738, 61);
  place(ama, 'Waakye spot', 'Auntie Muni Waakye', 'Madina Zongo Junction', 'food', 'Saturday mornings with Adjoa', 5.6801, -0.1634, 34);
  place(kwame, 'Home', 'KNUST Junction', 'Ayeduase, Kumasi', 'home', '', 6.6745, -1.5716, 100);
  place(kwame, 'Campus', 'KNUST College of Engineering', 'KNUST, Kumasi', 'campus', '', 6.6745, -1.5716, 100);
  place(userIds['efua@rev.app'], 'Home', 'Cape Coast Teaching Hospital Area', 'Abura, Cape Coast', 'home', '', 5.1053, -1.2466, 70);
  place(userIds['adjoa@rev.app'], 'Campus', 'Volta Hall', 'University of Ghana, Legon', 'campus', '', 5.6508, -0.187, 50);

  // ---- vehicles
  const vehicle = (userId: string, make: string, model: string, plate: string, color: string, type: string, seats: number, active = 1) => {
    run(
      `INSERT INTO vehicles (id, user_id, make, model, plate, color, type, seats, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      uid('veh'),
      userId,
      make,
      model,
      plate,
      color,
      type,
      seats,
      active,
      iso(new Date(now.getTime() - 80 * 86400000)),
    );
  };
  vehicle(kwame, 'Toyota', 'Corolla', 'GC 4821-24', 'Silver', 'economy', 4);
  vehicle(kwame, 'Hyundai', 'Elantra', 'GT 2218-25', 'Midnight Blue', 'comfort', 4);
  vehicle(kwame, 'Toyota', 'Hiace', 'GS 7741-22', 'White', 'xl', 14, 0);

  // ---- routes + trips
  const routeIds: Record<string, string> = {};
  for (const r of ROUTES) {
    const id = uid('rte');
    routeIds[`${r.from}|${r.to}`] = id;
    run(
      `INSERT INTO routes (id, from_city, to_city, distance_km, duration_min, base_price_cents) VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      r.from,
      r.to,
      r.km,
      r.min,
      r.price,
    );
  }

  const upcomingTrips: Array<{ id: string; routeId: string; depart: Date; price: number; seats: number }> = [];
  const tripStmt = db.prepare(
    `INSERT INTO trips (id, route_id, operator, vehicle_type, depart_at, arrive_at, price_cents, total_seats, amenities, status, created_by, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  for (const r of ROUTES) {
    const routeId = routeIds[`${r.from}|${r.to}`];
    for (let day = -1; day <= 9; day++) {
      const hours = day === -1 ? [7, 15.5] : DEPART_HOURS.filter((_, idx) => (idx + day + r.from.length) % 3 !== 0);
      for (const h of hours) {
        const depart = at(day, Math.floor(h), h % 1 ? 30 : 0);
        if (day === -1 && h > 8) continue;
        const arrive = new Date(depart.getTime() + r.min * 60000);
        const weekend = [0, 6].includes(depart.getDay());
        const jitter = 0.92 + ((day + Math.round(h * 2) + r.to.length) % 7) * 0.028;
        const price = Math.round((r.price * jitter * (weekend ? 1.12 : 1) + (h >= 18 ? 500 : 0)) / 100) * 100;
        const seats = pick([32, 44, 50, 14, 28]);
        const id = uid('trp');
        const amenities = AMENITY_POOL.filter(() => Math.random() > 0.55);
        const status = depart.getTime() < now.getTime() ? 'departed' : 'scheduled';
        tripStmt.run(
          id,
          routeId,
          pick(OPERATORS),
          pick(VEHICLE_TYPES),
          iso(depart),
          iso(arrive),
          price,
          seats,
          JSON.stringify(amenities.length ? amenities : ['ac']),
          status,
          userIds['ops@rev.app'],
          iso(new Date(now.getTime() - 14 * 86400000)),
        );
        if (status === 'scheduled') {
          upcomingTrips.push({ id, routeId, depart, price, seats });
        }
      }
    }
  }

  // ---- other riders fill seats so availability looks real
  const bookingStmt = db.prepare(
    `INSERT INTO bookings (id, user_id, trip_id, reference, passenger_name, passenger_phone, seats, seat_labels, total_cents, status, payment_method, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const seatLabel = (n: number, total: number) => {
    const row = Math.ceil(n / 4);
    const col = ['A', 'B', 'C', 'D'][n % 4];
    return `${Math.min(row, Math.ceil(total / 4))}${col}`;
  };

  for (const trip of upcomingTrips) {
    if (Math.random() > 0.86) continue;
    const target = Math.max(2, Math.floor((trip.seats - 2) * (0.2 + Math.random() * 0.75)));
    let filled = 0;
    let guard = 0;
    while (filled < target && guard < 40) {
      guard++;
      const riderId = pick(otherRiders);
      const rider = USERS.find((u) => userIds[u.email] === riderId)!;
      const n = Math.min(1 + Math.floor(Math.random() * 2), target - filled);
      const labels = Array.from({ length: n }, (_, i) => seatLabel(filled + i, trip.seats));
      bookingStmt.run(
        uid('bkg'),
        riderId,
        trip.id,
        refCode(),
        rider.name,
        rider.phone,
        n,
        JSON.stringify(labels),
        trip.price * n,
        'confirmed',
        pick(['wallet', 'momo', 'card']),
        iso(new Date(now.getTime() - Math.floor(Math.random() * 6) * 86400000)),
      );
      filled += n;
    }
  }

  // ---- Ama's intercity bookings
  const findTrip = (from: string, to: string, dayOffset: number, hour: number) => {
    const routeId = routeIds[`${from}|${to}`];
    return upcomingTrips.find(
      (t) => t.routeId === routeId && Math.abs(t.depart.getTime() - at(dayOffset, hour).getTime()) < 3600000 * 3,
    );
  };
  const amaBookings: Array<{ trip: any; seats: number; status: string; days: number }> = [];
  const b1 = findTrip('Accra', 'Kumasi', 2, 7);
  if (b1) amaBookings.push({ trip: b1, seats: 1, status: 'confirmed', days: 4 });
  const b2 = findTrip('Accra', 'Cape Coast', 5, 9.5);
  if (b2) amaBookings.push({ trip: b2, seats: 2, status: 'confirmed', days: 6 });
  const b3 = findTrip('Kumasi', 'Accra', 8, 15.5);
  if (b3) amaBookings.push({ trip: b3, seats: 1, status: 'confirmed', days: 2 });

  const pastTrips = all<{ id: string; price_cents: number; from_city: string; to_city: string }>(
    `SELECT t.id, t.price_cents, r.from_city, r.to_city FROM trips t JOIN routes r ON r.id = t.route_id
     WHERE t.status = 'departed' LIMIT 30`,
  );
  const pastBooking = pastTrips.find((t) => t.from_city === 'Accra' && t.to_city === 'Koforidua') ?? pastTrips[0];
  const pastBooking2 = pastTrips.find((t) => t.from_city === 'Accra' && t.to_city === 'Ho');

  const takenFor = (tripId: string) => {
    const rows = all<{ seat_labels: string }>(
      `SELECT seat_labels FROM bookings WHERE trip_id = ? AND status IN ('confirmed','completed')`,
      tripId,
    );
    const set = new Set<string>();
    for (const r of rows) {
      try {
        (JSON.parse(r.seat_labels) as string[]).forEach((l) => set.add(l));
      } catch {
        /* ignore */
      }
    }
    return set;
  };
  const freeSeatsFor = (tripId: string, total: number, count: number) => {
    const taken = takenFor(tripId);
    const out: string[] = [];
    for (let n = 0; n < total && out.length < count; n++) {
      const label = seatLabel(n, total);
      if (!taken.has(label)) out.push(label);
    }
    return out;
  };

  for (const b of amaBookings) {
    const labels = freeSeatsFor(b.trip.id, b.trip.seats, b.seats);
    bookingStmt.run(
      uid('bkg'),
      ama,
      b.trip.id,
      refCode(),
      'Ama Serwaa',
      '+233 24 482 1190',
      b.seats,
      JSON.stringify(labels),
      b.trip.price * b.seats,
      b.status,
      'wallet',
      iso(new Date(now.getTime() - b.days * 86400000)),
    );
  }
  if (pastBooking) {
    bookingStmt.run(
      uid('bkg'),
      ama,
      pastBooking.id,
      refCode(),
      'Ama Serwaa',
      '+233 24 482 1190',
      1,
      JSON.stringify(['7C']),
      pastBooking.price_cents,
      'completed',
      'momo',
      iso(new Date(now.getTime() - 12 * 86400000)),
    );
  }
  if (pastBooking2) {
    bookingStmt.run(
      uid('bkg'),
      ama,
      pastBooking2.id,
      refCode(),
      'Ama Serwaa',
      '+233 24 482 1190',
      1,
      JSON.stringify(['14A']),
      pastBooking2.price_cents,
      'cancelled',
      'wallet',
      iso(new Date(now.getTime() - 21 * 86400000)),
    );
  }

  // ---- ride history
  const P = (id: string) => ACCRA_PLACES.find((p) => p.id === id)!;
  const rideTierRotation: TierId[] = ['go', 'go', 'bike', 'comfort', 'go', 'xl', 'go', 'bike', 'comfort', 'go'];
  const ridePlan: Array<{ from: string; to: string; daysAgo: number; hour: number; cancelled?: boolean; rating?: number }> = [
    { from: 'legon-main', to: 'balme', daysAgo: 2, hour: 7, rating: 5 },
    { from: 'balme', to: 'accra-mall', daysAgo: 3, hour: 18, rating: 4 },
    { from: 'legon-main', to: 'east-legon', daysAgo: 5, hour: 9, rating: 5 },
    { from: 'accra-mall', to: 'osu', daysAgo: 6, hour: 20, cancelled: true },
    { from: 'balme', to: 'labadi', daysAgo: 8, hour: 13, rating: 4 },
    { from: 'east-legon', to: 'balme', daysAgo: 10, hour: 22, rating: 5 },
    { from: 'balme', to: 'gimpa', daysAgo: 11, hour: 8, rating: 5 },
    { from: 'airport-city', to: 'balme', daysAgo: 13, hour: 6, rating: 4 },
    { from: 'legon-main', to: 'balme', daysAgo: 15, hour: 7, rating: 5 },
    { from: 'accra-mall', to: 'balme', daysAgo: 17, hour: 19, cancelled: true },
    { from: 'balme', to: 'osu', daysAgo: 19, hour: 21, rating: 5 },
    { from: 'balme', to: 'madina-market', daysAgo: 21, hour: 16, rating: 4 },
    { from: 'legon-main', to: 'accra-mall', daysAgo: 24, hour: 10, rating: 5 },
    { from: 'osu', to: 'balme', daysAgo: 27, hour: 11, rating: 5 },
    { from: 'balme', to: 'labadi', daysAgo: 30, hour: 15, rating: 4 },
    { from: 'balme', to: 'east-legon', daysAgo: 33, hour: 17, rating: 5 },
  ];

  const txns: Array<{ type: string; amount: number; desc: string; method: string; at: Date; status?: string }> = [];
  const rideStmt = db.prepare(
    `INSERT INTO rides (id, user_id, pickup_name, pickup_address, pickup_lat, pickup_lng, dropoff_name, dropoff_address, dropoff_lat, dropoff_lng, tier, distance_km, duration_min, fare_cents, status, driver_id, payment_method, scheduled_for, notes, rating, review, created_at, completed_at, is_deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  ridePlan.forEach((p, i) => {
    const from = P(p.from);
    const to = P(p.to);
    const tierId = rideTierRotation[i % rideTierRotation.length];
    const created = at(-p.daysAgo, p.hour, Math.floor(Math.random() * 50));
    const est = estimateRide(from, to, tierId, created);
    const status = p.cancelled ? 'cancelled' : 'completed';
    const driver = p.cancelled ? null : pick(driverIds);
    rideStmt.run(
      uid('rid'),
      ama,
      from.name,
      from.address,
      from.lat,
      from.lng,
      to.name,
      to.address,
      to.lat,
      to.lng,
      tierId,
      est.distanceKm,
      est.durationMin,
      est.fareCents,
      status,
      driver,
      pick(['wallet', 'momo', 'cash']),
      null,
      '',
      p.rating ?? null,
      p.rating === 5 ? 'Smooth ride, friendly driver.' : p.rating === 4 ? 'Good trip, slight delay picking me up.' : '',
      iso(created),
      p.cancelled ? null : iso(new Date(created.getTime() + est.durationMin * 60000 + 600000)),
      0,
    );
    if (!p.cancelled) {
      txns.push({ type: 'ride', amount: -est.fareCents, desc: `Ride · ${from.name} → ${to.name}`, method: 'wallet', at: created });
    }
  });

  // scheduled ride for later today
  const scheduledAt = new Date(now.getTime() + 5 * 3600000);
  const sFrom = P('balme');
  const sTo = P('airport');
  const sEst = estimateRide(sFrom, sTo, 'comfort', scheduledAt);
  rideStmt.run(
    uid('rid'),
    ama,
    sFrom.name,
    sFrom.address,
    sFrom.lat,
    sFrom.lng,
    sTo.name,
    sTo.address,
    sTo.lat,
    sTo.lng,
    'comfort',
    sEst.distanceKm,
    sEst.durationMin,
    sEst.fareCents,
    'scheduled',
    null,
    'momo',
    iso(scheduledAt),
    'Flight at 9pm — 2 bags in the boot',
    null,
    '',
    iso(new Date(now.getTime() - 3 * 3600000)),
    null,
    0,
  );

  // a live ride in progress for the driver demo user
  const liveFrom = P('upsa');
  const liveTo = P('east-legon');
  const liveEst = estimateRide(liveFrom, liveTo, 'go', now);
  rideStmt.run(
    uid('rid'),
    ama,
    liveFrom.name,
    liveFrom.address,
    liveFrom.lat,
    liveFrom.lng,
    liveTo.name,
    liveTo.address,
    liveTo.lat,
    liveTo.lng,
    'go',
    liveEst.distanceKm,
    liveEst.durationMin,
    liveEst.fareCents,
    'arriving',
    driverIds[0],
    'wallet',
    null,
    '',
    null,
    '',
    iso(new Date(now.getTime() - 25 * 60000)),
    null,
    0,
  );

  // ---- wallet + payments for Ama
  txns.push({ type: 'topup', amount: 50000, desc: 'Wallet top-up · MTN MoMo', method: 'momo', at: at(-35, 10, 12) });
  txns.push({ type: 'topup', amount: 30000, desc: 'Wallet top-up · Visa •••• 4242', method: 'card', at: at(-18, 8, 40) });
  txns.push({ type: 'refund', amount: 4500, desc: 'Refund · cancelled ride', method: 'wallet', at: at(-17, 19, 30) });
  if (b1) txns.push({ type: 'booking', amount: -b1.price, desc: 'Intercity · Accra → Kumasi', method: 'wallet', at: at(-4, 12, 10) });
  if (b2) txns.push({ type: 'booking', amount: -b2.price * 2, desc: 'Intercity · Accra → Cape Coast ×2', method: 'wallet', at: at(-6, 9, 15) });
  if (b3) txns.push({ type: 'booking', amount: -b3.price, desc: 'Intercity · Kumasi → Accra', method: 'wallet', at: at(-2, 20, 5) });
  if (pastBooking) txns.push({ type: 'booking', amount: -pastBooking.price_cents, desc: 'Intercity · Accra → Koforidua', method: 'momo', at: at(-12, 6, 45) });
  txns.push({ type: 'topup', amount: 25000, desc: 'Wallet top-up · MTN MoMo', method: 'momo', at: at(-1, 16, 22) });

  // opening balance so wallet isn't negative
  txns.push({ type: 'topup', amount: 40000, desc: 'Opening balance', method: 'momo', at: at(-45, 9, 0) });

  for (const t of txns.sort((a, b) => a.at.getTime() - b.at.getTime())) {
    run(
      `INSERT INTO transactions (id, user_id, type, amount_cents, description, method, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      uid('txn'),
      ama,
      t.type,
      t.amount,
      t.desc,
      t.method,
      t.status ?? 'completed',
      iso(t.at),
    );
  }

  const balance = (userId: string) =>
    all<{ s: number }>('SELECT COALESCE(SUM(amount_cents), 0) AS s FROM transactions WHERE user_id = ?', userId)[0]?.s ?? 0;

  const amaBalance = balance(ama);
  if (amaBalance < 25000) {
    const topUp = 25000 - amaBalance;
    run(
      `INSERT INTO transactions (id, user_id, type, amount_cents, description, method, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      uid('txn'),
      ama,
      'topup',
      topUp,
      'Wallet top-up · MTN MoMo',
      'momo',
      'completed',
      iso(at(-1, 18, 5)),
    );
  }
  run('UPDATE users SET wallet_cents = ? WHERE id = ?', Math.max(0, balance(ama)), ama);

  // Kwame + others a little float
  run(
    `INSERT INTO transactions (id, user_id, type, amount_cents, description, method, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    uid('txn'),
    kwame,
    'topup',
    20000,
    'Wallet top-up · MTN MoMo',
    'momo',
    'completed',
    iso(at(-7, 11, 0)),
  );
  run('UPDATE users SET wallet_cents = ? WHERE id = ?', 20000, kwame);
  for (const id of otherRiders) {
    run('UPDATE users SET wallet_cents = ? WHERE id = ?', 5000 + Math.floor(Math.random() * 20000), id);
  }
  run('UPDATE users SET rides_count = ? WHERE id = ?', ridePlan.filter((r) => !r.cancelled).length + 26, ama);

  // ---- payment methods
  const pm = (userId: string, kind: string, label: string, detail: string, isDefault: number, days: number) => {
    run(
      `INSERT INTO payment_methods (id, user_id, kind, label, detail, is_default, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      uid('pmt'),
      userId,
      kind,
      label,
      detail,
      isDefault,
      iso(new Date(now.getTime() - days * 86400000)),
    );
  };
  pm(ama, 'momo', 'MTN Mobile Money', '024 •••• 1190', 1, 90);
  pm(ama, 'card', 'Visa', '4242', 0, 44);
  pm(ama, 'cash', 'Cash', 'Pay driver directly', 0, 90);
  pm(kwame, 'momo', 'Vodafone Cash', '020 •••• 3320', 1, 80);

  return { seeded: true, user: 'ama@rev.app' };
}

if (process.argv[1]?.includes('seed')) {
  if (process.env.REV_RESET === '1') {
    const tables = ['sessions', 'transactions', 'payment_methods', 'bookings', 'rides', 'vehicles', 'places', 'trips', 'routes', 'drivers', 'users'];
    // The API may be serving requests at the same time; retry once on a lock.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        db.exec('BEGIN IMMEDIATE');
        for (const t of tables) db.exec(`DELETE FROM ${t}`);
        db.exec('COMMIT');
        break;
      } catch (err) {
        try {
          db.exec('ROLLBACK');
        } catch {
          /* noop */
        }
        if (attempt === 2) throw err;
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 400);
      }
    }
  }
  const res = seed();
  console.log(res.seeded ? `✓ Seeded Rev demo data (login ${res.user} / ${DEMO_PASSWORD})` : '• Database already has data — nothing to seed');
  console.log('• Trips:', all('SELECT COUNT(*) AS c FROM trips')[0].c, '| Rides:', all('SELECT COUNT(*) AS c FROM rides')[0].c, '| Bookings:', all('SELECT COUNT(*) AS c FROM bookings')[0].c);
}

export { DEMO_PASSWORD };
