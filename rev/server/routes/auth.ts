import { Router } from 'express';
import { all, get, run } from '../db.ts';
import {
  attachUser,
  clearCookie,
  createSession,
  hashPassword,
  requireAuth,
  sessionCookie,
  sessionTokenFrom,
  signup,
  verifyPassword,
  USER_COLUMNS,
  type SessionUser,
} from '../auth.ts';
import { email as emailField, str } from '../lib.ts';

export const authRouter = Router();
authRouter.use(attachUser);

function publicUser(u: SessionUser) {
  const methods = all('SELECT * FROM payment_methods WHERE user_id = ? ORDER BY is_default DESC', u.id);
  return { ...u, payment_methods: methods };
}

authRouter.get('/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: publicUser(req.user) });
});

authRouter.post('/login', (req, res) => {
  const email = emailField(req.body?.email);
  const password = str(req.body?.password, 'Password', { max: 200 });
  const row = get<SessionUser & { password_hash: string }>('SELECT * FROM users WHERE email = ?', email);
  if (!row || !verifyPassword(password, row.password_hash)) {
    return res.status(401).json({ error: 'That email and password combo does not match our records' });
  }
  const { password_hash, ...user } = row;
  const { token, expires } = createSession(user.id);
  res.setHeader('Set-Cookie', sessionCookie(token, expires));
  res.json({ user: publicUser(user as SessionUser), token });
});

authRouter.post('/signup', (req, res) => {
  const name = str(req.body?.name, 'Name', { max: 120 });
  const email = emailField(req.body?.email);
  const password = str(req.body?.password, 'Password', { max: 200 });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const existing = get('SELECT id FROM users WHERE email = ?', email);
  if (existing) return res.status(409).json({ error: 'An account with that email already exists. Try signing in.' });
  const id = signup(name, email, password, {
    role: req.body?.role,
    phone: typeof req.body?.phone === 'string' ? req.body.phone.slice(0, 40) : '',
    university: typeof req.body?.university === 'string' ? req.body.university.slice(0, 120) : '',
    campus: typeof req.body?.campus === 'string' ? req.body.campus.slice(0, 120) : '',
  });
  const user = get<SessionUser>(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`, id)!;
  const { token, expires } = createSession(id);
  res.setHeader('Set-Cookie', sessionCookie(token, expires));
  res.status(201).json({ user: publicUser(user), token });
});

authRouter.post('/demo', (_req, res) => {
  const user = get<SessionUser>(`SELECT ${USER_COLUMNS} FROM users WHERE email = ?`, 'ama@rev.app');
  if (!user) return res.status(500).json({ error: 'Demo account is not seeded yet' });
  const { token, expires } = createSession(user.id);
  res.setHeader('Set-Cookie', sessionCookie(token, expires));
  res.json({ user: publicUser(user), token });
});

authRouter.post('/logout', (req, res) => {
  const token = sessionTokenFrom(req);
  if (token) run('DELETE FROM sessions WHERE token = ?', token);
  res.setHeader('Set-Cookie', clearCookie());
  res.json({ ok: true });
});

authRouter.post('/change-password', requireAuth, (req, res) => {
  const current = str(req.body?.current_password, 'Current password');
  const next = str(req.body?.new_password, 'New password');
  if (next.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  const row = get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', req.user!.id)!;
  if (!verifyPassword(current, row.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(next), req.user!.id);
  res.json({ ok: true });
});

authRouter.get('/sessions', requireAuth, (req, res) => {
  res.json({ sessions: all('SELECT token, created_at, expires_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC', req.user!.id) });
});

authRouter.delete('/sessions', requireAuth, (req, res) => {
  run('DELETE FROM sessions WHERE user_id = ?', req.user!.id);
  res.setHeader('Set-Cookie', clearCookie());
  res.json({ ok: true });
});

export { publicUser };
