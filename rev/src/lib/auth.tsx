import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError, setToken } from './api';

export type PaymentMethod = {
  id: string;
  kind: 'momo' | 'card' | 'cash';
  label: string;
  detail: string;
  is_default: number;
};

export type User = {
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
  payment_methods?: PaymentMethod[];
};

type AuthValue = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  signup: (data: { name: string; email: string; password: string; university?: string; campus?: string; phone?: string }) => Promise<User>;
  demoLogin: () => Promise<User>;
  logout: () => Promise<void>;
  patchUser: (patch: Partial<User>) => void;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<{ user: User | null }>('/auth/me');
      setUser(data.user);
    } catch (err) {
      if (err instanceof ApiError && err.status !== 401) console.error(err);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api.post<{ user: User; token?: string }>('/auth/login', { email, password });
    if (data.token) setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const signup = useCallback<AuthValue['signup']>(async (payload) => {
    const data = await api.post<{ user: User; token?: string }>('/auth/signup', payload);
    if (data.token) setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const demoLogin = useCallback(async () => {
    const data = await api.post<{ user: User; token?: string }>('/auth/demo');
    if (data.token) setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setToken(null);
      setUser(null);
    }
  }, []);

  const patchUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, signup, demoLogin, logout, patchUser, refresh }),
    [user, loading, login, signup, demoLogin, logout, patchUser, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
