import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Bus,
  CalendarClock,
  Check,
  Clock,
  Download,
  MapPin,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
  Wifi,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { Badge, Button, Card, EmptyState, Field, Input, ListSkeleton, Skeleton } from '../components/ui';
import { GhanaMap } from '../components/MapView';
import { amenityLabel, countdown, formatDateLong, formatDuration, formatGhs, formatTime, paymentLabel } from '../lib/format';

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
  from_city: string;
  to_city: string;
  distance_km: number;
  duration_min: number;
  status: string;
};
type Seat = { label: string; taken: boolean; window: boolean };
type Booking = {
  id: string;
  reference: string;
  seat_labels: string[];
  total_cents: number;
  seats: number;
  status: string;
  passenger_name: string;
  depart_at: string;
  arrive_at: string;
  operator: string;
  from_city: string;
  to_city: string;
  vehicle_type: string;
  payment_method: string;
};

function makeIcs(trip: Trip, booking: Booking) {
  const fmt = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Rev Mobility//Intercity//EN',
    'BEGIN:VEVENT',
    `UID:${booking.reference}@rev.app`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(trip.depart_at)}`,
    `DTEND:${fmt(trip.arrive_at)}`,
    `SUMMARY:Rev ${trip.from_city} → ${trip.to_city} (${trip.operator})`,
    `LOCATION:${trip.from_city} departure terminal`,
    `DESCRIPTION:Booking ${booking.reference} · Seats ${booking.seat_labels.join(', ')} · ${booking.passenger_name}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

