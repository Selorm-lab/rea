import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowDownUp,
  ArrowRight,
  CalendarClock,
  Check,
  ChevronRight,
  Clock,
  Coins,
  MapPin,
  Navigation,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  X,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { Badge, Button, Card, EmptyState, Field, Input, Skeleton, Textarea } from '../components/ui';
import { RouteMap } from '../components/MapView';
import { DriverCard, RateRideModal, RideSteps, type Ride } from '../components/RideBits';
import { formatDate, formatGhs, formatTime, paymentLabel, toDateTimeInput } from '../lib/format';
import type { Estimate, TierId } from '../../shared/travel';

type Spot = { id?: string; name: string; address: string; lat: number; lng: number };
type Option = Estimate & { name: string; blurb: string; seats: number; emoji: string };
type PlaceRow = { id: string; label: string; name: string; address: string; icon: string; lat: number; lng: number };

function customSpot(text: string): Spot {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) % 100000;
  return {
    name: text,
    address: 'Pinned location · Accra',
    lat: 5.55 + ((hash % 90) / 1000),
    lng: -0.24 + ((hash % 70) / 1000),
  };
}

export default function BookRide() {
  const { user, patchUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = (location.state as any) ?? null;

  const [pickup, setPickup] = useState<Spot | null>(prefill?.pickup ?? null);
  const [dropoff, setDropoff] = useState<Spot | null>(prefill?.dropoff ?? null);
  const [active, setActive] = useState<'pickup' | 'dropoff' | null>(prefill?.pickup ? 'dropoff' : 'pickup');
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<Option[]>([]);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [tier, setTier] = useState<TierId>((prefill?.tier as TierId) ?? 'go');
  const [whenMode, setWhenMode] = useState<'now' | 'later'>('now');
  const [when, setWhen] = useState(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    return toDateTimeInput(d);
  });
  const [payment, setPayment] = useState(user?.payment_methods?.find((m) => m.is_default)?.kind ?? 'wallet');
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState<PlaceRow[]>([]);
  const [suggestions, setSuggestions] = useState<{ places: any[]; cities: any[] }>({ places: [], cities: [] });
  const [submitting, setSubmitting] = useState(false);
  const [ride, setRide] = useState<Ride | null>(null);
  const [rateOpen, setRateOpen] = useState(false);
  const [error, setError] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  const loadSaved = useCallback(() => {
    api
      .get<{ places: PlaceRow[] }>('/places')
      .then((d) => {
        setSaved(d.places);
        return api.get<{ methods: any[] }>('/payment-methods');
      })
      .then((d) => {
        const def = d.methods.find((m) => m.is_default) ?? d.methods[0];
        if (def) setPayment(def.kind);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  useEffect(() => {
    const q = query.trim();
    const controller = new AbortController();
    const t = setTimeout(() => {
      api
        .get<{ places: any[]; cities: any[] }>(`/places/suggestions?q=${encodeURIComponent(q)}`, controller.signal)
        .then(setSuggestions)
        .catch(() => {});
    }, 140);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query]);

  // debounce the estimate request
  useEffect(() => {
    if (!pickup || !dropoff) {
      setOptions([]);
      return;
    }
    let alive = true;
    setEstimateLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.post<{ options: Option[] }>('/rides/estimate', {
          pickup: { lat: pickup.lat, lng: pickup.lng },
          dropoff: { lat: dropoff.lat, lng: dropoff.lng },
          when: whenMode === 'later' ? new Date(when).toISOString() : undefined,
        });
        if (!alive) return;
        setOptions(res.options);
        if (!res.options.some((o) => o.tier === tier)) setTier('go');
      } catch (err) {
        if (alive && err instanceof ApiError) toast.error(err.message);
      } finally {
        if (alive) setEstimateLoading(false);
      }
    }, 320);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, whenMode, when]);

  // poll the live ride
  useEffect(() => {
    if (!ride || !['searching', 'arriving', 'in_progress'].includes(ride.status)) return;
    const id = setInterval(async () => {
      try {
        const res = await api.get<{ ride: Ride }>(`/rides/${ride.id}`);
        setRide(res.ride);
        if (res.ride.status === 'completed') {
          setRateOpen(true);
          toast.success('You have arrived. Trip paid from your wallet.');
          api
            .get<{ user: any }>('/auth/me')
            .then((d) => d.user && patchUser(d.user))
            .catch(() => {});
        }
      } catch {
        /* ignore */
      }
    }, 2500);
    return () => clearInterval(id);
  }, [ride?.id, ride?.status, patchUser, toast]);

  const choose = (spot: Spot) => {
    if (active === 'pickup') {
      setPickup(spot);
      setActive('dropoff');
      setQuery('');
    } else {
      setDropoff(spot);
      setActive(null);
      setQuery('');
    }
  };

  const swap = () => {
    setPickup(dropoff);
    setDropoff(pickup);
  };

  const selected = options.find((o) => o.tier === tier);
  const balanceAfter = (user?.wallet_cents ?? 0) - (selected?.fareCents ?? 0);

  const submit = async () => {
    if (!pickup || !dropoff) {
      setError('Choose a pickup point and a destination first.');
      return;
    }
    if (whenMode === 'later' && (!when || Number.isNaN(new Date(when).getTime()))) {
      setError('Choose a pickup time for your scheduled ride.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        pickup_name: pickup.name,
        pickup_address: pickup.address,
        pickup_lat: pickup.lat,
        pickup_lng: pickup.lng,
        dropoff_name: dropoff.name,
        dropoff_address: dropoff.address,
        dropoff_lat: dropoff.lat,
        dropoff_lng: dropoff.lng,
        tier,
        payment_method: payment,
        notes,
        scheduled_for: whenMode === 'later' ? new Date(when).toISOString() : undefined,
      };
      const res = await api.post<{ ride: Ride }>('/rides', payload);
      setRide(res.ride);
      toast.success(whenMode === 'later' ? 'Ride scheduled' : 'Looking for your driver…');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not request your ride';
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (status: string) => {
    if (!ride) return;
    const prev = ride;
    setRide({ ...ride, status: status as Ride['status'] });
    try {
      const res = await api.patch<{ ride: Ride }>(`/rides/${ride.id}`, { status });
      setRide(res.ride);
      if (status === 'completed') {
        setRateOpen(true);
        const me = await api.get<{ user: any }>('/auth/me');
        if (me.user) patchUser(me.user);
      }
    } catch (err: any) {
      setRide(prev);
      toast.error(err?.message ?? 'Could not update the ride');
    }
  };

  if (!user) return null;

  const renderSuggestions = (field: 'pickup' | 'dropoff') => {
    if (active !== field) return null;
    const q = query.trim().toLowerCase();
    const places = (suggestions.places ?? []).filter(
      (p) => !q || p.name.toLowerCase().includes(q) || p.area.toLowerCase().includes(q),
    );
    return (
      <div className="suggest" role="listbox" aria-label={field === 'pickup' ? 'Pickup suggestions' : 'Destination suggestions'}>
        {field === 'pickup' && saved.length > 0 && !q ? (
          <>
            <div className="suggest-head">Saved places</div>
            {saved.slice(0, 4).map((p) => (
              <button key={p.id} className="suggest-item" onClick={() => choose({ name: p.name, address: p.address, lat: p.lat, lng: p.lng })}>
                <span className="suggest-icon">
                  <MapPin size={14} />
                </span>
                <div className="col grow" style={{ minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>{p.label}</span>
                  <span className="tiny muted truncate">{p.name}</span>
                </div>
                <ChevronRight size={15} color="var(--muted-2)" />
              </button>
            ))}
          </>
        ) : null}
        <div className="suggest-head">{field === 'pickup' && !q ? 'Popular pickup points' : 'Search results'}</div>
        {places.slice(0, 6).map((p) => (
          <button key={p.id} className="suggest-item" onClick={() => choose({ name: p.name, address: p.address, lat: p.lat, lng: p.lng })}>
            <span className="suggest-icon">
              <MapPin size={14} />
            </span>
            <div className="col grow" style={{ minWidth: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>{p.name}</span>
              <span className="tiny muted truncate">{p.address}</span>
            </div>
          </button>
        ))}
        {q && places.length === 0 ? (
          <button className="suggest-item" onClick={() => choose(customSpot(query.trim()))}>
            <span className="suggest-icon">
              <Navigation size={14} />
            </span>
            <div className="col grow" style={{ minWidth: 0 }}>
              <span style={{ fontWeight: 700, fontSize: 13.5 }}>Use “{query.trim()}”</span>
              <span className="tiny muted">Drop a pin near Accra centre</span>
            </div>
          </button>
        ) : null}
        {!q && (suggestions.cities ?? []).length > 0 ? (
          <>
            <div className="suggest-head">Cities · intercity</div>
            {suggestions.cities.slice(0, 3).map((c) => (
              <button key={c.name} className="suggest-item" onClick={() => navigate('/app/intercity', { state: { from: c.name } })}>
                <span className="suggest-icon" style={{ background: '#f0f6ee', color: '#0b8b55' }}>
                  <MapPin size={14} />
                </span>
                <div className="col grow">
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>{c.name}</span>
                  <span className="tiny muted">{c.region} · book a coach</span>
                </div>
                <ArrowRight size={14} color="var(--muted-2)" />
              </button>
            ))}
          </>
        ) : null}
      </div>
    );
  };

  /* ------------------------- live / completed ride ------------------------ */
  if (ride) {
    const done = ride.status === 'completed';
    const cancelled = ride.status === 'cancelled';
    const scheduledRide = ride.status === 'scheduled';
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <div className="row gap-2" style={{ marginBottom: 6 }}>
              <Badge tone={done ? 'green' : cancelled ? 'red' : scheduledRide ? 'blue' : 'amber'}>
                <span className={done || cancelled || scheduledRide ? 'dot' : 'live-dot'} />
                {done ? 'Trip complete' : cancelled ? 'Ride cancelled' : scheduledRide ? 'Ride scheduled' : 'Live ride'}
              </Badge>
              <span className="tiny muted mono">{ride.id.slice(-8).toUpperCase()}</span>
            </div>
            <h1 className="page-title">{done ? 'You have arrived' : cancelled ? 'Ride cancelled' : scheduledRide ? 'Your ride is booked' : 'Tracking your ride'}</h1>
            <p className="page-sub">
              {done
                ? `Paid ${formatGhs(ride.fare_cents)} with ${paymentLabel(ride.payment_method)}. Thanks for riding Rev.`
                : cancelled
                  ? 'No charge was made for this trip.'
                  : scheduledRide
                    ? `We will dispatch a driver ahead of ${formatDate(ride.scheduled_for!)} · ${formatTime(ride.scheduled_for!)}.`
                    : 'Keep this screen open — your driver details update automatically.'}
            </p>
          </div>
          <Button variant="ghost" onClick={() => navigate('/app/rides')} icon={<ChevronRight size={15} />}>
            Ride history
          </Button>
        </div>

        <div className="split">
          <div className="col gap-4">
            <Card pad={false} style={{ overflow: 'hidden' }}>
              <RouteMap pickup={pickup} dropoff={dropoff} height={260} progress={1} />
            </Card>

            <Card>
              <div className="row-between mb-3">
                <div className="card-title">{done ? 'Trip receipt' : 'Ride status'}</div>
                <div className="row gap-2">
                  <span className="tiny muted">{ride.tier_emoji}</span>
                  <Badge tone="outline">{ride.tier_name}</Badge>
                </div>
              </div>
              {!done && !cancelled && !scheduledRide ? <RideSteps ride={ride} /> : null}

              {scheduledRide ? (
                <div className="notice">
                  <CalendarClock size={17} />
                  <span>
                    A driver will be assigned about 10 minutes before your pickup at {formatDate(ride.scheduled_for!)} ·{' '}
                    {formatTime(ride.scheduled_for!)}. You can cancel free of charge until then.
                  </span>
                </div>
              ) : null}

              {done ? (
                <div className="col gap-2 mt-3">
                  <div className="kv">
                    <dt>Route</dt>
                    <dd>
                      {ride.pickup_name} → {ride.dropoff_name}
                    </dd>
                  </div>
                  <div className="kv">
                    <dt>Distance</dt>
                    <dd>{ride.distance_km} km</dd>
                  </div>
                  <div className="kv">
                    <dt>Duration</dt>
                    <dd>{ride.duration_min} min</dd>
                  </div>
                  <div className="kv">
                    <dt>Payment</dt>
                    <dd>{paymentLabel(ride.payment_method)}</dd>
                  </div>
                  <hr className="divider mt-2" />
                  <div className="kv" style={{ fontSize: 16 }}>
                    <dt style={{ color: 'var(--text)', fontWeight: 700 }}>Total paid</dt>
                    <dd style={{ color: 'var(--green-700)', fontSize: 18 }}>{formatGhs(ride.fare_cents)}</dd>
                  </div>
                  {ride.rating ? (
                    <div className="row gap-2 mt-2">
                      <span className="tiny muted">You rated this trip</span>
                      <span className="row gap-1" style={{ color: 'var(--amber)' }}>
                        {Array.from({ length: ride.rating }).map((_, i) => (
                          <Star key={i} size={12} fill="currentColor" />
                        ))}
                      </span>
                    </div>
                  ) : (
                    <Button variant="soft" className="mt-2" onClick={() => setRateOpen(true)} icon={<Star size={15} />}>
                      Rate this ride
                    </Button>
                  )}
                </div>
              ) : null}

              {!done && !cancelled && ride.driver ? (
                <div className="mt-4">
                  <div className="section-title">Your driver</div>
                  <DriverCard ride={ride} />
                </div>
              ) : null}

              <div className="row gap-2 mt-4 wrap">
                {!done && !cancelled ? (
                  <Button
                    variant="ghost"
                    onClick={() => updateStatus('cancelled')}
                    disabled={ride.status === 'in_progress'}
                  >
                    Cancel ride
                  </Button>
                ) : null}
                {ride.status === 'arriving' ? (
                  <Button onClick={() => updateStatus('in_progress')} icon={<Navigation size={15} />}>
                    I'm in the car — start trip
                  </Button>
                ) : null}
                {ride.status === 'in_progress' ? (
                  <Button onClick={() => updateStatus('completed')} icon={<Check size={15} />}>
                    Complete trip
                  </Button>
                ) : null}
                {done || cancelled ? (
                  <Button
                    variant="dark"
                    onClick={() => {
                      setRide(null);
                      setDown();
                    }}
                  >
                    Book another ride
                  </Button>
                ) : null}
                <Button variant="ghost" onClick={() => navigate('/app/rides')}>
                  View in history
                </Button>
              </div>
            </Card>
          </div>

          <div className="col gap-4 sticky-side">
            <Card>
              <div className="section-title">Trip summary</div>
              <div className="row gap-3">
                <div className="col" style={{ gap: 4, paddingTop: 4 }}>
                  <span style={{ width: 9, height: 9, borderRadius: 99, background: 'var(--green)' }} />
                  <span style={{ width: 2, height: 26, background: 'var(--line)', marginLeft: 3.5 }} />
                  <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--ink)' }} />
                </div>
                <div className="col gap-3 grow">
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{ride.pickup_name}</div>
                    <div className="tiny muted">{ride.pickup_address}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{ride.dropoff_name}</div>
                    <div className="tiny muted">{ride.dropoff_address}</div>
                  </div>
                </div>
              </div>
              <hr className="divider mt-4" />
              <div className="kv mt-2">
                <dt>Fare</dt>
                <dd>{formatGhs(ride.fare_cents)}</dd>
              </div>
              <div className="kv">
                <dt>Distance</dt>
                <dd>{ride.distance_km} km</dd>
              </div>
              <div className="kv">
                <dt>Est. time</dt>
                <dd>{ride.duration_min} min</dd>
              </div>
              <div className="kv">
                <dt>Payment</dt>
                <dd>{paymentLabel(ride.payment_method)}</dd>
              </div>
            </Card>

            {!done && !cancelled ? (
              <div className="card pad-sm" style={{ display: 'flex', gap: 11 }}>
                <span className="stat-icon" style={{ background: 'var(--blue-050)', color: 'var(--blue)' }}>
                  <ShieldCheck size={16} />
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Trip protection on</div>
                  <div className="tiny muted">Share your live trip with a friend from the Rev app. Support is one tap away.</div>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <RateRideModal ride={rateOpen ? ride : null} onClose={() => setRateOpen(false)} onRated={(r) => setRide(r)} />
      </div>
    );
  }

  function setDown() {
    setPickup(null);
    setDropoff(null);
    setActive('pickup');
    setOptions([]);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Book a ride</h1>
          <p className="page-sub">Campus hops and city trips, priced before you tap. No surge surprises.</p>
        </div>
        <div className="row gap-2 wrap">
          <Badge tone="outline">
            <ShieldCheck size={12} /> Verified drivers
          </Badge>
          <Badge tone="green">
            <WalletMini /> {formatGhs(user.wallet_cents)} available
          </Badge>
        </div>
      </div>

      <div className="split">
        <div className="col gap-4">
          <Card>
            <div className="row-between mb-3">
              <div className="card-title">Where are you going?</div>
              <button className="link small" onClick={() => navigate('/app/places')}>
                <MapPin size={13} style={{ verticalAlign: -2 }} /> Saved places
              </button>
            </div>

            <div className="route-box" ref={wrapRef}>
              <div className="route-rail" />

              <div className="route-field">
                <span className="pin pickup">
                  <span style={{ width: 7, height: 7, borderRadius: 99, background: '#fff' }} />
                </span>
                <input
                  className="input"
                  placeholder="Pickup point"
                  value={active === 'pickup' ? query : pickup?.name ?? ''}
                  onFocus={() => {
                    setActive('pickup');
                    setQuery('');
                  }}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive('pickup');
                  }}
                  aria-label="Pickup point"
                  autoComplete="off"
                />
                {pickup && active !== 'pickup' ? (
                  <button
                    className="icon-btn"
                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', border: 0, width: 34, height: 34 }}
                    onClick={() => {
                      setPickup(null);
                      setActive('pickup');
                    }}
                    aria-label="Clear pickup"
                  >
                    <X size={15} />
                  </button>
                ) : null}
                {renderSuggestions('pickup')}
              </div>

              <div className="route-field">
                <span className="pin dropoff">
                  <span style={{ width: 7, height: 7, borderRadius: 2, background: '#c7f464' }} />
                </span>
                <input
                  className="input"
                  placeholder="Where to?"
                  value={active === 'dropoff' ? query : dropoff?.name ?? ''}
                  onFocus={() => {
                    setActive('dropoff');
                    setQuery('');
                  }}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive('dropoff');
                  }}
                  aria-label="Destination"
                  autoComplete="off"
                />
                {dropoff && active !== 'dropoff' ? (
                  <button
                    className="icon-btn"
                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', border: 0, width: 34, height: 34 }}
                    onClick={() => {
                      setDropoff(null);
                      setActive('dropoff');
                    }}
                    aria-label="Clear destination"
                  >
                    <X size={15} />
                  </button>
                ) : null}
                {renderSuggestions('dropoff')}
              </div>

              <button
                className="icon-btn"
                onClick={swap}
                aria-label="Swap pickup and destination"
                style={{ position: 'absolute', right: -4, top: '50%', transform: 'translateY(-50%)', zIndex: 3, width: 30, height: 30, background: '#fff', boxShadow: 'var(--shadow-sm)' }}
                disabled={!pickup && !dropoff}
              >
                <ArrowDownUp size={14} />
              </button>
            </div>

            <div className="row gap-2 mt-3 wrap">
              {saved.slice(0, 3).map((p) => (
                <button
                  key={p.id}
                  className="chip"
                  onClick={() => {
                    const spot = { name: p.name, address: p.address, lat: p.lat, lng: p.lng };
                    if (!pickup) choose(spot);
                    else if (!dropoff) {
                      setDropoff(spot);
                      setActive(null);
                    } else {
                      setDropoff(spot);
                      setActive(null);
                    }
                  }}
                >
                  <MapPin size={12} /> {p.label}
                </button>
              ))}
              {saved.length === 0 ? <span className="tiny muted">Tip: save your hostel and campus for one-tap booking.</span> : null}
            </div>

            {error ? (
              <div className="notice red mt-3" role="alert">
                {error}
              </div>
            ) : null}
          </Card>

          <Card>
            <div className="row-between mb-3">
              <div className="card-title">Choose your ride</div>
              {estimateLoading ? <span className="tiny muted">Updating prices…</span> : selected?.surge && selected.surge > 1 ? (
                <Badge tone="amber">{Math.round((selected.surge - 1) * 100)}% peak pricing</Badge>
              ) : (
                <span className="tiny muted">Fares include all fees</span>
              )}
            </div>

            {!pickup || !dropoff ? (
              <EmptyState
                icon={<MapPin size={24} />}
                title="Pick two points on the map"
                description="Add a pickup and a destination and we'll price every ride type instantly."
              />
            ) : estimateLoading && options.length === 0 ? (
              <div className="col gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="row gap-3" style={{ padding: 13, border: '1px solid var(--line)', borderRadius: 14 }}>
                    <Skeleton h={44} w={44} />
                    <div className="grow col gap-2">
                      <Skeleton h={13} w="40%" />
                      <Skeleton h={10} w="28%" />
                    </div>
                    <Skeleton h={18} w={64} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="col gap-2">
                {options.map((o) => (
                  <button key={o.tier} className={`tier ${tier === o.tier ? 'active' : ''}`} onClick={() => setTier(o.tier as TierId)} aria-pressed={tier === o.tier}>
                    <span className="tier-emoji">{o.emoji}</span>
                    <div className="grow">
                      <div className="row gap-2">
                        <span style={{ fontWeight: 800, fontSize: 14.5 }}>{o.name}</span>
                        {o.tier === 'bike' ? <Badge tone="green">Cheapest</Badge> : null}
                        {o.tier === 'go' ? <Badge tone="default">Popular</Badge> : null}
                      </div>
                      <div className="tiny muted">
                        {o.etaPickupMin} min away · {o.blurb}
                      </div>
                    </div>
                    <div className="right col" style={{ alignItems: 'flex-end', gap: 2 }}>
                      <span className="tier-price">{formatGhs(o.fareCents)}</span>
                      <span className="tiny muted">
                        <Users size={10} style={{ verticalAlign: -1 }} /> {o.seats}
                      </span>
                    </div>
                    {tier === o.tier ? (
                      <span style={{ color: 'var(--green)' }}>
                        <Check size={18} strokeWidth={3} />
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            )}

            <div className="grid two mt-4" style={{ gap: 12 }}>
              <Field label="When">
                <div className="chips">
                  <button className={`chip ${whenMode === 'now' ? 'active' : ''}`} onClick={() => setWhenMode('now')} type="button">
                    <Clock size={12} /> Ride now
                  </button>
                  <button className={`chip ${whenMode === 'later' ? 'active' : ''}`} onClick={() => setWhenMode('later')} type="button">
                    <CalendarClock size={12} /> Schedule
                  </button>
                </div>
              </Field>
              <Field label="Pay with">
                <select className="select" value={payment} onChange={(e) => setPayment(e.target.value as any)} aria-label="Payment method">
                  <option value="wallet">Rev Wallet · {formatGhs(user.wallet_cents)}</option>
                  <option value="momo">Mobile Money</option>
                  <option value="card">Card</option>
                  <option value="cash">Cash to driver</option>
                </select>
              </Field>
            </div>

            {whenMode === 'later' ? (
              <div className="mt-3">
                <Field label="Pickup time" hint="We'll dispatch a driver shortly before this time.">
                  <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} min={toDateTimeInput(new Date())} />
                </Field>
              </div>
            ) : null}

            <div className="mt-3">
              <Field label="Note for the driver (optional)">
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="I'm at the hostel gate with two bags" maxLength={300} style={{ minHeight: 66 }} />
              </Field>
            </div>
          </Card>
        </div>

        <div className="col gap-4 sticky-side">
          <Card pad={false} style={{ overflow: 'hidden' }}>
            <RouteMap pickup={pickup} dropoff={dropoff} height={230} progress={pickup && dropoff ? 1 : 0} />
          </Card>

          <Card>
            <div className="card-title mb-3">Fare summary</div>
            <div className="kv">
              <dt>Ride type</dt>
              <dd>{selected ? `${selected.emoji} ${selected.name}` : '—'}</dd>
            </div>
            <div className="kv">
              <dt>Distance</dt>
              <dd>{selected ? `${selected.distanceKm} km` : '—'}</dd>
            </div>
            <div className="kv">
              <dt>Estimated time</dt>
              <dd>{selected ? `${selected.durationMin} min` : '—'}</dd>
            </div>
            {selected && selected.surge > 1 ? (
              <div className="kv">
                <dt>Peak adjustment</dt>
                <dd>×{selected.surge.toFixed(2)}</dd>
              </div>
            ) : null}
            <hr className="divider mt-2 mb-2" />
            <div className="row-between">
              <span style={{ fontWeight: 700 }}>Total</span>
              <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>{selected ? formatGhs(selected.fareCents) : 'GH₵0.00'}</span>
            </div>
            {payment === 'wallet' && selected ? (
              <div className={`tiny mt-2 ${balanceAfter < 0 ? 'error-text' : 'muted'}`}>
                Wallet after this trip: {formatGhs(Math.max(balanceAfter, 0))}
                {balanceAfter < 0 ? ' · top up first' : ''}
              </div>
            ) : null}

            <Button className="mt-4" block size="lg" onClick={submit} loading={submitting} disabled={!pickup || !dropoff || !selected} icon={<ArrowRight size={17} />}>
              {whenMode === 'later' ? 'Schedule ride' : `Request ${selected?.name ?? 'ride'}`}
            </Button>
            {payment === 'wallet' && balanceAfter < 0 ? (
              <Button variant="soft" block className="mt-2" onClick={() => navigate('/app/wallet')} icon={<Plus size={15} />}>
                Top up wallet
              </Button>
            ) : null}
            <p className="tiny muted center mt-3">
              <ShieldCheck size={11} style={{ verticalAlign: -1 }} /> Fare locked at booking. Cancel free before pickup.
            </p>
          </Card>

          <div className="card pad-sm">
            <div className="row gap-3">
              <span className="stat-icon" style={{ background: 'var(--amber-050)', color: '#b45309' }}>
                <Sparkles size={16} />
              </span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Going far?</div>
                <div className="tiny muted">Intercity coaches from GH₵45. Click a city or open Rev Intercity.</div>
                <button className="link small mt-1" onClick={() => navigate('/app/intercity')}>
                  See the timetable <ArrowRight size={12} style={{ verticalAlign: -1 }} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WalletMini() {
  return <Coins size={12} />;
}
