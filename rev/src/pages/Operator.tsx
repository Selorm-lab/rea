import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus, CalendarPlus, Clock, Gauge, MapPin, Pencil, PlusCircle, Trash2, TrendingUp, Users } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, ListSkeleton, Modal, ProgressBar, Select, StatCard, Tabs } from '../components/ui';
import { addDays, formatDate, formatGhs, formatTime, toDateTimeInput } from '../lib/format';
import { AMENITY_LABELS } from '../lib/constants';

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
  duration_min: number;
  created_by: string | null;
};

type Form = {
  from_city: string;
  to_city: string;
  depart_at: string;
  price: string;
  total_seats: number;
  operator: string;
  vehicle_type: string;
  amenities: string[];
};

const cities = ['Accra', 'Kumasi', 'Cape Coast', 'Takoradi', 'Ho', 'Tamale', 'Bolgatanga', 'Wa', 'Sunyani', 'Koforidua', 'Aflao', 'Hohoe', 'Techiman', 'Lomé'];

const defaultForm = (): Form => ({
  from_city: 'Accra',
  to_city: 'Kumasi',
  depart_at: toDateTimeInput(new Date(addDays(new Date(), 1).setHours(7, 0, 0, 0))),
  price: '120',
  total_seats: 32,
  operator: 'Rev Shuttle',
  vehicle_type: 'Air-conditioned Coach',
  amenities: ['ac', 'wifi'],
});

