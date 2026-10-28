import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.REV_DB ?? resolve(here, '../data/rev.db');
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'rider',
  avatar_color TEXT NOT NULL DEFAULT '#0FA968',
  university TEXT NOT NULL DEFAULT '',
  campus TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  wallet_cents INTEGER NOT NULL DEFAULT 0,
  rating REAL NOT NULL DEFAULT 5.0,
  rides_count INTEGER NOT NULL DEFAULT 0,
  notif_email INTEGER NOT NULL DEFAULT 1,
  notif_push INTEGER NOT NULL DEFAULT 1,
  notif_deals INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'pin',
  notes TEXT NOT NULL DEFAULT '',
  lat REAL NOT NULL DEFAULT 5.6037,
  lng REAL NOT NULL DEFAULT -0.1870,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS vehicles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  plate TEXT NOT NULL,
  color TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'economy',
  seats INTEGER NOT NULL DEFAULT 4,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drivers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  vehicle TEXT NOT NULL,
  plate TEXT NOT NULL,
  rating REAL NOT NULL DEFAULT 4.9,
  trips INTEGER NOT NULL DEFAULT 0,
  avatar_color TEXT NOT NULL DEFAULT '#0E7490',
  tier TEXT NOT NULL DEFAULT 'go'
);

CREATE TABLE IF NOT EXISTS rides (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pickup_name TEXT NOT NULL,
  pickup_address TEXT NOT NULL,
  pickup_lat REAL NOT NULL DEFAULT 5.6037,
  pickup_lng REAL NOT NULL DEFAULT -0.187,
  dropoff_name TEXT NOT NULL,
  dropoff_address TEXT NOT NULL,
  dropoff_lat REAL NOT NULL DEFAULT 5.6037,
  dropoff_lng REAL NOT NULL DEFAULT -0.187,
  tier TEXT NOT NULL DEFAULT 'go',
  distance_km REAL NOT NULL,
  duration_min INTEGER NOT NULL,
  fare_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'searching',
  driver_id TEXT REFERENCES drivers(id) ON DELETE SET NULL,
  payment_method TEXT NOT NULL DEFAULT 'wallet',
  scheduled_for TEXT,
  notes TEXT NOT NULL DEFAULT '',
  rating INTEGER,
  review TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  completed_at TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY,
  from_city TEXT NOT NULL,
  to_city TEXT NOT NULL,
  distance_km REAL NOT NULL,
  duration_min INTEGER NOT NULL,
  base_price_cents INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  operator TEXT NOT NULL,
  vehicle_type TEXT NOT NULL DEFAULT 'Coach',
  depart_at TEXT NOT NULL,
  arrive_at TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  total_seats INTEGER NOT NULL DEFAULT 32,
  amenities TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_by TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  reference TEXT NOT NULL UNIQUE,
  passenger_name TEXT NOT NULL,
  passenger_phone TEXT NOT NULL,
  seats INTEGER NOT NULL DEFAULT 1,
  seat_labels TEXT NOT NULL DEFAULT '[]',
  total_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  payment_method TEXT NOT NULL DEFAULT 'wallet',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  description TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'wallet',
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rides_user ON rides(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_depart ON trips(depart_at);
CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id);
`;

/** Add columns introduced after the first release to existing databases. */
function migrate() {
  const cols = new Set(
    (db.prepare('PRAGMA table_info(rides)').all() as Array<{ name: string }>).map((r) => r.name),
  );
  for (const col of ['pickup_lat', 'pickup_lng', 'dropoff_lat', 'dropoff_lng']) {
    if (!cols.has(col)) db.exec(`ALTER TABLE rides ADD COLUMN ${col} REAL NOT NULL DEFAULT 5.6037`);
  }
}

export function initSchema() {
  db.exec(SCHEMA);
  migrate();
}

export function all<T = any>(sql: string, ...params: any[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function get<T = any>(sql: string, ...params: any[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function run(sql: string, ...params: any[]) {
  return db.prepare(sql).run(...params);
}

export function tx<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function isEmpty(table: string): boolean {
  try {
    const row = get<{ c: number }>(`SELECT COUNT(*) AS c FROM ${table}`);
    return !row || row.c === 0;
  } catch {
    return true;
  }
}
