import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Dumbbell,
  GraduationCap,
  Heart,
  Home,
  MapPin,
  Navigation,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Utensils,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useToast } from '../lib/toast';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, Input, Modal, Skeleton, Textarea } from '../components/ui';

type Place = {
  id: string;
  label: string;
  name: string;
  address: string;
  icon: string;
  notes: string;
  lat: number;
  lng: number;
  created_at: string;
};

const ICONS = [
  { key: 'home', icon: <Home size={16} /> },
  { key: 'campus', icon: <GraduationCap size={16} /> },
  { key: 'work', icon: <Briefcase size={16} /> },
  { key: 'food', icon: <Utensils size={16} /> },
  { key: 'gym', icon: <Dumbbell size={16} /> },
  { key: 'heart', icon: <Heart size={16} /> },
  { key: 'star', icon: <Star size={16} /> },
  { key: 'pin', icon: <MapPin size={16} /> },
];

function iconFor(key: string, size = 17) {
  const map: Record<string, JSX.Element> = {
    home: <Home size={size} />,
    campus: <GraduationCap size={size} />,
    work: <Briefcase size={size} />,
    food: <Utensils size={size} />,
    gym: <Dumbbell size={size} />,
    heart: <Heart size={size} />,
    star: <Star size={size} />,
    pin: <MapPin size={size} />,
  };
  return map[key] ?? <MapPin size={size} />;
}

const emptyForm = { label: '', name: '', address: '', icon: 'pin', notes: '', lat: 5.6037, lng: -0.187 };