export default function TripDetail() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { user, patchUser } = useAuth();
  const toast = useToast();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [payment, setPayment] = useState('wallet');
  const [busy, setBusy] = useState(false);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [formError, setFormError] = useState('');

  const load = () => {
    if (!tripId) return;
    setLoading(true);
    api
      .get<{ trip: Trip; seats: Seat[] }>(`/intercity/trips/${tripId}`)
      .then((d) => {
        setTrip(d.trip);
        setSeats(d.seats);
        setPicked((prev) => prev.filter((l) => d.seats.some((s) => s.label === l && !s.taken)));
        setError('');
      })
      .catch((err: any) => setError(err?.message ?? 'Could not load this departure'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [tripId]);

  useEffect(() => {
    if (user) {
      setName((n) => n || user.name);
      setPhone((p) => p || user.phone);
      const def = user.payment_methods?.find((m) => m.is_default);
      if (def) setPayment(def.kind);
    }
  }, [user]);

  const rows = useMemo(() => {
    const map = new Map<number, Seat[]>();
    for (const s of seats) {
      const row = Number(s.label.replace(/\D/g, '')) || 1;
      if (!map.has(row)) map.set(row, []);
      map.get(row)!.push(s);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [seats]);

  const total = (trip?.price_cents ?? 0) * picked.length;
  const fee = picked.length ? Math.round(total * 0.015) : 0;

  const toggleSeat = (seat: Seat) => {
    if (seat.taken) return;
    setPicked((prev) => {
      if (prev.includes(seat.label)) return prev.filter((l) => l !== seat.label);
      if (prev.length >= 6) {
        toast.info('Up to 6 seats per booking. Make a second booking for more.');
        return prev;
      }
      return [...prev, seat.label];
    });
  };

  const submit = async () => {
    if (!trip) return;
    if (picked.length === 0) {
      setFormError('Pick at least one seat from the map.');
      return;
    }
    if (!name.trim()) {
      setFormError('Enter the passenger name.');
      return;
    }
    setFormError('');
    setBusy(true);
    try {
      const res = await api.post<{ booking: Booking }>('/intercity/bookings', {
        trip_id: trip.id,
        seats: picked.length,
        seat_labels: picked,
        passenger_name: name,
        passenger_phone: phone,
        payment_method: payment,
      });
      setBooking(res.booking);
      const me = await api.get<{ user: any }>('/auth/me');
      if (me.user) patchUser(me.user);
      toast.success('Seats confirmed — see you on board!');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not complete this booking';
      setFormError(msg);
      toast.error(msg);
      load();
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!trip || !booking) return;
    const blob = new Blob([makeIcs(trip, booking)], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rev-${booking.reference}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="page">
        <Skeleton h={14} w={140} />
        <div className="split mt-4">
          <ListSkeleton rows={3} />
          <Skeleton h={280} className="box" />
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="page">
        <Card>
          <EmptyState
            icon={<Bus size={24} />}
            title="Departure not found"
            description={error || 'This departure may have been removed or already left.'}
            action={
              <Button onClick={() => navigate('/app/intercity')} icon={<ArrowLeft size={15} />}>
                Back to departures
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  /* ------------------------------ success ------------------------------ */
  if (booking) {
    return (
      <div className="page">
        <div className="row gap-2 mb-3">
          <Badge tone="green">
            <Check size={12} /> Booking confirmed
          </Badge>
          <span className="tiny muted mono">{booking.reference}</span>
        </div>
        <div className="split">
          <div className="col gap-4">
            <Card>
              <div className="row gap-3 mb-4">
                <span className="stat-icon" style={{ width: 46, height: 46, background: 'var(--green-050)', color: 'var(--green-700)' }}>
                  <Check size={22} strokeWidth={3} />
                </span>
                <div>
                  <h1 style={{ fontSize: 24, letterSpacing: '-0.03em' }}>You're booked, {booking.passenger_name.split(' ')[0]}</h1>
                  <p className="small muted">
                    {booking.from_city} → {booking.to_city} · {formatDateLong(booking.depart_at)}
                  </p>
                </div>
              </div>

              <div
                style={{
                  border: '1px dashed #cfdbcd',
                  borderRadius: 16,
                  padding: 18,
                  background: 'linear-gradient(160deg,#f8fcf6,#fff)',
                }}
              >
                <div className="row-between wrap gap-3">
                  <div>
                    <div className="eyebrow">Booking reference</div>
                    <div className="mono" style={{ fontSize: 26, fontWeight: 700, letterSpacing: '0.06em' }}>
                      {booking.reference}
                    </div>
                  </div>
                  <div className="right">
                    <div className="eyebrow">Operator</div>
                    <div style={{ fontWeight: 800 }}>{booking.operator}</div>
                    <div className="tiny muted">{booking.vehicle_type}</div>
                  </div>
                </div>
                <hr className="divider mt-3 mb-3" />
                <div className="grid three" style={{ gap: 14 }}>
                  <div>
                    <div className="eyebrow">Departs</div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{formatTime(booking.depart_at)}</div>
                    <div className="tiny muted">{formatDateLong(booking.depart_at)}</div>
                  </div>
                  <div>
                    <div className="eyebrow">Arrives</div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{formatTime(booking.arrive_at)}</div>
                    <div className="tiny muted">{formatDateLong(booking.arrive_at)}</div>
                  </div>
                  <div>
                    <div className="eyebrow">Seats</div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{booking.seat_labels.join(' · ')}</div>
                    <div className="tiny muted">
                      {booking.seats} seat{booking.seats > 1 ? 's' : ''} · {paymentLabel(booking.payment_method)}
                    </div>
                  </div>
                </div>
                <div className="row-between mt-4">
                  <span className="tiny muted">Show this reference at boarding. Arrive 20 minutes early.</span>
                  <span style={{ fontWeight: 800 }}>{formatGhs(booking.total_cents)}</span>
                </div>
              </div>

              <div className="row gap-2 mt-4 wrap">
                <Button variant="ghost" onClick={download} icon={<Download size={15} />}>
                  Add to calendar
                </Button>
                <Button variant="ghost" onClick={() => window.print()} icon={<Ticket size={15} />}>
                  Print ticket
                </Button>
                <Button onClick={() => navigate('/app/bookings')} icon={<ArrowRight size={15} />}>
                  View my bookings
                </Button>
              </div>
            </Card>

            <Card pad={false} style={{ overflow: 'hidden' }}>
              <GhanaMap from={booking.from_city} to={booking.to_city} height={220} />
            </Card>
          </div>

          <div className="col gap-4">
            <Card>
              <div className="card-title mb-3">What happens next</div>
              <div className="steps">
                {[
                  'You will receive a boarding reminder 3 hours before departure.',
                  'Arrive at the terminal 20 minutes early with this reference.',
                  'Show your reference or QR to the conductor to take your seat.',
                  'Cancel up to 24h before departure for a full wallet refund.',
                ].map((t, i) => (
                  <div key={i} className={`step ${i === 0 ? 'current' : ''}`}>
                    <span className="step-dot" />
                    <div className="step-sub" style={{ color: 'var(--text)', fontSize: 13.5 }}>
                      {t}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <Card>
              <div className="row gap-3">
                <span className="stat-icon">
                  <ShieldCheck size={17} />
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>Rev Guarantee</div>
                  <div className="tiny muted">Delayed or cancelled coach? We refund the full fare to your wallet within minutes.</div>
                </div>
              </div>
            </Card>
            <Button variant="ghost" block onClick={() => navigate('/app/intercity')}>
              Book another trip
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const soldOut = trip.seats_left === 0;
  const departed = new Date(trip.depart_at).getTime() < Date.now();

  return (
    <div className="page">
      <Link to="/app/intercity" className="row gap-2 small muted mb-3" style={{ fontWeight: 700 }}>
        <ArrowLeft size={15} /> All departures
      </Link>

      <div className="page-head">
        <div>
          <div className="row gap-2 mb-2">
            <Badge tone="outline">{trip.operator}</Badge>
            <Badge tone="outline">{trip.vehicle_type}</Badge>
            {soldOut ? <Badge tone="red">Sold out</Badge> : null}
          </div>
          <h1 className="page-title">
            {trip.from_city} <span style={{ color: 'var(--muted-2)' }}>→</span> {trip.to_city}
          </h1>
          <p className="page-sub">
            {formatDateLong(trip.depart_at)} · departs {formatTime(trip.depart_at)} · arrives {formatTime(trip.arrive_at)} · {formatDuration(trip.duration_min)}
          </p>
        </div>
        <div className="right">
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em' }}>{formatGhs(trip.price_cents)}</div>
          <div className="tiny muted">per seat</div>
        </div>
      </div>

      <div className="split">
        <div className="col gap-4">
          <Card>
            <div className="row-between mb-3 wrap">
              <div>
                <div className="card-title">Pick your seats</div>
                <div className="small muted">Up to 6 per booking · {trip.seats_left} of {trip.total_seats} available</div>
              </div>
              <div className="seat-legend">
                <span>
                  <span className="seat-swatch" /> Available
                </span>
                <span>
                  <span className="seat-swatch sel" /> Selected
                </span>
                <span>
                  <span className="seat-swatch taken" /> Taken
                </span>
              </div>
            </div>

            {soldOut ? (
              <EmptyState
                icon={<Users size={24} />}
                title="This coach is full"
                description="Every seat is booked. Try the next departure on this route."
                action={<Button onClick={() => navigate('/app/intercity')}>See other times</Button>}
              />
            ) : (
              <div className="row gap-4 wrap" style={{ alignItems: 'flex-start' }}>
                <div className="seat-map" style={{ maxHeight: 430, overflowY: 'auto' }}>
                  <div className="driver-marker">Front · Driver</div>
                  {rows.map(([row, rowSeats]) => (
                    <div className="seat-row" key={row}>
                      {rowSeats.slice(0, 2).map((s) => (
                        <SeatButton key={s.label} seat={s} selected={picked.includes(s.label)} onClick={() => toggleSeat(s)} />
                      ))}
                      <span className="aisle" />
                      {rowSeats.slice(2).map((s) => (
                        <SeatButton key={s.label} seat={s} selected={picked.includes(s.label)} onClick={() => toggleSeat(s)} />
                      ))}
                    </div>
                  ))}
                  <div className="driver-marker" style={{ borderBottom: 0, borderTop: '1px dashed var(--line)', paddingTop: 8, marginTop: 4, paddingBottom: 0, marginBottom: 0 }}>
                    Rear exit
                  </div>
                </div>

                <div className="grow col gap-3" style={{ minWidth: 240 }}>
                  <div className="notice">
                    <Sparkles size={16} />
                    <span>Window seats are marked with a dot. Seats 1A–2B board first.</span>
                  </div>
                  <div>
                    <div className="section-title">Your selection</div>
                    {picked.length === 0 ? (
                      <div className="small muted">No seats selected yet. Tap a seat on the map.</div>
                    ) : (
                      <div className="chips">
                        {picked.map((label) => (
                          <button key={label} className="chip active green" onClick={() => setPicked(picked.filter((l) => l !== label))}>
                            Seat {label} <span style={{ opacity: 0.7 }}>×</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="grid two" style={{ gap: 12 }}>
                    <Field label="Passenger name">
                      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
                    </Field>
                    <Field label="Phone (for boarding)">
                      <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+233 …" />
                    </Field>
                  </div>
                  <Field label="Payment method">
                    <select className="select" value={payment} onChange={(e) => setPayment(e.target.value)} aria-label="Payment method">
                      <option value="wallet">Rev Wallet · {formatGhs(user?.wallet_cents ?? 0)}</option>
                      <option value="momo">Mobile Money</option>
                      <option value="card">Card</option>
                      <option value="cash">Cash at terminal</option>
                    </select>
                  </Field>
                  {formError ? <div className="notice red">{formError}</div> : null}
                </div>
              </div>
            )}
          </Card>

          <Card>
            <div className="card-title mb-3">On this coach</div>
            <div className="grid three" style={{ gap: 12 }}>
              {[
                { icon: <Wifi size={15} />, label: 'Amenities', value: (trip.amenities ?? []).map(amenityLabel).join(' · ') || 'Standard seating' },
                { icon: <Clock size={15} />, label: 'Journey time', value: formatDuration(trip.duration_min) },
                { icon: <MapPin size={15} />, label: 'Distance', value: `${trip.distance_km} km` },
              ].map((f) => (
                <div key={f.label}>
                  <div className="row gap-2 tiny muted" style={{ fontWeight: 700 }}>
                    {f.icon} {f.label}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13.5, marginTop: 3 }}>{f.value}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="col gap-4 sticky-side">
          <Card>
            <div className="row-between mb-3">
              <span className="card-title">Your trip</span>
              <span className="badge blue">{countdown(trip.depart_at)}</span>
            </div>
            <div className="row gap-3">
              <div className="col" style={{ gap: 4, paddingTop: 3 }}>
                <span style={{ width: 9, height: 9, borderRadius: 99, background: 'var(--green)' }} />
                <span style={{ width: 2, height: 28, background: 'var(--line)', marginLeft: 3.5 }} />
                <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--ink)' }} />
              </div>
              <div className="col gap-3">
                <div>
                  <div style={{ fontWeight: 700 }}>{trip.from_city}</div>
                  <div className="tiny muted">
                    {formatTime(trip.depart_at)} · departure terminal
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{trip.to_city}</div>
                  <div className="tiny muted">{formatTime(trip.arrive_at)} · arrival terminal</div>
                </div>
              </div>
            </div>
            <hr className="divider mt-3 mb-3" />
            <div className="kv">
              <dt>
                Seats {picked.length ? `(${picked.join(', ')})` : ''}
              </dt>
              <dd>{picked.length || 0} × {formatGhs(trip.price_cents)}</dd>
            </div>
            <div className="kv">
              <dt>Booking fee</dt>
              <dd>{fee ? formatGhs(fee) : 'GH₵0.00'}</dd>
            </div>
            <hr className="divider mt-1 mb-2" />
            <div className="row-between">
              <span style={{ fontWeight: 700 }}>Total</span>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>{formatGhs(total + fee)}</span>
            </div>
            <Button className="mt-3" block size="lg" onClick={submit} loading={busy} disabled={soldOut || departed || picked.length === 0} icon={<ArrowRight size={16} />}>
              {departed ? 'Departed' : soldOut ? 'Sold out' : `Pay & confirm · ${formatGhs(total + fee)}`}
            </Button>
            <p className="tiny muted center mt-2">
              <ShieldCheck size={11} style={{ verticalAlign: -1 }} /> Free cancellation up to 24h before departure
            </p>
          </Card>

          <Card pad={false} style={{ overflow: 'hidden' }}>
            <GhanaMap from={trip.from_city} to={trip.to_city} height={190} />
          </Card>

          <div className="card pad-sm">
            <div className="row gap-3">
              <span className="stat-icon" style={{ background: 'var(--blue-050)', color: 'var(--blue)' }}>
                <CalendarClock size={16} />
              </span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>Seats are held live</div>
                <div className="tiny muted">Availability updates as other passengers book. Your selection is confirmed when you pay.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SeatButton({ seat, selected, onClick }: { seat: Seat; selected: boolean; onClick: () => void }) {
  return (
    <button
      className={`seat ${selected ? 'sel' : ''}`}
      disabled={seat.taken}
      onClick={onClick}
      aria-label={`Seat ${seat.label}${seat.taken ? ' (taken)' : seat.window ? ' (window)' : ''}`}
      aria-pressed={selected}
      title={`Seat ${seat.label}${seat.window ? ' · window' : ''}`}
    >
      {seat.label}
      {seat.window ? <span style={{ position: 'absolute', top: 3, right: 4, width: 4, height: 4, borderRadius: 99, background: selected ? '#fff' : 'var(--green)' }} /> : null}
    </button>
  );
}
