import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Star, X, Inbox } from 'lucide-react';
import { initials } from '../lib/format';

/* ------------------------------- button ------------------------------- */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'soft' | 'dark' | 'danger' | 'lime';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({ variant = 'primary', size = 'md', block, loading, icon, children, className = '', disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={`btn ${variant === 'primary' ? '' : variant} ${size === 'md' ? '' : size} ${block ? 'block' : ''} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 size={16} className="spin" style={{ animation: 'spin 0.9s linear infinite' }} /> : icon}
      {children}
    </button>
  );
}

/* -------------------------------- card -------------------------------- */
export function Card({ children, className = '', pad = true, hover = false, ...rest }: { children: ReactNode; className?: string; pad?: boolean; hover?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`card ${pad ? 'pad' : ''} ${hover ? 'hover' : ''} ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="row-between mb-3">
      <div>
        <div className="card-title">{title}</div>
        {sub ? <div className="small muted mt-1">{sub}</div> : null}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------- fields ------------------------------- */
export function Field({ label, hint, error, children, htmlFor }: { label?: string; hint?: string; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      {label ? (
        <label className="label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : null}
      {children}
      {error ? <span className="error-text">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function Input({ className = '', invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={`input ${invalid ? 'err' : ''} ${className}`} {...rest} />;
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`textarea ${className}`} {...rest} />;
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`select ${className}`} {...rest}>
      {children}
    </select>
  );
}

/* -------------------------------- badge -------------------------------- */
export function Badge({
  children,
  tone = 'default',
  className = '',
  style,
}: {
  children: ReactNode;
  tone?: 'default' | 'green' | 'amber' | 'red' | 'blue' | 'ink' | 'outline';
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span className={`badge ${tone === 'default' ? '' : tone} ${className}`} style={style}>
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { tone: 'green' | 'amber' | 'red' | 'blue' | 'ink' | 'default'; label: string }> = {
    completed: { tone: 'green', label: 'Completed' },
    arriving: { tone: 'amber', label: 'Driver arriving' },
    in_progress: { tone: 'blue', label: 'On trip' },
    searching: { tone: 'amber', label: 'Finding driver' },
    scheduled: { tone: 'blue', label: 'Scheduled' },
    cancelled: { tone: 'red', label: 'Cancelled' },
    confirmed: { tone: 'green', label: 'Confirmed' },
    departed: { tone: 'default', label: 'Departed' },
  };
  const item = map[status] ?? { tone: 'default' as const, label: status };
  return (
    <Badge tone={item.tone}>
      <span className="dot" />
      {item.label}
    </Badge>
  );
}

/* ------------------------------- avatar ------------------------------- */
export function Avatar({ name, color = '#0FA968', size = 38, ring }: { name: string; color?: string; size?: number; ring?: boolean }) {
  return (
    <span
      className={`avatar ${ring ? 'ring' : ''}`}
      style={{ width: size, height: size, background: color, fontSize: Math.round(size * 0.36) }}
      aria-hidden="true"
    >
      {initials(name) || '?'}
    </span>
  );
}

/* ------------------------------- modal -------------------------------- */
export function Modal({
  open,
  onClose,
  title,
  sub,
  children,
  footer,
  size,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'lg';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size === 'lg' ? 'lg' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} ref={ref}>
        <div className="modal-head">
          <div>
            <h3 id={titleId} style={{ fontSize: 19 }}>
              {title}
            </h3>
            {sub ? <div className="small muted mt-1">{sub}</div> : null}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close dialog" style={{ border: 0 }}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel = 'Confirm',
  danger,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Keep it
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="muted" style={{ fontSize: 14.5, lineHeight: 1.6 }}>
        {body}
      </div>
    </Modal>
  );
}

/* -------------------------------- toggle ------------------------------- */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`toggle ${checked ? 'on' : ''}`}
      onClick={() => onChange(!checked)}
    />
  );
}

/* --------------------------------- tabs -------------------------------- */
export function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string; count?: number }> }) {
  return (
    <div className="tabs" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          className={`tab ${value === o.value ? 'active' : ''}`}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {typeof o.count === 'number' ? <span style={{ marginLeft: 6, color: 'var(--muted-2)', fontWeight: 700 }}>{o.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ empty state ---------------------------- */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon ?? <Inbox size={26} />}</div>
      <h3>{title}</h3>
      {description ? <p>{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/* ------------------------------- skeleton ------------------------------ */
export function Skeleton({ h = 12, w = '100%', circle = false, className = '', style }: { h?: number; w?: number | string; circle?: boolean; className?: string; style?: React.CSSProperties }) {
  return <div className={`sk ${circle ? 'circle' : ''} ${className}`} style={{ height: h, width: w, ...style }} aria-hidden="true" />;
}

export function ListSkeleton({ rows = 3, map }: { rows?: number; map?: boolean }) {
  return (
    <div className="col gap-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card pad-sm" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <Skeleton h={42} w={42} circle />
          <div className="grow col gap-2">
            <Skeleton h={13} w={`${55 + ((i * 13) % 30)}%`} />
            <Skeleton h={10} w={`${35 + ((i * 7) % 20)}%`} />
          </div>
          {map ? <Skeleton h={26} w={70} /> : <Skeleton h={30} w={90} />}
        </div>
      ))}
    </div>
  );
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid four">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="stat">
          <Skeleton h={11} w="45%" />
          <Skeleton h={26} w="62%" />
          <Skeleton h={10} w="36%" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- stat card ----------------------------- */
export function StatCard({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="stat">
      <div className="row-between">
        <span className="stat-label">{label}</span>
        {icon ? <span className="stat-icon">{icon}</span> : null}
      </div>
      <span className="stat-value">{value}</span>
      {hint ? <span className="tiny muted">{hint}</span> : null}
    </div>
  );
}

/* -------------------------------- stars -------------------------------- */
export function Stars({ value, onChange, size = 22 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="stars" role={onChange ? 'radiogroup' : undefined} aria-label={onChange ? 'Rate your ride' : `${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button key={n} type="button" className={`star-btn ${n <= value ? 'on' : ''}`} onClick={() => onChange(n)} aria-label={`${n} star${n > 1 ? 's' : ''}`} role="radio" aria-checked={n === value}>
            <Star size={size} fill={n <= value ? 'currentColor' : 'none'} strokeWidth={1.8} />
          </button>
        ) : (
          <span key={n} className={`star-btn ${n <= value ? 'on' : ''}`} style={{ cursor: 'default' }}>
            <Star size={size} fill={n <= value ? 'currentColor' : 'none'} strokeWidth={1.8} />
          </span>
        ),
      )}
    </div>
  );
}

/* -------------------------------- misc --------------------------------- */
export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub ? <p className="page-sub">{sub}</p> : null}
      </div>
      {actions ? <div className="row gap-2 wrap">{actions}</div> : null}
    </div>
  );
}

export function Spinner({ size = 16, label }: { size?: number; label?: string }) {
  return (
    <span className="row gap-2" role="status">
      <Loader2 size={size} style={{ animation: 'spin 0.9s linear infinite' }} />
      {label ? <span className="small muted">{label}</span> : null}
    </span>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: Array<{ value: T; label: string; icon?: ReactNode }> }) {
  return (
    <div className="chips" style={{ background: '#f1f4ef', padding: 4, borderRadius: 12, display: 'inline-flex' }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`chip ${value === o.value ? 'active' : ''}`}
          style={{ border: 0, background: value === o.value ? '#fff' : 'transparent', color: value === o.value ? 'var(--ink)' : 'var(--muted)', boxShadow: value === o.value ? 'var(--shadow-xs)' : 'none' }}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, tone }: { value: number; tone?: 'amber' | 'red' }) {
  return (
    <div className={`progress ${tone ?? ''}`} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function IconButton(props: ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean; label: string }) {
  const { danger, label, className = '', children, ...rest } = props;
  return (
    <button className={`icon-btn ${danger ? 'danger' : ''} ${className}`} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

export const keyframes = `
@keyframes spin { to { transform: rotate(360deg); } }
`;