export default function Operator() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [tab, setTab] = useState<'all' | 'mine' | 'today'>('all');
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; trip?: Trip } | null>(null);
  const [form, setForm] = useState<Form>(defaultForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Trip | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.get<{ trips: Trip[] }>('/intercity/manage/trips');
      setTrips(d.trips);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load departures');
      setTrips([]);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!trips) return [];
    if (tab === 'mine') return trips.filter((t) => t.created_by === user?.id);
    if (tab === 'today') {
      return trips.filter((t) => new Date(t.depart_at).toDateString() === new Date().toDateString());
    }
    return trips;
  }, [trips, tab, user?.id]);

  const upcoming = (trips ?? []).filter((t) => new Date(t.depart_at).getTime() > Date.now());
  const totalRevenue = (trips ?? []).reduce((sum, t) => sum + t.seats_taken * t.price_cents, 0);
  const occupancy = upcoming.length ? upcoming.reduce((s, t) => s + t.seats_taken / t.total_seats, 0) / upcoming.length * 100 : 0;

  const openCreate = () => {
    setForm(defaultForm());
    setError('');
    setModal({ mode: 'create' });
  };

  const openEdit = (t: Trip) => {
    setForm({
      from_city: t.from_city,
      to_city: t.to_city,
      depart_at: toDateTimeInput(new Date(t.depart_at)),
      price: String(t.price_cents / 100),
      total_seats: t.total_seats,
      operator: t.operator,
      vehicle_type: t.vehicle_type,
      amenities: t.amenities ?? [],
    });
    setError('');
    setModal({ mode: 'edit', trip: t });
  };

  const save = async () => {
    if (form.from_city === form.to_city) {
      setError('Origin and destination must be different.');
      return;
    }
    const price = Math.round(Number(form.price) * 100);
    if (!Number.isFinite(price) || price < 100) {
      setError('Enter a fare of at least GH₵1.00');
      return;
    }
    setBusy(true);
    setError('');
    const payload = {
      from_city: form.from_city,
      to_city: form.to_city,
      depart_at: new Date(form.depart_at).toISOString(),
      price_cents: price,
      total_seats: form.total_seats,
      operator: form.operator,
      vehicle_type: form.vehicle_type,
      amenities: form.amenities,
    };
    try {
      if (modal?.mode === 'edit' && modal.trip) {
        const res = await api.patch<{ trip: Trip }>(`/intercity/manage/trips/${modal.trip.id}`, payload);
        setTrips((prev) => (prev ?? []).map((t) => (t.id === res.trip.id ? res.trip : t)));
        toast.success('Departure updated');
      } else {
        const res = await api.post<{ trip: Trip }>('/intercity/manage/trips', payload);
        setTrips((prev) => [res.trip, ...(prev ?? [])].sort((a, b) => +new Date(a.depart_at) - +new Date(b.depart_at)));
        toast.success('Departure published');
      }
      setModal(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this departure');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const prev = trips ?? [];
    setDeleteTarget(null);
    setTrips(prev.filter((t) => t.id !== target.id));
    try {
      await api.del(`/intercity/manage/trips/${target.id}`);
      toast.success('Departure removed');
    } catch (err) {
      setTrips(prev);
      toast.error(err instanceof ApiError ? err.message : 'Could not remove this departure');
    }
  };

  const canManage = (t: Trip) => user?.role === 'operator' || t.created_by === user?.id;

  return (
    <div className="page wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">Operator console</h1>
          <p className="page-sub">
            Publish intercity departures, watch seat inventory and manage your corridor.
            {user?.role !== 'operator' ? ' You can manage the departures you publish.' : ''}
          </p>
        </div>
        <Button onClick={openCreate} icon={<PlusCircle size={16} />}>
          New departure
        </Button>
      </div>

      <div className="grid four mb-3">
        <StatCard label="Published departures" value={trips ? trips.length : '—'} hint={`${upcoming.length} still ahead`} icon={<Bus size={16} />} />
        <StatCard label="Seats sold" value={trips ? trips.reduce((s, t) => s + t.seats_taken, 0) : '—'} hint="Across all departures" icon={<Users size={16} />} />
        <StatCard label="Average occupancy" value={`${occupancy.toFixed(0)}%`} hint="Upcoming departures" icon={<Gauge size={16} />} />
        <StatCard label="Gross revenue" value={formatGhs(totalRevenue)} hint="Seat revenue to date" icon={<TrendingUp size={16} />} />
      </div>

      <Card pad={false} className="mb-3">
        <div style={{ padding: '0 16px' }}>
          <Tabs
            value={tab}
            onChange={setTab}
            options={[
              { value: 'all', label: 'All departures', count: trips?.length },
              { value: 'mine', label: 'Published by me', count: trips?.filter((t) => t.created_by === user?.id).length },
              { value: 'today', label: 'Today' },
            ]}
          />
        </div>
        <div style={{ padding: 16 }}>
          {trips === null ? (
            <ListSkeleton rows={4} />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<CalendarPlus size={24} />}
              title={tab === 'mine' ? 'You have not published a departure yet' : 'No departures here'}
              description="Create a departure and it appears instantly in the public intercity search for passengers to book."
              action={
                <Button onClick={openCreate} icon={<PlusCircle size={15} />}>
                  Publish a departure
                </Button>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Route</th>
                    <th>Departs</th>
                    <th>Operator</th>
                    <th>Fare</th>
                    <th style={{ minWidth: 150 }}>Occupancy</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => {
                    const pct = Math.round((t.seats_taken / t.total_seats) * 100);
                    const past = new Date(t.depart_at).getTime() < Date.now();
                    return (
                      <tr key={t.id}>
                        <td>
                          <div style={{ fontWeight: 700 }}>
                            {t.from_city} → {t.to_city}
                          </div>
                          <div className="tiny muted">{t.vehicle_type}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{formatDate(t.depart_at)}</div>
                          <div className="tiny muted">{formatTime(t.depart_at)}</div>
                        </td>
                        <td>
                          <span className="small">{t.operator}</span>
                          {t.created_by === user?.id ? (
                            <div>
                              <Badge tone="green" style={{ marginTop: 4 }}>
                                Yours
                              </Badge>
                            </div>
                          ) : null}
                        </td>
                        <td style={{ fontWeight: 700 }}>{formatGhs(t.price_cents)}</td>
                        <td>
                          <div className="row-between tiny muted" style={{ marginBottom: 5 }}>
                            <span>
                              {t.seats_taken}/{t.total_seats}
                            </span>
                            <span>{pct}%</span>
                          </div>
                          <ProgressBar value={pct} tone={pct > 85 ? 'amber' : undefined} />
                        </td>
                        <td>
                          <div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                            <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => navigate(`/app/intercity/${t.id}`)} aria-label="View departure">
                              <Bus size={14} />
                            </button>
                            {canManage(t) && !past ? (
                              <>
                                <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => openEdit(t)} aria-label="Edit departure">
                                  <Pencil size={14} />
                                </button>
                                <button className="icon-btn danger" style={{ width: 32, height: 32 }} onClick={() => setDeleteTarget(t)} aria-label="Delete departure">
                                  <Trash2 size={14} />
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      <div className="card pad-sm row gap-3">
        <span className="stat-icon" style={{ background: 'var(--blue-050)', color: 'var(--blue)' }}>
          <Clock size={16} />
        </span>
        <div className="grow">
          <div style={{ fontWeight: 700, fontSize: 13 }}>Departures auto-close at departure time</div>
          <div className="tiny muted">Passengers can cancel up to 24h ahead. Seat inventory updates live as bookings come in.</div>
        </div>
      </div>

      <Modal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        size="lg"
        title={modal?.mode === 'edit' ? 'Edit departure' : 'Publish a departure'}
        sub="This appears in intercity search immediately."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy}>
              {modal?.mode === 'edit' ? 'Save changes' : 'Publish departure'}
            </Button>
          </>
        }
      >
        <div className="col gap-4">
          <div className="grid two" style={{ gap: 12 }}>
            <Field label="Leaving from">
              <Select value={form.from_city} onChange={(e) => setForm({ ...form, from_city: e.target.value })}>
                {cities.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Going to">
              <Select value={form.to_city} onChange={(e) => setForm({ ...form, to_city: e.target.value })}>
                {cities.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid two" style={{ gap: 12 }}>
            <Field label="Departure date & time">
              <Input type="datetime-local" value={form.depart_at} onChange={(e) => setForm({ ...form, depart_at: e.target.value })} />
            </Field>
            <Field label="Fare per seat (GH₵)">
              <Input type="number" min={1} step={1} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </Field>
          </div>
          <div className="grid two" style={{ gap: 12 }}>
            <Field label="Operator">
              <Input value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })} placeholder="Vibe Express" />
            </Field>
            <Field label="Vehicle type">
              <Select value={form.vehicle_type} onChange={(e) => setForm({ ...form, vehicle_type: e.target.value })}>
                {['Air-conditioned Coach', 'Executive Coach', 'Sprinter', 'Double-decker', 'Mini bus'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Total seats">
            <Input type="number" min={4} max={80} value={form.total_seats} onChange={(e) => setForm({ ...form, total_seats: Number(e.target.value) })} />
          </Field>
          <Field label="Amenities">
            <div className="chips">
              {AMENITY_LABELS.map((a) => (
                <button
                  key={a.key}
                  className={`chip ${form.amenities.includes(a.key) ? 'active' : ''}`}
                  onClick={() =>
                    setForm({
                      ...form,
                      amenities: form.amenities.includes(a.key) ? form.amenities.filter((x) => x !== a.key) : [...form.amenities, a.key],
                    })
                  }
                >
                  {a.label}
                </button>
              ))}
            </div>
          </Field>
          {error ? <div className="notice red">{error}</div> : null}
          <div className="notice">
            <MapPin size={15} />
            <span>Seats already booked: {modal?.trip ? modal.trip.seats_taken : 0}. You cannot reduce capacity below that.</span>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        danger
        title="Delete this departure?"
        confirmLabel="Delete departure"
        body={
          deleteTarget && deleteTarget.seats_taken > 0
            ? `This departure has ${deleteTarget.seats_taken} seats sold. You must cancel those bookings first — the server will block deletion.`
            : 'The departure will be removed from the timetable and will no longer be bookable.'
        }
      />
    </div>
  );
}
