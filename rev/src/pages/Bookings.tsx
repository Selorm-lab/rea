import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Bus, CalendarDays, Clock, MapPin, Ticket, Trash2, Users, XCircle } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useToast } from '../lib/toast';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ListSkeleton, StatusBadge, Tabs } from '../components/ui';
import { countdown, formatDateLong, formatDuration, formatGhs, formatTime, paymentLabel } from '../lib/format';

type Booking = {
  id: string;
  reference: string;
  passenger_name: string;
  passenger_phone: string;
  seats: number;
  seat_labels: string[];
  total_cents: number;
  status: 'confirmed' | 'cancelled' | 'completed';
  payment_method: string;
  created_at: string;
  depart_at: string;
  arrive_at: string;
  operator: string;
  vehicle_type: string;
  from_city: string;
  to_city: string;
  duration_min: number;
};

type Tab = 'upcoming' | 'past' | 'cancelled' | 'all';

export default function Bookings() {
  const navigate = useNavigate();
  const toast = useToast();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const d = await api.get<{ bookings: Booking[] }>('/intercity/bookings');
      setBookings(d.bookings);
      setError('');
    } catch (err: any) {
      setError(err?.message ?? 'Could not load your bookings');
      setBookings([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const now = Date.now();
  const buckets = {
    upcoming: (b: Booking) => b.status === 'confirmed' && new Date(b.depart_at).getTime() > now,
    past: (b: Booking) => b.status === 'completed' || (b.status === 'confirmed' && new Date(b.depart_at).getTime() <= now),
    cancelled: (b: Booking) => b.status === 'cancelled',
    all: () => true,
  };
  const shown = (bookings ?? []).filter(buckets[tab]);

  const cancel = async () => {
    if (!cancelTarget) return;
    const target = cancelTarget;
    const previous = bookings ?? [];
    setCancelTarget(null);
    setBusy(true);
    setBookings(previous.map((b) => (b.id === target.id ? { ...b, status: 'cancelled' } : b)));
    try {
      const res = await api.patch<{ booking: Booking }>(`/intercity/bookings/${target.id}`, { status: 'cancelled' });
      const hoursToGo = (new Date(target.depart_at).getTime() - Date.now()) / 3600000;
      const refund = hoursToGo > 24 ? target.total_cents : Math.round(target.total_cents * 0.5);
      setBookings((cur) => (cur ?? []).map((b) => (b.id === target.id ? res.booking : b)));
      toast.success(`${formatGhs(refund)} refunded to your Rev wallet`);
    } catch (err) {
      setBookings(previous);
      toast.error(err instanceof ApiError ? err.message : 'Could not cancel this booking');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const previous = bookings ?? [];
    setDeleteTarget(null);
    setBusy(true);
    setBookings(previous.filter((b) => b.id !== target.id));
    try {
      await api.del(`/intercity/bookings/${target.id}`);
      toast.success('Booking removed from your history');
    } catch (err) {
      setBookings(previous);
      toast.error(err instanceof ApiError ? err.message : 'Could not remove this booking');
    } finally {
      setBusy(false);
    }
  };

  const counts = bookings
    ? {
        upcoming: bookings.filter(buckets.upcoming).length,
        past: bookings.filter(buckets.past).length,
        cancelled: bookings.filter(buckets.cancelled).length,
        all: bookings.length,
      }
    : undefined;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">My bookings</h1>
          <p className="page-sub">Every coach seat you've reserved, with references ready for boarding.</p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/app/intercity')} icon={<Bus size={15} />}>
          Find departures
        </Button>
      </div>

      <Card className="mb-3" pad={false} style={{ padding: '0 16px' }}>
        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'upcoming', label: 'Upcoming', count: counts?.upcoming },
            { value: 'past', label: 'Past', count: counts?.past },
            { value: 'cancelled', label: 'Cancelled', count: counts?.cancelled },
            { value: 'all', label: 'All', count: counts?.all },
          ]}
        />
      </Card>

      {error ? <div className="notice red mb-3">{error}</div> : null}

      {bookings === null ? (
        <div className="grid two">
          <ListSkeleton rows={2} />
          <ListSkeleton rows={2} />
        </div>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Ticket size={24} />}
            title={
              tab === 'upcoming'
                ? 'No upcoming trips'
                : tab === 'past'
                  ? 'No past trips yet'
                  : tab === 'cancelled'
                    ? 'Nothing cancelled'
                    : 'No bookings yet'
            }
            description={
              tab === 'upcoming'
                ? 'Book a coach to Kumasi, Cape Coast or Tamale and your seat will show up here.'
                : 'Once you travel with Rev, your trip history lands here with receipts.'
            }
            action={
              <Button onClick={() => navigate('/app/intercity')} icon={<ArrowRight size={15} />}>
                Browse departures
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid two">
          {shown.map((b) => {
            const departed = new Date(b.depart_at).getTime() < Date.now();
            return (
              <Card key={b.id} className="col" style={{ gap: 14 }}>
                <div className="row-between gap-2">
                  <div className="row gap-2">
                    <Badge tone="green">
                      <Bus size={12} /> {b.operator}
                    </Badge>
                    <StatusBadge status={b.status} />
                  </div>
                  <span className="mono tiny" style={{ fontWeight: 700, color: 'var(--muted)' }}>
                    {b.reference}
                  </span>
                </div>

                <div>
                  <div className="row-between">
                    <div>
                      <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.03em' }}>{b.from_city}</div>
                      <div className="tiny muted">
                        {formatTime(b.depart_at)} · {formatDateLong(b.depart_at)}
                      </div>
                    </div>
                    <div className="col" style={{ alignItems: 'center', flex: 1, padding: '0 12px' }}>
                      <div className="row gap-1 tiny muted">
                        <Clock size={11} /> {formatDuration(b.duration_min)}
                      </div>
                      <div className="path-line" style={{ width: '100%' }} />
                      <div className="tiny muted">{b.vehicle_type}</div>
                    </div>
                    <div className="right">
                      <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: '-0.03em' }}>{b.to_city}</div>
                      <div className="tiny muted">{formatTime(b.arrive_at)}</div>
                    </div>
                  </div>
                </div>

                <hr className="divider" />

                <div className="row-between gap-2 wrap">
                  <div className="col gap-1">
                    <span className="tiny muted">
                      <Users size={11} style={{ verticalAlign: -1 }} /> Seats {b.seat_labels.join(', ') || '—'} · {b.seats} passenger{b.seats > 1 ? 's' : ''}
                    </span>
                    <span className="tiny muted">
                      {b.passenger_name} · paid with {paymentLabel(b.payment_method)}
                    </span>
                  </div>
                  <div className="right">
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{formatGhs(b.total_cents)}</div>
                    {b.status === 'confirmed' && !departed ? <span className="tiny" style={{ color: 'var(--green-700)', fontWeight: 700 }}>{countdown(b.depart_at)}</span> : null}
                  </div>
                </div>

                <div className="row gap-2 wrap">
                  {b.status === 'confirmed' && !departed ? (
                    <Button variant="ghost" size="sm" onClick={() => setCancelTarget(b)} icon={<XCircle size={14} />}>
                      Cancel booking
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={() => navigate('/app/intercity')} icon={<CalendarDays size={14} />}>
                    Book again
                  </Button>
                  {b.status !== 'confirmed' ? (
                    <Button variant="ghost" size="sm" style={{ color: 'var(--red)' }} onClick={() => setDeleteTarget(b)} icon={<Trash2 size={14} />}>
                      Remove
                    </Button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={cancel}
        loading={busy}
        danger
        title="Cancel this booking?"
        confirmLabel="Cancel booking"
        body={
          cancelTarget ? (
            <>
              <p>
                {cancelTarget.from_city} → {cancelTarget.to_city} on {formatDateLong(cancelTarget.depart_at)}.
              </p>
              <p className="mt-2">
                {(new Date(cancelTarget.depart_at).getTime() - Date.now()) / 3600000 > 24
                  ? `You're more than 24h out, so ${formatGhs(cancelTarget.total_cents)} goes straight back to your Rev wallet.`
                  : `This is inside 24 hours, so 50% (${formatGhs(Math.round(cancelTarget.total_cents * 0.5))}) is refunded to your wallet.`}
              </p>
              <p className="tiny muted mt-2">
                <MapPin size={11} style={{ verticalAlign: -1 }} /> Seats {cancelTarget.seat_labels.join(', ')} will be released for other passengers.
              </p>
            </>
          ) : null
        }
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        loading={busy}
        danger
        title="Remove from history?"
        confirmLabel="Remove booking"
        body="This deletes the booking record from your history. Receipts in your wallet statement are kept for your records."
      />
    </div>
  );
}
