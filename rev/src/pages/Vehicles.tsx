import { useCallback, useEffect, useState } from 'react';
import { Car, Fuel, Pencil, Plus, ShieldCheck, Trash2, Users } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useToast } from '../lib/toast';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Modal, Select, Skeleton, Toggle } from '../components/ui';
import { formatDate } from '../lib/format';
import { TIERS } from '../../shared/travel';

type Vehicle = {
  id: string;
  make: string;
  model: string;
  plate: string;
  color: string;
  type: string;
  seats: number;
  is_active: number;
  created_at: string;
};

const empty = { make: '', model: '', plate: '', color: 'White', type: 'go', seats: 4, is_active: true };

export default function Vehicles() {
  const toast = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; vehicle?: Vehicle } | null>(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Vehicle | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.get<{ vehicles: Vehicle[] }>('/vehicles');
      setVehicles(d.vehicles);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load vehicles');
      setVehicles([]);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm(empty);
    setError('');
    setModal({ mode: 'create' });
  };
  const openEdit = (v: Vehicle) => {
    setForm({ make: v.make, model: v.model, plate: v.plate, color: v.color, type: v.type, seats: v.seats, is_active: Boolean(v.is_active) });
    setError('');
    setModal({ mode: 'edit', vehicle: v });
  };

  const save = async () => {
    if (!form.make.trim() || !form.model.trim() || !form.plate.trim()) {
      setError('Make, model and plate number are required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (modal?.mode === 'edit' && modal.vehicle) {
        const res = await api.patch<{ vehicle: Vehicle }>(`/vehicles/${modal.vehicle.id}`, form);
        setVehicles((prev) => (prev ?? []).map((v) => (v.id === res.vehicle.id ? res.vehicle : v)));
        toast.success('Vehicle updated');
      } else {
        const res = await api.post<{ vehicle: Vehicle }>('/vehicles', form);
        setVehicles((prev) => [res.vehicle, ...(prev ?? [])]);
        toast.success('Vehicle added to your fleet');
      }
      setModal(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this vehicle');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (v: Vehicle) => {
    const prev = vehicles ?? [];
    setVehicles(prev.map((x) => (x.id === v.id ? { ...x, is_active: x.is_active ? 0 : 1 } : x)));
    try {
      await api.patch(`/vehicles/${v.id}`, { is_active: !v.is_active });
      toast.success(v.is_active ? 'Vehicle set offline' : 'Vehicle is now online');
    } catch (err) {
      setVehicles(prev);
      toast.error(err instanceof ApiError ? err.message : 'Could not update vehicle');
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const prev = vehicles ?? [];
    setDeleteTarget(null);
    setVehicles(prev.filter((v) => v.id !== target.id));
    try {
      await api.del(`/vehicles/${target.id}`);
      toast.success('Vehicle removed');
    } catch (err) {
      setVehicles(prev);
      toast.error(err instanceof ApiError ? err.message : 'Could not remove vehicle');
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Your vehicles</h1>
          <p className="page-sub">Register the cars or bikes you drive with Rev. Only one needs to be online at a time.</p>
        </div>
        <Button onClick={openCreate} icon={<Plus size={16} />}>
          Add vehicle
        </Button>
      </div>

      {vehicles === null ? (
        <div className="grid three">
          {[0, 1].map((i) => (
            <Card key={i}>
              <Skeleton h={44} w={44} />
              <Skeleton h={16} w="60%" className="mt-3" />
              <Skeleton h={11} w="45%" className="mt-2" />
            </Card>
          ))}
        </div>
      ) : vehicles.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Car size={26} />}
            title="No vehicles registered"
            description="Add the car you drive to start accepting Rev trips. You can switch between vehicles any time."
            action={
              <Button onClick={openCreate} icon={<Plus size={15} />}>
                Add your first vehicle
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid two">
          {vehicles.map((v) => {
            const tier = TIERS.find((t) => t.id === v.type);
            return (
              <Card key={v.id} hover className="col" style={{ gap: 14 }}>
                <div className="row-between">
                  <div className="row gap-3">
                    <span className="row-icon" style={{ width: 46, height: 46, background: 'var(--green-050)', color: 'var(--green-700)' }}>
                      <Car size={22} />
                    </span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>
                        {v.make} {v.model}
                      </div>
                      <div className="tiny muted">
                        {v.color} · {v.seats} seats · {tier?.name ?? v.type}
                      </div>
                    </div>
                  </div>
                  <div className="row gap-2">
                    <Badge tone={v.is_active ? 'green' : 'default'}>
                      <span className="dot" /> {v.is_active ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                </div>

                <div className="row-between wrap gap-3">
                  <span className="plate" style={{ fontSize: 13 }}>
                    {v.plate}
                  </span>
                  <div className="row gap-4">
                    <span className="tiny muted row gap-1">
                      <Users size={12} /> {v.seats}
                    </span>
                    <span className="tiny muted row gap-1">
                      <Fuel size={12} /> {tier ? `₵${(tier.perKmCents / 100).toFixed(2)}/km` : '—'}
                    </span>
                    <span className="tiny muted row gap-1">
                      <ShieldCheck size={12} /> Insurance on file
                    </span>
                  </div>
                </div>

                <hr className="divider" />

                <div className="row-between wrap gap-3">
                  <div className="row gap-2">
                    <Toggle checked={Boolean(v.is_active)} onChange={() => toggleActive(v)} label={`Set ${v.make} ${v.model} online`} />
                    <span className="small" style={{ fontWeight: 600 }}>
                      {v.is_active ? 'Accepting trips' : 'Paused'}
                    </span>
                  </div>
                  <div className="row gap-2">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(v)} icon={<Pencil size={13} />}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" style={{ color: 'var(--red)' }} onClick={() => setDeleteTarget(v)} icon={<Trash2 size={13} />}>
                      Remove
                    </Button>
                  </div>
                </div>
                <span className="tiny muted">Added {formatDate(v.created_at)}</span>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? 'Edit vehicle' : 'Add a vehicle'}
        sub="Details are shown to riders before they book."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy}>
              {modal?.mode === 'edit' ? 'Save changes' : 'Add vehicle'}
            </Button>
          </>
        }
      >
        <div className="col gap-4">
          <div className="grid two" style={{ gap: 12 }}>
            <Field label="Make">
              <Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="Toyota" />
            </Field>
            <Field label="Model">
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="Corolla" />
            </Field>
          </div>
          <div className="grid two" style={{ gap: 12 }}>
            <Field label="Plate number">
              <Input value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value.toUpperCase() })} placeholder="GC 4821-24" />
            </Field>
            <Field label="Colour">
              <Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Silver" />
            </Field>
          </div>
          <div className="grid two" style={{ gap: 12 }}>
            <Field label="Service tier">
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {TIERS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Seats">
              <Input type="number" min={1} max={20} value={form.seats} onChange={(e) => setForm({ ...form, seats: Number(e.target.value) })} />
            </Field>
          </div>
          <div className="row-between" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 13px' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5 }}>Go online now</div>
              <div className="tiny muted">Start receiving trip requests immediately.</div>
            </div>
            <Toggle checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} label="Go online" />
          </div>
          {error ? <div className="notice red">{error}</div> : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        danger
        title="Remove this vehicle?"
        confirmLabel="Remove vehicle"
        body={`${deleteTarget?.make ?? ''} ${deleteTarget?.model ?? ''} (${deleteTarget?.plate ?? ''}) will be unregistered from your Rev driver profile.`}
      />
    </div>
  );
}
