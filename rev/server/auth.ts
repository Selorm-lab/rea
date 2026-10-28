import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { get, nowIso, run, uid } from './db.ts';

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'rider' | 'driver' | 'operator';
  avatar_color: string;
  university: string;
  campus: string;
  bio: string;
  wallet_cents: number;
  rating: number;
  rides_count: number;
  notif_email: number;
  notif_push: number;
  notif_deals: number;
  created_at: string;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}

export const USER_COLUMNS = `id, name, email, phone, role, avatar_color, university, campus, bio,
  wallet_cents, rating, rides_count, notif_email, notif_push, notif_deals, created_at`;

const COOKIE = 'rev_session';
const SESSION_DAYS = 30;

export function parseCookies(req: Request): Record<string, string> {
  const raw = req.headers.cookie;
  if (!raw) return {};
  return raw.split(';').reduce<Record<string, string>>((acc, part) => {
    const idx = part.indexOf('=');
    if (idx > -1) acc[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    return acc;
  }, {});
}

export function createSession(userId: string): { token: string; expires: Date } {
  const token = randomBytes(24).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  run(
    'INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
    token,
    userId,
    expires.toISOString(),
    nowIso(),
  );
  return { token, expires };
}

/**
 * Sessions travel two ways so the app works both as a normal same-origin site
 * (HttpOnly cookie) and inside cross-site preview iframes where third-party
 * cookies are blocked (Authorization header).
 */
export function sessionTokenFrom(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  return parseCookies(req)[COOKIE];
}

export function attachUser(req: Request, _res: Response, next: NextFunction) {
  const token = sessionTokenFrom(req);
  if (!token) return next();
  const columns = USER_COLUMNS.split(',')
    .map((c) => `u.${c.trim()}`)
    .join(', ');
  const row = get<SessionUser & { expires_at: string }>(
    `SELECT ${columns}, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`,
    token,
  );
  if (row && new Date(row.expires_at).getTime() > Date.now()) {
    const { expires_at, ...user } = row;
    req.user = user as SessionUser;
  }
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Not signed in' });
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Not signed in' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have access to this area' });
    }
    next();
  };
}

export function sessionCookie(token: string, expires: Date): string {
  const secure = process.env.NODE_ENV === 'production' && process.env.REV_SECURE_COOKIE === '1';
  return [
    `${COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${expires.toUTCString()}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

export function clearCookie(): string {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function signup(
  name: string,
  email: string,
  password: string,
  opts: { role?: string; phone?: string; university?: string; campus?: string } = {},
) {
  const id = uid('usr');
  const colors = ['#0FA968', '#2563EB', '#DB2777', '#F59E0B', '#7C3AED', '#0891B2', '#EA580C'];
  run(
    `INSERT INTO users (id, name, email, phone, password_hash, role, avatar_color, university, campus, wallet_cents, rating, rides_count, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    name,
    email.toLowerCase(),
    opts.phone ?? '',
    hashPassword(password),
    opts.role === 'driver' ? 'driver' : 'rider',
    colors[Math.floor(Math.random() * colors.length)],
    opts.university ?? '',
    opts.campus ?? '',
    15000,
    5.0,
    0,
    nowIso(),
  );
  return id;
}
