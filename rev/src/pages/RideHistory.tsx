import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  Clock,
  Navigation,
  RotateCcw,
  Search,
  Star,
  Trash2,
  XCircle,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useToast } from '../lib/toast';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ListSkeleton, StatusBadge, Tabs } from '../components/ui';
import { RateRideModal, type Ride } from '../components/RideBits';
import { formatDateLong, formatGhs, formatTime, paymentLabel, relativeTime } from '../lib/format';
import { ACCRA_PLACES } from '../../shared/travel';

type Tab = 'all' | 'upcoming' | 'completed' | 'cancelled';

type RideWithCoords = Ride & { pickup_lat?: number; pickup_lng?: number; dropoff_lat?: number; dropoff_lng?: number };

function spotFor(name: string, address: string) {
  const found = ACCRA_PLACES.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (found) return { name: found.name, address: found.address, lat: found.lat, lng: found.lng };
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 100000;
  return { name, address, lat: 5.55 + ((hash % 90) / 1000), lng: -0.24 + ((hash % 70) / 1000) };
}

export default function RideHistory() {
  const navigate = useNavigate();
  const toast = useToast();
  const [rides, setRides] = useState<Ride[] | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [rateTarget, setRateTarget] = useState<Ride | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Ride | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Ride | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.get<{ rides: Ride[] }>('/rides?limit=150');
      setRides(d.rides);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load your rides');
      setRides([]);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!rides) return [];
    const q = query.trim().toLowerCase();
    return rides.filter((r) => {
      const matchTab =
        tab === 'all'
          ? true
          : tab === 'upcoming'
            ? ['scheduled', 'searching', 'arriving', 'in_progress'].includes(r.status)
            : tab === 'completed'
              ? r.status === 'completed'
              : r.status === 'cancelled';
      const matchQ =
        !q ||
        r.pickup_name.toLowerCase().includes(q) ||
        r.dropoff_name.toLowerCase().includes(q) ||
        r.pickup_address.toLowerCase().includes(q) ||
        r.dropoff_address.toLowerCase().includes(q);
      return matchTab && matchQ;
    });
  }, [rides, tab, query]);

  const counts = rides
    ? {
        all: rides.length,
        upcoming: rides.filter((r) => ['scheduled', 'searching', 'arriving', 'in_progress'].includes(r.status)).length,
        completed: rides.filter((r) => r.status === 'completed').length,
        cancelled: rides.filter((r) => r.status === 'cancelled').length,
      }
    : undefined;

  const cancel = async () => {
    if (!cancelTarget) return;
    const target = cancelTarget;
    const prev = rides ?? [];
    setCancelTarget(null);
    setBusy(true);
    setRides(prev.map((r) => (r.id === target.id ? { ...r, status: 'cancelled' } : r)));
    try {
      await api.patch(`/rides/${target.id}`, { status: 'cancelled' });
      toast.success('Ride cancelled');
    } catch (err) {
      setRides(prev);
      toast.error(err instanceof ApiError ? err.message : 'Could not cancel this ride');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const prev = rides ?? [];
    setDeleteTarget(null);
    setBusy(true);
    setRides(prev.filter((r) => r.id !== target.id));
    try {
      await api.del(`/rides/${target.id}`);
      toast.success('Ride removed from history');
    } catch (err) {
      setRides(prev);
      toast.error(err instanceof ApiError ? err.message : 'Could not remove this ride');
    } finally {
      setBusy(false);
    }
  };

  const bookAgain = (r: RideWithCoords) => {
    const pickup =
      typeof r.pickup_lat === 'number' ? { name: r.pickup_name, address: r.pickup_address, lat: r.pickup_lat, lng: r.pickup_lng! } : spotFor(r.pickup_name, r.pickup_address);
    const dropoff =
      typeof r.dropoff_lat === 'number' ? { name: r.dropoff_name, address: r.dropoff_address, lat: r.dropoff_lat, lng: r.dropoff_lng! } : spotFor(r.dropoff_name, r.dropoff_address);
    navigate('/app/ride', { state: { pickup, dropoff, tier: r.tier } });
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Ride history</h1>
          <p className="page-sub">Receipts, ratings and one-tap rebooking for every Rev trip.</p>
        </div>
        <Button onClick={() => navigate('/app/ride')} icon={<Navigation size={15} />}>
          Book a ride
        </Button>
      </div>

      <Card className="mb-3" pad={false}>
        <div className="row-between gap-3 wrap" style={{ padding: '0 16px' }}>
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: 'all', label: 'All rides', count: counts?.all },
              { value: 'upcoming', label: 'Upcoming', count: counts?.upcoming },
              { value: 'completed', label: 'Completed', count: counts?.completed },
              { value: 'cancelled', label: 'Cancelled', count: counts?.cancelled },
            ]}
          />
          <div className="search-field" style={{ marginBottom: 6, marginTop: 6 }}>
            <Search size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search pickup or destination" aria-label="Search rides" />
          </div>
        </div>
      </Card>

      {rides === null ? (
        <ListSkeleton rows={5} map />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={query ? <Search size={24} /> : <Navigation size={24} />}
            title={query ? 'No rides match that search' : tab === 'upcoming' ? 'No upcoming rides' : 'No rides here yet'}
            description={
              query
                ? 'Try a different pickup or destination — for example “Balme” or “Madina”.'
                : 'Your Rev trips will appear here with fare breakdowns and driver details.'
            }
            action={
              query ? (
                <Button variant="ghost" onClick={() => setQuery('')}>
                  Clear search
                </Button>
              ) : (
                <Button onClick={() => navigate('/app/ride')} icon={<Navigation size={15} />}>
                  Book your first ride
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <div className="col gap-3">
          {filtered.map((r) => {
            const upcoming = ['scheduled', 'searching', 'arriving', 'in_progress'].includes(r.status);
            return (
              <Card key={r.id} className="col" style={{ gap: 13 }}>
                <div className="row-between gap-3 wrap">
                  <div className="row gap-2 wrap">
                    <StatusBadge status={r.status} />
                    <Badge tone="outline">
                      {r.tier_emoji} {r.tier_name}
                    </Badge>
                    {r.scheduled_for && r.status === 'scheduled' ? (
                      <Badge tone="blue">
                        <CalendarClock size={11} /> {formatTime(r.scheduled_for)} · {formatDateLong(r.scheduled_for)}
                      </Badge>
                    ) : null}
                  </div>
                  <span className="tiny muted">
                    {relativeTime(r.created_at)} · {r.distance_km} km · {r.duration_min} min
                  </span>
                </div>

                <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
                  <div className="col" style={{ gap: 4, paddingTop: 5 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 99, background: 'var(--green)' }} />
                    <span style={{ width: 2, height: 26, background: 'var(--line)', marginLeft: 3.5 }} />
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--ink)' }} />
                  </div>
                  <div className="col gap-3 grow" style={{ minWidth: 0 }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>{r.pickup_name}</div>
                      <div className="tiny muted truncate">{r.pickup_address}</div>
                    </div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{r.dropoff_name}</div>
                      <div className="tiny muted truncate">{r.dropoff_address}</div>
                    </div>
                  </div>
                  <div className="right col gap-1" style={{ alignItems: 'flex-end' }}>
                    <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.03em' }}>{formatGhs(r.fare_cents)}</span>
                    <span className="tiny muted">{paymentLabel(r.payment_method)}</span>
                    {r.driver ? <span className="tiny muted">{r.driver.name}</span> : null}
                  </div>
                </div>

                {r.review ? (
                  <div className="tiny muted" style={{ borderLeft: '2px solid var(--line)', paddingLeft: 10 }}>
                    “{r.review}”
                  </div>
                ) : null}

                <div className="row gap-2 wrap">
                  {r.status === 'completed' ? (
                    r.rating ? (
                      <span className="row gap-1 tiny" style={{ color: 'var(--amber)', fontWeight: 700 }}>
                        {Array.from({ length: r.rating }).map((_, i) => (
                          <Star key={i} size={12} fill="currentColor" />
                        ))}
                      </span>
                    ) : (
                      <Button size="sm" variant="soft" onClick={() => setRateTarget(r)} icon={<Star size={13} />}>
                        Rate ride
                      </Button>
                    )
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => bookAgain(r)} icon={<RotateCcw size={13} />}>
                    Book again
                  </Button>
                  {upcoming ? (
                    <Button size="sm" variant="ghost" onClick={() => setCancelTarget(r)} icon={<XCircle size={13} />}>
                      Cancel
                    </Button>
                  ) : null}
                  {['completed', 'cancelled'].includes(r.status) ? (
                    <Button size="sm" variant="ghost" style={{ color: 'var(--red)' }} onClick={() => setDeleteTarget(r)} icon={<Trash2 size={13} />}>
                      Delete
                    </Button>
                  ) : null}
                  {upcoming ? (
                    <Button size="sm" onClick={() => navigate('/app')} icon={<ArrowRight size={13} />}>
                      Track ride
                    </Button>
                  ) : null}
                  <span className="tiny muted mono" style={{ marginLeft: 'auto' }}>
                    <Clock size={10} style={{ verticalAlign: -1 }} /> {r.id.slice(-8).toUpperCase()}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <RateRideModal
        ride={rateTarget}
        onClose={() => setRateTarget(null)}
        onRated={(updated) => setRides((prev) => (prev ?? []).map((r) => (r.id === updated.id ? { ...r, ...updated } : r)))}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={cancel}
        loading={busy}
        danger
        title="Cancel this ride?"
        confirmLabel="Cancel ride"
        body={
          cancelTarget ? (
            <>
              <p>
                {cancelTarget.pickup_name} → {cancelTarget.dropoff_name} · {formatGhs(cancelTarget.fare_cents)}
              </p>
              <p className="mt-2">
                {cancelTarget.driver
                  ? 'A driver is already on the way, so a GH₵3.00 cancellation fee applies.'
                  : 'No driver has been assigned yet, so this cancellation is free.'}
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
        title="Delete this ride?"
        confirmLabel="Delete ride"
        body="The ride disappears from your history. Wallet statements keep the payment record for your records."
      />
    </div>
  );
}
