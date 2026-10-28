import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Info, X, TriangleAlert } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
type Toast = { id: number; message: string; kind: ToastKind; leaving?: boolean };

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 190);
  }, []);

  const push = useCallback(
    (message: string, kind: ToastKind) => {
      const id = ++counter.current;
      setToasts((prev) => [...prev.slice(-3), { id, message, kind }]);
      setTimeout(() => remove(id), kind === 'error' ? 6000 : 4200);
    },
    [remove],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (m: string) => push(m, 'success'),
      error: (m: string) => push(m, 'error'),
      info: (m: string) => push(m, 'info'),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind} ${t.leaving ? 'leaving' : ''}`}>
            <span className="toast-icon">
              {t.kind === 'success' ? <Check size={13} strokeWidth={3} /> : t.kind === 'error' ? <TriangleAlert size={13} /> : <Info size={13} />}
            </span>
            <span className="grow">{t.message}</span>
            <button className="close" onClick={() => remove(t.id)} aria-label="Dismiss">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