export default function SavedPlaces() {
  const navigate = useNavigate();
  const toast = useToast();
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; place?: Place } | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Place | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [results, setResults] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const d = await api.get<{ places: Place[] }>('/places');
      setPlaces(d.places);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not load saved places');
      setPlaces([]);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!modal) return;
    const q = searchQ.trim();
    const t = setTimeout(() => {
      api
        .get<{ places: any[] }>(`/places/suggestions?q=${encodeURIComponent(q)}`)
        .then((d) => setResults(d.places))
        .catch(() => {});
    }, 160);
    return () => clearTimeout(t);
  }, [searchQ, modal]);

  const openCreate = () => {
    setForm(emptyForm);
    setSearchQ('');
    setFormError('');
    setModal({ mode: 'create' });
  };

  const openEdit = (p: Place) => {
    setForm({ label: p.label, name: p.name, address: p.address, icon: p.icon, notes: p.notes, lat: p.lat, lng: p.lng });
    setSearchQ('');
    setFormError('');
    setModal({ mode: 'edit', place: p });
  };

  const save = async () => {
    if (!form.label.trim() || !form.name.trim()) {
      setFormError('Give the place a short label and a name.');
      return;
    }
    setBusy(true);
    setFormError('');
    const isEdit = modal?.mode === 'edit' && modal.place;
    const optimistic: Place = {
      id: isEdit ? modal!.place!.id : `tmp_${Date.now()}`,
      ...form,
      created_at: isEdit ? modal!.place!.created_at : new Date().toISOString(),
    };
    const prev = places ?? [];
    setPlaces(isEdit ? prev.map((p) => (p.id === optimistic.id ? optimistic : p)) : [optimistic, ...prev]);
    try {
      if (isEdit) {
        const res = await api.patch<{ place: Place }>(`/places/${optimistic.id}`, form);
        setPlaces((cur) => (cur ?? []).map((p) => (p.id === res.place.id ? res.place : p)));
        toast.success('Saved place updated');
      } else {
        const res = await api.post<{ place: Place }>('/places', form);
        setPlaces((cur) => (cur ?? []).map((p) => (p.id === optimistic.id ? res.place : p)));
        toast.success('Place saved');
      }
      setModal(null);
    } catch (err) {
      setPlaces(prev);
      setFormError(err instanceof ApiError ? err.message : 'Could not save this place');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    const prev = places ?? [];
    setDeleteTarget(null);
    setBusy(true);
    setPlaces(prev.filter((p) => p.id !== target.id));
    try {
      await api.del(`/places/${target.id}`);
      toast.success('Place removed');
    } catch (err) {
      setPlaces(prev);
      toast.error(err instanceof ApiError ? err.message : 'Could not remove this place');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Saved places</h1>
          <p className="page-sub">One tap from booking — home, campus, work and that waakye spot.</p>
        </div>
        <Button onClick={openCreate} icon={<Plus size={16} />}>
          Add place
        </Button>
      </div>

      {places === null ? (
        <div className="grid three">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <Skeleton h={40} w={40} circle />
              <Skeleton h={16} w="60%" className="mt-3" />
              <Skeleton h={11} w="80%" className="mt-2" />
            </Card>
          ))}
        </div>
      ) : places.length === 0 ? (
        <Card>
          <EmptyState
            icon={<MapPin size={24} />}
            title="No saved places yet"
            description="Save your hostel, campus gate and favourite food spot. They'll show up as shortcuts when you book."
            action={
              <Button onClick={openCreate} icon={<Plus size={15} />}>
                Save your first place
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid three">
          {places.map((p) => (
            <Card key={p.id} hover className="col" style={{ gap: 12 }}>
              <div className="row-between">
                <span className="row-icon" style={{ background: 'var(--green-050)', color: 'var(--green-700)' }}>
                  {iconFor(p.icon)}
                </span>
                <div className="row gap-1">
                  <button className="icon-btn" style={{ width: 32, height: 32 }} onClick={() => openEdit(p)} aria-label={`Edit ${p.label}`}>
                    <Pencil size={14} />
                  </button>
                  <button className="icon-btn danger" style={{ width: 32, height: 32 }} onClick={() => setDeleteTarget(p)} aria-label={`Delete ${p.label}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div>
                <div className="row gap-2">
                  <span style={{ fontWeight: 800, fontSize: 15.5 }}>{p.label}</span>
                  <Badge tone="outline">{p.icon}</Badge>
                </div>
                <div className="small" style={{ fontWeight: 600, marginTop: 3 }}>
                  {p.name}
                </div>
                <div className="tiny muted">{p.address || 'Accra, Ghana'}</div>
              </div>
              {p.notes ? (
                <div className="tiny muted" style={{ borderLeft: '2px solid var(--line-2)', paddingLeft: 9 }}>
                  {p.notes}
                </div>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                block
                onClick={() => navigate('/app/ride', { state: { pickup: p } })}
                icon={<Navigation size={14} />}
              >
                Book from here
              </Button>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        title={modal?.mode === 'edit' ? 'Edit saved place' : 'Add a saved place'}
        sub="Search for a real place or type your own details."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={save} loading={busy}>
              {modal?.mode === 'edit' ? 'Save changes' : 'Save place'}
            </Button>
          </>
        }
      >
        <div className="col gap-4">
          <Field label="Find a place">
            <div className="input-wrap">
              <Search size={16} />
              <Input value={searchQ} onChange={(e) => setSearchQ(e.target.value)} placeholder="Balme Library, Accra Mall, Madina…" />
            </div>
          </Field>
          {searchQ ? (
            <div className="col" style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', marginTop: -8 }}>
              {results.slice(0, 4).map((r) => (
                <button
                  key={r.id}
                  className="suggest-item"
                  style={{ borderBottom: '1px solid var(--line-2)' }}
                  onClick={() => {
                    setForm((f) => ({
                      ...f,
                      name: r.name,
                      address: r.address,
                      lat: r.lat,
                      lng: r.lng,
                      label: f.label || r.area,
                    }));
                    setSearchQ('');
                  }}
                >
                  <span className="suggest-icon">
                    <MapPin size={14} />
                  </span>
                  <div className="col grow" style={{ minWidth: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 13.5 }}>{r.name}</span>
                    <span className="tiny muted truncate">{r.address}</span>
                  </div>
                </button>
              ))}
              {results.length === 0 ? <div className="small muted" style={{ padding: 12 }}>No matches — fill in the address yourself below.</div> : null}
            </div>
          ) : null}

          <div className="grid two" style={{ gap: 12 }}>
            <Field label="Label" hint="Shown as a shortcut">
              <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Home" maxLength={60} />
            </Field>
            <Field label="Icon">
              <div className="chips">
                {ICONS.map((i) => (
                  <button
                    key={i.key}
                    className="icon-btn"
                    style={{
                      width: 34,
                      height: 34,
                      borderColor: form.icon === i.key ? 'var(--green)' : undefined,
                      color: form.icon === i.key ? 'var(--green-700)' : undefined,
                      background: form.icon === i.key ? 'var(--green-050)' : undefined,
                    }}
                    onClick={() => setForm({ ...form, icon: i.key })}
                    aria-label={i.key}
                    aria-pressed={form.icon === i.key}
                    type="button"
                  >
                    {i.icon}
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <Field label="Place name">
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Hostel 4, East Legon" />
          </Field>
          <Field label="Address">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="American House, East Legon" />
          </Field>
          <Field label="Driver notes (optional)">
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Call when you reach the gate" maxLength={300} style={{ minHeight: 70 }} />
          </Field>
          {formError ? <div className="notice red">{formError}</div> : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        loading={busy}
        danger
        title={`Remove ${deleteTarget?.label ?? 'this place'}?`}
        confirmLabel="Remove place"
        body="You can always add it again later. Past rides are not affected."
      />
    </div>
  );
}
