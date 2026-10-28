import type { NextFunction, Request, Response } from 'express';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function bad(message: string): never {
  throw new HttpError(400, message);
}
export function notFound(message = 'Not found'): never {
  throw new HttpError(404, message);
}

export function str(v: unknown, field: string, { max = 500, optional = false, trim = true } = {}): string {
  if (v === undefined || v === null) {
    if (optional) return '';
    bad(`${field} is required`);
  }
  if (typeof v !== 'string') bad(`${field} must be text`);
  const out = trim ? v.trim() : v;
  if (!optional && out.length === 0) bad(`${field} is required`);
  if (out.length > max) bad(`${field} is too long (max ${max})`);
  return out;
}

export function email(v: unknown): string {
  const out = str(v, 'Email', { max: 200 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(out)) bad('Enter a valid email address');
  return out;
}

export function num(v: unknown, field: string, { min = -Infinity, max = Infinity, optional = false } = {}): number {
  if ((v === undefined || v === null || v === '') && optional) return NaN;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) bad(`${field} must be a number`);
  if (n < min || n > max) bad(`${field} must be between ${min} and ${max}`);
  return n;
}

export function oneOf<T extends string>(v: unknown, allowed: readonly T[], field: string): T {
  if (typeof v !== 'string' || !allowed.includes(v as T)) bad(`${field} must be one of: ${allowed.join(', ')}`);
  return v as T;
}

export function parseJsonArray(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function asyncRoute(fn: (req: Request, res: Response, next: NextFunction) => unknown) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
