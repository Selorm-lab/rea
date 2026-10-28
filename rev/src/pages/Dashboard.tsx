import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Bus,
  CalendarClock,
  ChevronRight,
  Clock,
  Coins,
  Leaf,
  MapPin,
  Navigation,
  Plus,
  Receipt,
  Route,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  TrendingUp,
  Wallet as WalletIcon,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { Badge, Button, Card, CardHeader, EmptyState, ListSkeleton, Skeleton, StatCard, StatsSkeleton } from '../components/ui';
import { DriverCard, RateRideModal, type Ride } from '../components/RideBits';
import { formatDate, formatGhs, formatTime, friendlyDay, relativeTime } from '../lib/format';
import { useToast } from '../lib/toast';

type Dashboard = {
  user: { name: string; university: string; campus: string; wallet_cents: number; rating: number; rides_count: number };
  stats: { rides_total: number; rides_this_month: number; km_this_month: number; spend_this_month: number; co2_saved_g: number; rating: number };
  upcoming_ride: any | null;
  next_trip: any | null;
  upcoming_bookings: any[];
  recent_rides: any[];
  transactions: any[];
  places: any[];
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const [rateTarget, setRateTarget] = useState<Ride | null>(null);
  const [rideState, setRideState] = useState<any | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.get<Dashboard>('/dashboard');
      setData(d);
      setRideState(d.upcoming_ride);
      setError('');
    } catch (err: any) {
      setError(err?.message ?? 'Could not load your dashboard');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // poll while a ride is in motion
  useEffect(() => {
    if (!rideState || !['searching', 'arriving', 'in_progress'].includes(rideState.status)) return;
    const id = setInterval(async () => {
      try {
        const res = await api.get<{ ride: any }>(`/rides/${rideState.id}`);
        setRideState(res.ride);
      } catch {
        /* ignore */
      }
    }, 3000);
    return () => clearInterval(id);
  }, [rideState?.id, rideState?.status]);

  const cancelRide = async () => {
    if (!rideState) return;
    const prev = rideState;
    setRideState({ ...rideState, status: 'cancelled' });
    try {
      await api.patch(`/rides/${prev.id}`, { status: 'cancelled' });
      toast.success('Ride cancelled');
      load();
    } catch (err: any) {
      setRideState(prev);
      toast.error(err?.message ?? 'Could not cancel this ride');
    }
  };

  if (!user) return null;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user.name.split(' ')[0];
  const live = rideState && ['searching', 'arriving', 'in_progress'].includes(rideState.status);
  const scheduled = rideState && rideState.status === 'scheduled';

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="row gap-2" style={{ marginBottom: 6 }}>
            <Badge tone="green">
              <span className="live-dot" /> Rev is live in {user.campus || 'Accra'}
            </Badge>
            <span className="tiny muted">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
          </div>
          <h1 className="page-title">
            {greeting}, {firstName}
          </h1>
          <p className="page-sub">
            {live
              ? 'Your driver is on the move — track the trip below.'
              : scheduled
                ? 'You have a ride scheduled. Everything is confirmed.'
                : data?.next_trip
                  ? `Next up: ${data.next_trip.from_city} → ${data.next_trip.to_city} ${friendlyDay(data.next_trip.depart_at).toLowerCase()}.`
                  : 'Ready when you are. Where should Rev take you?'}
          </p>
        </div>
        <div className="row gap-2 wrap">
          <Button variant="ghost" onClick={() => navigate('/app/intercity')} icon={<Bus size={16} />}>
            Intercity
          </Button>
          <Button onClick={() => navigate('/app/ride')} icon={<Navigation size={16} />}>
            Book a ride
          </Button>
        </div>
      </div>

      {error ? (
        <div className="notice red mb-3">
          {error}
          <button className="link" style={{ marginLeft: 'auto', color: 'inherit' }} onClick={load}>
            Retry
          </button>
        </div>
      ) : null}

      {!data ? (
        <div className="mb-3">
          <StatsSkeleton count={4} />
        </div>
      ) : (
        <div className="grid four mb-3">
          <>
            <StatCard label="Rides this month" value={data.stats.rides_this_month} hint={`${data.stats.rides_total} rides all-time`} icon={<Route size={16} />} />
            <StatCard
              label={`Spent in ${new Date().toLocaleDateString('en-GB', { month: 'long' })}`}
              value={formatGhs(data.stats.spend_this_month)}
              hint="Rides + intercity together"
              icon={<TrendingUp size={16} />}
            />
            <StatCard label="Distance travelled" value={`${data.stats.km_this_month} km`} hint="This month on Rev" icon={<Navigation size={16} />} />
            <StatCard
              label="CO₂ saved"
              value={data.stats.co2_saved_g >= 1000 ? `${(data.stats.co2_saved_g / 1000).toFixed(1)} kg` : `${data.stats.co2_saved_g} g`}
              hint="Vs. driving yourself"
              icon={<Leaf size={16} />}
            />
          </>
        </div>
      )}

      <div className="split">
        <div className="col gap-4">
          {/* live / scheduled ride */}
          {!data ? (
            <Card>
              <Skeleton h={18} w="40%" />
              <div className="mt-3 col gap-3">
                <Skeleton h={54} />
                <Skeleton h={16} w="70%" />
              </div>
            </Card>
          ) : rideState && (live || scheduled) ? (
            <div
              className="card pad"
              style={{
                background: live ? 'linear-gradient(155deg, #0c2017, #08150f)' : 'var(--surface)',
                color: live ? '#eaf2ea' : undefined,
                borderColor: live ? '#1d3a2b' : undefined,
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {live ? <div className="reg-noise" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} /> : null}
              <div className="row-between mb-3" style={{ position: 'relative' }}>
                <div className="row gap-2">
                  <span className={`badge ${live ? '' : 'blue'}`} style={live ? { background: 'rgba(199,244,100,0.16)', color: '#c7f464' } : undefined}>
                    {live ? <span className="live-dot" /> : <CalendarClock size={12} />}
                    {rideState.status === 'searching'
                      ? 'Finding your driver'
                      : rideState.status === 'arriving'
                        ? 'Driver arriving'
                        : rideState.status === 'in_progress'
                          ? 'On trip'
                          : 'Scheduled ride'}
                  </span>
                  {live ? <span className="tiny" style={{ color: '#8ba396' }}>{rideState.driver ? 'Live tracking' : 'Usually under 30s'}</span> : null}
                </div>
                <span className="tiny" style={{ color: live ? '#8ba396' : 'var(--muted-2)', fontWeight: 700 }}>
                  {rideState.tier_emoji} {rideState.tier_name}
                </span>
              </div>

              <div className="row-between" style={{ position: 'relative', alignItems: 'flex-start', gap: 16 }}>
                <div className="col gap-3 grow">
                  <div className="row gap-3">
                    <div className="col" style={{ gap: 3 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 99, background: '#0fa968' }} />
                      <span style={{ flex: 1, width: 2, background: live ? '#2a4234' : 'var(--line)', minHeight: 22, marginLeft: 3.5 }} />
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: live ? '#c7f464' : '#08150f' }} />
                    </div>
                    <div className="col gap-3 grow">
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{rideState.pickup_name}</div>
                        <div className="tiny" style={{ color: live ? '#8ba396' : 'var(--muted)' }}>
                          {rideState.pickup_address}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{rideState.dropoff_name}</div>
                        <div className="tiny" style={{ color: live ? '#8ba396' : 'var(--muted)' }}>
                          {rideState.dropoff_address}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="row gap-3 wrap">
                    <span className="tiny" style={{ color: live ? '#8ba396' : 'var(--muted)', fontWeight: 700 }}>
                      <Clock size={11} style={{ verticalAlign: -1 }} /> {rideState.duration_min} min · {rideState.distance_km} km
                    </span>
                    <span className="tiny" style={{ color: live ? '#8ba396' : 'var(--muted)', fontWeight: 700 }}>
                      <Coins size={11} style={{ verticalAlign: -1 }} /> {formatGhs(rideState.fare_cents)}
                    </span>
                    {rideState.scheduled_for ? (
                      <span className="tiny" style={{ color: live ? '#8ba396' : 'var(--muted)', fontWeight: 700 }}>
                        {formatDate(rideState.scheduled_for)} · {formatTime(rideState.scheduled_for)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div style={{ minWidth: 200, maxWidth: 240, width: '100%' }}>
                  {live ? <DriverCard ride={rideState} /> : null}
                </div>
              </div>

              {live ? (
                <div className="mt-4" style={{ position: 'relative' }}>
                  <div className="row-between gap-3">
                    <span className="tiny" style={{ color: '#8ba396' }}>
                      {rideState.status === 'in_progress' ? 'Enjoy the trip — fare is charged on arrival.' : `Pickup in about ${rideState.driver ? '2' : '3'} min`}
                    </span>
                    <div className="row gap-2">
                      <button className="btn ghost sm" style={{ background: 'transparent', borderColor: '#2a4234', color: '#e9f3ec' }} onClick={cancelRide}>
                        Cancel
                      </button>
                      <Link to="/app/rides" className="btn lime sm">
                        Manage ride <ChevronRight size={14} />
                      </Link>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 row gap-2 wrap">
                  <Button size="sm" variant="ghost" onClick={cancelRide}>
                    Cancel ride
                  </Button>
                  <Button size="sm" onClick={() => navigate('/app/rides')} icon={<ArrowRight size={14} />}>
                    View details
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Card style={{ background: 'linear-gradient(150deg, #0c2017, #08150f)', borderColor: '#1d3a2b', color: '#eaf2ea' }}>
              <div className="row-between gap-4 wrap">
                <div>
                  <span className="badge" style={{ background: 'rgba(199,244,100,0.16)', color: '#c7f464' }}>
                    <Sparkles size={12} /> No ride booked
                  </span>
                  <h2 style={{ fontSize: 24, marginTop: 12, color: '#fff', letterSpacing: '-0.03em' }}>Where are we going, {firstName}?</h2>
                  <p style={{ color: '#9db3a6', fontSize: 14, marginTop: 6, maxWidth: 420 }}>
                    Legon to Madina for GH₵14, or a comfortable ride to the airport. Prices are locked before you book.
                  </p>
                  <div className="row gap-2 mt-4 wrap">
                    <Button variant="lime" onClick={() => navigate('/app/ride')} icon={<Navigation size={15} />}>
                      Book a ride
                    </Button>
                    <Button variant="ghost" style={{ borderColor: '#2a4234', color: '#dbe9df', background: 'transparent' }} onClick={() => navigate('/app/intercity')}>
                      Book intercity
                    </Button>
                  </div>
                </div>
                <div className="col gap-2" style={{ minWidth: 180 }}>
                  {['Balme Library · 4 min', 'Accra Mall · 12 min', 'KIA Airport · 26 min'].map((t) => (
                    <div key={t} className="row gap-2 tiny" style={{ color: '#8ba396', border: '1px solid #1d3a2b', borderRadius: 10, padding: '7px 10px' }}>
                      <MapPin size={12} color="#c7f464" /> {t}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* upcoming trips */}
          <Card>
            <CardHeader
              title="Upcoming trips"
              sub={data?.upcoming_bookings?.length ? 'Your confirmed intercity seats' : 'Coach seats across Ghana'}
              action={
                <Link to="/app/intercity" className="link small row gap-1">
                  Find departures <ArrowRight size={13} />
                </Link>
              }
            />
            {!data ? (
              <ListSkeleton rows={2} />
            ) : data.upcoming_bookings.length === 0 ? (
              <EmptyState
                icon={<Bus size={24} />}
                title="No intercity trips yet"
                description="Accra to Kumasi from GH₵120. Pick your seat and board with a reference — no station queue."
                action={
                  <Button onClick={() => navigate('/app/intercity')} icon={<Bus size={15} />}>
                    Search departures
                  </Button>
                }
              />
            ) : (
              <div className="col">
                {data.upcoming_bookings.slice(0, 2).map((b) => (
                  <div key={b.id} className="row gap-3" style={{ padding: '12px 0', borderBottom: '1px solid var(--line-2)' }}>
                    <div className="row-icon" style={{ background: '#f0f6ee', color: '#0b8b55' }}>
                      <Bus size={18} />
                    </div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {b.from_city} → {b.to_city}
                      </div>
                      <div className="tiny muted">
                        {friendlyDay(b.depart_at)} · {formatTime(b.depart_at)} · {b.operator} · Seat {(b.seat_labels ?? []).join(', ')}
                      </div>
                    </div>
                    <div className="right">
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{formatGhs(b.total_cents)}</div>
                      <span className="tiny mono muted">{b.reference}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* recent rides */}
          <Card>
            <CardHeader
              title="Recent rides"
              sub="Your last few Rev trips"
              action={
                <Link to="/app/rides" className="link small row gap-1">
                  See all <ArrowRight size={13} />
                </Link>
              }
            />
            {!data ? (
              <ListSkeleton rows={3} />
            ) : data.recent_rides.length === 0 ? (
              <EmptyState
                icon={<Navigation size={24} />}
                title="Your ride history is empty"
                description="Your first trip is a tap away. Campus fares start at GH₵5.50 on Rev Bike."
                action={
                  <Button onClick={() => navigate('/app/ride')} icon={<Navigation size={15} />}>
                    Book your first ride
                  </Button>
                }
              />
            ) : (
              <div className="col">
                {data.recent_rides.map((r: any) => (
                  <div key={r.id} className="list-row">
                    <div className="row-icon" style={{ background: r.status === 'cancelled' ? 'var(--red-050)' : '#f2f6f1', color: r.status === 'cancelled' ? 'var(--red)' : '#4a5f53' }}>
                      <Navigation size={16} />
                    </div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row gap-2">
                        <span style={{ fontWeight: 700, fontSize: 14 }} className="truncate">
                          {r.pickup_name} → {r.dropoff_name}
                        </span>
                        {r.status === 'cancelled' ? <Badge tone="red">Cancelled</Badge> : null}
                      </div>
                      <div className="tiny muted truncate">
                        {relativeTime(r.created_at)} · {r.distance_km} km · {r.driver?.name ?? 'No driver'}
                      </div>
                    </div>
                    <div className="right col gap-1" style={{ alignItems: 'flex-end' }}>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>{formatGhs(r.fare_cents)}</span>
                      {r.status === 'completed' && !r.rating ? (
                        <button className="link tiny" onClick={() => setRateTarget(r)}>
                          Rate ride
                        </button>
                      ) : r.rating ? (
                        <span className="tiny" style={{ color: 'var(--amber)' }}>
                          <Star size={10} fill="currentColor" style={{ verticalAlign: -1 }} /> {r.rating}.0
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* ---------- side column ---------- */}
        <div className="col gap-4">
          <Card>
            <div className="row-between mb-3">
              <span className="eyebrow">Quick actions</span>
              <Sparkles size={14} color="var(--muted-2)" />
            </div>
            <div className="grid two" style={{ gap: 10 }}>
              {[
                { label: 'Book a ride', icon: <Navigation size={17} />, to: '/app/ride' },
                { label: 'Intercity', icon: <Bus size={17} />, to: '/app/intercity' },
                { label: 'My bookings', icon: <Ticket size={17} />, to: '/app/bookings' },
                { label: 'Saved places', icon: <MapPin size={17} />, to: '/app/places' },
              ].map((a) => (
                <Link
                  key={a.label}
                  to={a.to}
                  className="card dashed"
                  style={{ padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 8, borderRadius: 13 }}
                >
                  <span style={{ color: 'var(--green-700)' }}>{a.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>{a.label}</span>
                </Link>
              ))}
            </div>
          </Card>

          <div className="card pad" style={{ background: 'linear-gradient(150deg, #0f2a1e, #08150f)', borderColor: '#1d3a2b', color: '#eaf2ea' }}>
            <div className="row-between">
              <span className="row gap-2 tiny" style={{ color: '#c7f464', fontWeight: 800, letterSpacing: '0.1em' }}>
                <WalletIcon size={13} /> REV WALLET
              </span>
              <Badge style={{ background: 'rgba(199,244,100,0.14)', color: '#c7f464' }}>MoMo linked</Badge>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.04em', marginTop: 8, color: '#fff' }}>
              {data ? formatGhs(data.user.wallet_cents) : '—'}
            </div>
            <div className="tiny" style={{ color: '#8ba396' }}>
              {data ? `${formatGhs(data.stats.spend_this_month)} spent this month` : 'Loading balance…'}
            </div>
            <div className="row gap-2 mt-3">
              <Button
                variant="lime"
                size="sm"
                onClick={() => navigate('/app/wallet')}
                icon={<Plus size={14} />}
              >
                Top up
              </Button>
              <Button
                size="sm"
                variant="ghost"
                style={{ borderColor: '#2a4234', color: '#dbe9df', background: 'transparent' }}
                onClick={() => navigate('/app/wallet')}
              >
                Statement
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader
              title="Wallet activity"
              action={
                <Link to="/app/wallet" className="link tiny">
                  All
                </Link>
              }
            />
            {!data ? (
              <ListSkeleton rows={3} />
            ) : data.transactions.length === 0 ? (
              <EmptyState icon={<Receipt size={22} />} title="No transactions yet" description="Top up your wallet to see activity here." />
            ) : (
              <div className="col">
                {data.transactions.map((t) => (
                  <div key={t.id} className="row gap-3" style={{ padding: '9px 0', borderBottom: '1px solid var(--line-2)' }}>
                    <div
                      className="row-icon"
                      style={{
                        width: 32,
                        height: 32,
                        background: t.amount_cents > 0 ? 'var(--green-050)' : '#f5f6f3',
                        color: t.amount_cents > 0 ? 'var(--green-700)' : 'var(--muted)',
                      }}
                    >
                      {t.amount_cents > 0 ? <ArrowDownIcon /> : <ArrowUpRight size={14} />}
                    </div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="truncate" style={{ fontWeight: 600, fontSize: 13 }}>
                        {t.description}
                      </div>
                      <div className="tiny muted">{relativeTime(t.created_at)}</div>
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 13, color: t.amount_cents > 0 ? 'var(--green-700)' : 'var(--text)' }}>
                      {t.amount_cents > 0 ? '+' : ''}
                      {formatGhs(Math.abs(t.amount_cents)).replace('GH₵', '₵')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Saved places"
              action={
                <Link to="/app/places" className="link tiny">
                  Manage
                </Link>
              }
            />
            {!data ? (
              <Skeleton h={60} />
            ) : data.places.length === 0 ? (
              <div className="col gap-3">
                <p className="small muted">Save home, campus and your favourite waakye spot for one-tap booking.</p>
                <Button size="sm" variant="ghost" onClick={() => navigate('/app/places')} icon={<Plus size={14} />}>
                  Add a place
                </Button>
              </div>
            ) : (
              <div className="col gap-2">
                {data.places.slice(0, 3).map((p) => (
                  <button
                    key={p.id}
                    className="row gap-3"
                    style={{ background: 'none', border: 0, textAlign: 'left', padding: '7px 0', cursor: 'pointer' }}
                    onClick={() => navigate('/app/ride', { state: { pickup: p } })}
                  >
                    <span className="row-icon" style={{ width: 32, height: 32 }}>
                      <MapPin size={14} />
                    </span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13 }} className="truncate">
                        {p.label}
                      </div>
                      <div className="tiny muted truncate">{p.name}</div>
                    </div>
                    <ChevronRight size={15} color="var(--muted-2)" />
                  </button>
                ))}
              </div>
            )}
          </Card>

          <div className="card pad-sm" style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
            <span className="stat-icon" style={{ background: 'var(--blue-050)', color: 'var(--blue)' }}>
              <ShieldCheck size={16} />
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Safety toolkit</div>
              <div className="tiny muted">Share trip status, 24/7 support, verified drivers.</div>
            </div>
          </div>
        </div>
      </div>

      <RateRideModal
        ride={rateTarget}
        onClose={() => setRateTarget(null)}
        onRated={(ride) => {
          setData((prev) =>
            prev ? { ...prev, recent_rides: prev.recent_rides.map((r) => (r.id === ride.id ? { ...r, rating: ride.rating, review: ride.review } : r)) } : prev,
          );
        }}
      />
    </div>
  );
}

function ArrowDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M19 12l-7 7-7-7" />
    </svg>
  );
}
