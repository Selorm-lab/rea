import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowDownUp,
  ArrowRight,
  Bus,
  CalendarDays,
  Filter,
  MapPin,
  Search,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tickets,
  Users,
  Wifi,
  X,
} from 'lucide-react';
import { api, qs } from '../lib/api';
import { Badge, Button, Card, EmptyState, Field, ListSkeleton, Select } from '../components/ui';
import { GhanaMap } from '../components/MapView';
import { addDays, amenityLabel, countdown, formatDate, formatDuration, formatGhs, formatTime, friendlyDay, isToday, toDateInput } from '../lib/format';

type Trip = {
  id: string;
  operator: string;
  vehicle_type: string;
  depart_at: string;
  arrive_at: string;
  price_cents: number;
  total_seats: number;
  seats_taken: number;
  seats_left: number;
  amenities: string[];
  status: string;
  from_city: string;
  to_city: string;
  distance_km: number;
  duration_min: number;
};

const AMENITIES = ['wifi', 'ac', 'usb', 'reclining', 'snack', 'toilet'];
const SORTS = [
  { value: 'departure', label: 'Earliest' },
  { value: 'price', label: 'Cheapest' },
  { value: 'duration', label: 'Fastest' },
] as const;

export default function Intercity() {
  const location = useLocation();
  const navigate = useNavigate();
  const prefill = (location.state as any) ?? null;

  const today = new Date();
  const [from, setFrom] = useState(prefill?.from ?? 'Accra');
  const [to, setTo] = useState(prefill?.to ?? 'Kumasi');
  const [date, setDate] = useState(toDateInput(today));
  const [sort, setSort] = useState<(typeof SORTS)[number]['value']>('departure');
  const [maxPrice, setMaxPrice] = useState('');
  const [operators, setOperators] = useState<string[]>([]);
  const [amenities, setAmenities] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [availableOperators, setAvailableOperators] = useState<string[]>([]);
  const [cities, setCities] = useState<string[]>(['Accra', 'Kumasi']);
  const [routes, setRoutes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    api
      .get<{ cities: string[]; routes: any[] }>('/intercity/routes')
      .then((d) => {
        setCities(d.cities);
        setRoutes(d.routes);
      })
      .catch(() => {});
  }, []);

  const search = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      if (!opts.silent) setLoading(true);
      setError('');
      try {
        const params = qs({
          from,
          to,
          date,
          sort,
          max_price: maxPrice ? Math.round(Number(maxPrice) * 100) : undefined,
          operators: operators.join(','),
          amenities: amenities.join(','),
        });
        const res = await api.get<{ trips: Trip[]; operators: string[] }>(`/intercity/trips${params}`, controller.signal);
        setTrips(res.trips);
        if (res.operators.length) setAvailableOperators((prev) => [...new Set([...prev, ...res.operators])]);
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          setError(err?.message ?? 'Could not load departures');
          setTrips([]);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [from, to, date, sort, maxPrice, operators, amenities],
  );

  useEffect(() => {
    const t = setTimeout(() => search(), 250);
    return () => clearTimeout(t);
  }, [search]);

  // silently refresh stale counts when filters change
  useEffect(() => {
    search({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const dayStrip = useMemo(() => Array.from({ length: 5 }, (_, i) => addDays(new Date(), i)), []);
  const fromCity = from;
  const toCity = to;
  const route = routes.find((r) => (r.from_city === fromCity && r.to_city === toCity) || (r.from_city === toCity && r.to_city === fromCity));
  const activeFilters = operators.length + amenities.length + (maxPrice ? 1 : 0);

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  return (
    <div className="page wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">Intercity travel</h1>
          <p className="page-sub">Compare coaches across Ghana, pick your seat, board with a reference. No station queue.</p>
        </div>
        <div className="row gap-2 wrap">
          <Badge tone="green">
            <Bus size={12} /> 14 corridors
          </Badge>
          <Link to="/app/bookings">
            <Button variant="ghost" icon={<Tickets size={15} />}>
              My tickets
            </Button>
          </Link>
        </div>
      </div>

      <Card className="mb-3">
        <div className="trip-search">
          <Field label="Leaving from">
            <Select value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Origin city">
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <button
            className="icon-btn trip-search-swap"
            style={{ marginBottom: 1 }}
            onClick={swap}
            aria-label="Swap origin and destination"
            type="button"
          >
            <ArrowDownUp size={16} />
          </button>
          <Field label="Going to">
            <Select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Destination city">
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Travel date">
            <input className="input" type="date" value={date} min={toDateInput(new Date())} onChange={(e) => setDate(e.target.value)} aria-label="Travel date" />
          </Field>
          <Button onClick={() => search()} icon={<Search size={16} />} style={{ height: 46 }}>
            Search
          </Button>
        </div>

        <div className="row gap-2 mt-3 wrap">
          {dayStrip.map((d) => {
            const value = toDateInput(d);
            const active = value === date;
            return (
              <button key={value} className={`chip ${active ? 'active' : ''}`} onClick={() => setDate(value)}>
                <CalendarDays size={12} /> {isToday(d.toISOString()) ? 'Today' : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })}
              </button>
            );
          })}
          <button
            className={`chip ${showFilters ? 'active green' : ''}`}
            onClick={() => setShowFilters((v) => !v)}
            style={{ marginLeft: 'auto' }}
          >
            <SlidersHorizontal size={12} /> Filters {activeFilters ? `· ${activeFilters}` : ''}
          </button>
        </div>

        {showFilters ? (
          <div className="mt-3" style={{ borderTop: '1px solid var(--line-2)', paddingTop: 16 }}>
            <div className="grid three" style={{ gap: 20 }}>
              <div>
                <div className="section-title">Sort by</div>
                <div className="chips">
                  {SORTS.map((s) => (
                    <button key={s.value} className={`chip ${sort === s.value ? 'active' : ''}`} onClick={() => setSort(s.value)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="section-title">Max fare (GH₵)</div>
                <input
                  className="input"
                  type="number"
                  min={10}
                  max={500}
                  placeholder="Any price"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  aria-label="Maximum fare in Ghana cedis"
                />
              </div>
              <div>
                <div className="section-title">Operators</div>
                <div className="chips">
                  {(availableOperators.length ? availableOperators : ['Vibe Express', 'OA Travel', 'VIP Jeoun', 'STC Intercity']).map((op) => (
                    <button key={op} className={`chip ${operators.includes(op) ? 'active' : ''}`} onClick={() => toggle(operators, setOperators, op)}>
                      {op}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3">
              <div className="section-title">Onboard amenities</div>
              <div className="chips">
                {AMENITIES.map((a) => (
                  <button key={a} className={`chip ${amenities.includes(a) ? 'active' : ''}`} onClick={() => toggle(amenities, setAmenities, a)}>
                    {amenityLabel(a)}
                  </button>
                ))}
                {activeFilters ? (
                  <button
                    className="chip"
                    onClick={() => {
                      setOperators([]);
                      setAmenities([]);
                      setMaxPrice('');
                    }}
                    style={{ color: 'var(--red)' }}
                  >
                    <X size={12} /> Clear all
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </Card>

      <div className="split">
        <div className="col gap-4">
          <div className="row-between wrap">
            <div>
              <h2 style={{ fontSize: 17, letterSpacing: '-0.02em' }}>
                {from === to ? 'Pick two different cities' : `${from} → ${to}`}
              </h2>
              <p className="small muted">
                {date ? `${friendlyDay(`${date}T08:00:00`)} · ${formatDate(`${date}T08:00:00`, { day: 'numeric', month: 'long' })}` : 'Any date'}
                {trips ? ` · ${trips.length} departure${trips.length === 1 ? '' : 's'}` : ''}
                {route ? ` · ${route.distance_km} km, about ${formatDuration(route.duration_min)}` : ''}
              </p>
            </div>
            {trips && trips.length > 0 ? (
              <span className="tiny muted">
                <Filter size={12} style={{ verticalAlign: -1 }} /> Sorted by {SORTS.find((s) => s.value === sort)?.label.toLowerCase()}
              </span>
            ) : null}
          </div>

          {error ? (
            <div className="notice red">
              {error}
              <button className="link" style={{ marginLeft: 'auto', color: 'inherit' }} onClick={() => search()}>
                Retry
              </button>
            </div>
          ) : null}

          {loading || trips === null ? (
            <ListSkeleton rows={4} />
          ) : from === to ? (
            <Card>
              <EmptyState icon={<MapPin size={24} />} title="Same city, twice" description="Choose a different origin or destination to see departures." />
            </Card>
          ) : trips.length === 0 ? (
            <Card>
              <EmptyState
                icon={<Bus size={24} />}
                title="No departures match"
                description="Try another date, lift a filter, or check a nearby corridor. New departures are added daily."
                action={
                  <div className="row gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setOperators([]);
                        setAmenities([]);
                        setMaxPrice('');
                        setDate(toDateInput(addDays(new Date(), 1)));
                      }}
                    >
                      Clear filters
                    </Button>
                    <Button onClick={() => setDate(toDateInput(new Date()))}>See today</Button>
                  </div>
                }
              />
            </Card>
          ) : (
            <div className="col gap-3">
              {trips.map((t) => {
                const nearlyGone = t.seats_left <= 6;
                const soldOut = t.seats_left === 0;
                const nextDay = new Date(t.arrive_at).getDate() !== new Date(t.depart_at).getDate();
                return (
                  <Card key={t.id} pad={false} hover className="trip-card">
                    <div className="time-col">
                      <span className="time-big">{formatTime(t.depart_at)}</span>
                      <span className="time-date">{friendlyDay(t.depart_at)}</span>
                      <span className="time-date" style={{ color: 'var(--muted)' }}>
                        {formatTime(t.arrive_at)}
                        {nextDay ? ' +1' : ''}
                      </span>
                    </div>

                    <div className="col gap-2" style={{ minWidth: 0 }}>
                      <div className="row gap-2 wrap">
                        <span style={{ fontWeight: 800, fontSize: 15 }}>{t.operator}</span>
                        <Badge tone="outline">{t.vehicle_type}</Badge>
                        {soldOut ? <Badge tone="red">Sold out</Badge> : nearlyGone ? <Badge tone="amber">Only {t.seats_left} seats left</Badge> : <Badge tone="green">{t.seats_left} seats left</Badge>}
                      </div>
                      <div className="trip-path">
                        <span className="row gap-1">
                          <MapPin size={12} /> {t.from_city}
                        </span>
                        <span className="path-line" />
                        <span>{formatDuration(t.duration_min)}</span>
                        <span className="path-line" />
                        <span className="row gap-1">
                          <MapPin size={12} /> {t.to_city}
                        </span>
                      </div>
                      <div className="row gap-2 wrap">
                        {(t.amenities ?? []).slice(0, 4).map((a) => (
                          <span key={a} className="amenity">
                            {a === 'wifi' ? <Wifi size={10} /> : <Sparkles size={10} />} {amenityLabel(a)}
                          </span>
                        ))}
                        <span className="tiny muted row gap-1">
                          <Users size={11} /> {t.seats_taken}/{t.total_seats} booked
                        </span>
                      </div>
                    </div>

                    <div className="trip-cta col" style={{ alignItems: 'flex-end', gap: 8 }}>
                      <div className="right">
                        <div className="price-big">{formatGhs(t.price_cents)}</div>
                        <div className="tiny muted">per seat · {countdown(t.depart_at)}</div>
                      </div>
                      <Button
                        size="sm"
                        disabled={soldOut}
                        onClick={() => navigate(`/app/intercity/${t.id}`)}
                        icon={<ArrowRight size={14} />}
                      >
                        {soldOut ? 'Sold out' : 'Select seats'}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="col gap-4 sticky-side">
          <Card pad={false} style={{ overflow: 'hidden' }}>
            <GhanaMap from={from} to={to} height={210} />
          </Card>

          <Card>
            <div className="card-title mb-2">Popular corridors</div>
            <p className="small muted mb-3">Tap a route to load its departures.</p>
            <div className="col">
              {(routes.length ? routes : []).slice(0, 6).map((r) => (
                <button
                  key={r.id}
                  className="row gap-3"
                  style={{ background: 'none', border: 0, borderBottom: '1px solid var(--line-2)', padding: '10px 0', textAlign: 'left', cursor: 'pointer' }}
                  onClick={() => {
                    setFrom(r.from_city);
                    setTo(r.to_city);
                    setDate(toDateInput(new Date()));
                  }}
                >
                  <span className="row-icon" style={{ width: 32, height: 32 }}>
                    <Bus size={14} />
                  </span>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      {r.from_city} → {r.to_city}
                    </div>
                    <div className="tiny muted">
                      {r.departures ?? 0} departures · {formatDuration(r.duration_min)}
                    </div>
                  </div>
                  <div className="right">
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{r.min_price ? formatGhs(r.min_price) : formatGhs(r.base_price_cents)}</div>
                    <div className="tiny muted">from</div>
                  </div>
                </button>
              ))}
              {routes.length === 0 ? <span className="small muted">Loading routes…</span> : null}
            </div>
          </Card>

          <div className="card pad-sm" style={{ display: 'flex', gap: 11 }}>
            <span className="stat-icon" style={{ background: 'var(--green-050)', color: 'var(--green-700)' }}>
              <Star size={16} />
            </span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Free cancellation</div>
              <div className="tiny muted">Cancel 24h+ before departure for a full refund to your Rev wallet.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
