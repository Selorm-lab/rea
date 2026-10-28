import { useState } from 'react';
import { Check, Circle, Loader2, MessageSquare, Phone, Star } from 'lucide-react';
import { Button, Field, Modal, Stars, Textarea } from './ui';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { formatGhs } from '../lib/format';

export type Ride = {
  id: string;
  pickup_name: string;
  pickup_address: string;
  dropoff_name: string;
  dropoff_address: string;
  tier: string;
  tier_name?: string;
  tier_emoji?: string;
  distance_km: number;
  duration_min: number;
  fare_cents: number;
  status: 'scheduled' | 'searching' | 'arriving' | 'in_progress' | 'completed' | 'cancelled';
  payment_method: string;
  scheduled_for: string | null;
  notes: string;
  rating: number | null;
  review: string;
  created_at: string;
  completed_at: string | null;
  driver?: { id: string; name: string; vehicle: string; plate: string; rating: number; trips: number; color: string } | null;
};

const ORDER: Array<{ key: Ride['status']; title: string; sub: string }> = [
  { key: 'searching', title: 'Finding your driver', sub: 'Matching you with a nearby Rev driver' },
  { key: 'arriving', title: 'Driver on the way', sub: 'Meet at your pickup point' },
  { key: 'in_progress', title: 'On the trip', sub: 'Sit back — you are on your way' },
  { key: 'completed', title: 'Arrived', sub: 'Trip complete' },
];

export function RideSteps({ ride }: { ride: Ride }) {
  const activeIndex = ORDER.findIndex((s) => s.key === ride.status);
  return (
    <div className="steps">
      {ORDER.map((step, i) => {
        const state = ride.status === 'completed' ? 'done' : i < activeIndex ? 'done' : i === activeIndex ? 'current' : 'todo';
        return (
          <div key={step.key} className={`step ${state === 'todo' ? '' : state}`}>
            <span className="step-dot">{state === 'done' ? <Check size={12} strokeWidth={3.5} /> : null}</span>
            <div>
              <div className="step-title" style={{ color: state === 'todo' ? 'var(--muted-2)' : undefined }}>
                {step.title}
              </div>
              <div className="step-sub">
                {step.key === 'searching' && ride.status === 'searching' ? (
                  <span className="row gap-2">
                    <Loader2 size={12} style={{ animation: 'spin 0.9s linear infinite' }} /> Usually under 30 seconds
                  </span>
                ) : (
                  step.sub
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DriverCard({ ride }: { ride: Ride }) {
  const driver = ride.driver;
  if (!driver) {
    return (
      <div className="driver-card">
        <div className="sk circle" style={{ width: 44, height: 44 }} />
        <div className="grow col gap-2">
          <div className="sk text" style={{ width: '55%' }} />
          <div className="sk text" style={{ width: '38%', height: 10 }} />
        </div>
        <Loader2 size={16} style={{ animation: 'spin 0.9s linear infinite', color: 'var(--green)' }} />
      </div>
    );
  }
  return (
    <div className="driver-card">
      <span className="avatar" style={{ width: 44, height: 44, background: driver.color, fontSize: 15 }}>
        {driver.name
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')}
      </span>
      <div className="grow col" style={{ minWidth: 0 }}>
        <span style={{ fontWeight: 800, fontSize: 14.5 }}>{driver.name}</span>
        <span className="small muted truncate">
          {driver.vehicle} · <span className="plate">{driver.plate}</span>
        </span>
        <span className="tiny" style={{ color: 'var(--amber)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
          <Star size={11} fill="currentColor" /> {driver.rating.toFixed(1)} · {driver.trips.toLocaleString()} trips
        </span>
      </div>
      <div className="row gap-2">
        <a className="icon-btn" href={`tel:${driver.plate}`} aria-label={`Call ${driver.name}`} title="Call driver">
          <Phone size={15} />
        </a>
        <button className="icon-btn" aria-label="Message driver" title="Message driver" onClick={() => alert(`Message ${driver.name}: "I'm at the pickup point."`)}>
          <MessageSquare size={15} />
        </button>
      </div>
    </div>
  );
}

export function RateRideModal({ ride, onClose, onRated }: { ride: Ride | null; onClose: () => void; onRated: (ride: Ride) => void }) {
  const toast = useToast();
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!ride) return;
    setBusy(true);
    try {
      const data = await api.patch<{ ride: Ride }>(`/rides/${ride.id}`, { rating, review });
      onRated(data.ride);
      toast.success('Thanks for rating your ride');
      onClose();
      setReview('');
      setRating(5);
    } catch (err: any) {
      toast.error(err?.message ?? 'Could not save your rating');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={Boolean(ride)}
      onClose={onClose}
      title="How was your ride?"
      sub={ride ? `${ride.pickup_name} → ${ride.dropoff_name} · ${formatGhs(ride.fare_cents)}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Later
          </Button>
          <Button onClick={submit} loading={busy}>
            Submit rating
          </Button>
        </>
      }
    >
      <div className="col gap-4">
        <div className="center col gap-2" style={{ alignItems: 'center' }}>
          <Stars value={rating} onChange={setRating} size={30} />
          <span className="small muted">
            {['Poor', 'Below average', 'Okay', 'Good', 'Excellent'][rating - 1]} · {rating}.0
          </span>
        </div>
        <Field label="Add a note (optional)">
          <Textarea value={review} onChange={(e) => setReview(e.target.value)} placeholder="Smooth trip, friendly driver…" maxLength={500} />
        </Field>
      </div>
    </Modal>
  );
}

export function RideStatusIcon({ status }: { status: Ride['status'] }) {
  if (status === 'completed') return <Check size={16} />;
  if (status === 'cancelled') return <Circle size={14} />;
  return <Loader2 size={15} />;
}
