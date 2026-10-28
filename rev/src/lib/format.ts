export { formatGhs, formatKm, formatDuration, formatGhs as money } from '../../shared/travel';

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function formatDate(iso: string, opts: Intl.DateTimeFormatOptions = {}) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...opts });
}

export function formatDateLong(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
}

export function dayName(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short' });
}

export function isToday(iso: string) {
  const d = new Date(iso);
  const n = new Date();
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}

export function isTomorrow(iso: string) {
  const d = new Date(iso);
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear();
}

export function friendlyDay(iso: string) {
  if (isToday(iso)) return 'Today';
  if (isTomorrow(iso)) return 'Tomorrow';
  return formatDate(iso, { weekday: 'short' });
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 35) return `${Math.round(days / 7)}w ago`;
  return formatDate(iso);
}

export function countdown(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const mins = Math.round(diff / 60000);
  if (mins < 0) return 'departed';
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours < 24) return `in ${hours}h${rem ? ` ${rem}m` : ''}`;
  const days = Math.floor(hours / 24);
  return `in ${days}d ${hours % 24}h`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function toDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toDateTimeInput(d: Date) {
  return `${toDateInput(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function addDays(d: Date, days: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

export function co2Label(grams: number) {
  return grams >= 1000 ? `${(grams / 1000).toFixed(1)} kg` : `${Math.round(grams)} g`;
}

export function paymentLabel(method: string) {
  return method === 'momo' ? 'Mobile Money' : method === 'card' ? 'Card' : method === 'cash' ? 'Cash' : 'Wallet';
}

export function amenityLabel(key: string) {
  const map: Record<string, string> = {
    wifi: 'Wi-Fi',
    ac: 'A/C',
    usb: 'USB',
    reclining: 'Reclining',
    snack: 'Snacks',
    toilet: 'Onboard WC',
    entertainment: 'TV',
  };
  return map[key] ?? key;
}
