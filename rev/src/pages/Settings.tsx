import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Download,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Sparkles,
  User as UserIcon,
} from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { Avatar, Badge, Button, Card, CardHeader, ConfirmDialog, Field, Input, Select, Textarea, Toggle } from '../components/ui';
import { formatDate, formatGhs } from '../lib/format';
import { UNIVERSITIES } from '../lib/constants';

export default function Settings() {
  const { user, patchUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(() => ({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    university: user?.university ?? '',
    campus: user?.campus ?? '',
    bio: user?.bio ?? '',
  }));
  const [saving, setSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState('');
  const [logoutAll, setLogoutAll] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (!user) return null;

  const saveProfile = async () => {
    setSaving(true);
    setProfileError('');
    try {
      const res = await api.patch<{ user: any }>('/profile', form);
      patchUser(res.user);
      toast.success('Profile updated');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Could not save your profile';
      setProfileError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const toggleNotif = async (key: 'notif_email' | 'notif_push' | 'notif_deals', value: boolean) => {
    const prev = user[key];
    patchUser({ [key]: value ? 1 : 0 } as any);
    try {
      await api.patch('/profile', { [key]: value });
    } catch (err) {
      patchUser({ [key]: prev } as any);
      toast.error(err instanceof ApiError ? err.message : 'Could not update notification settings');
    }
  };

  const changePassword = async () => {
    if (pw.next.length < 6) {
      setPwError('New password must be at least 6 characters');
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwError('The new passwords do not match');
      return;
    }
    setPwBusy(true);
    setPwError('');
    try {
      await api.post('/auth/change-password', { current_password: pw.current, new_password: pw.next });
      setPw({ current: '', next: '', confirm: '' });
      toast.success('Password changed');
    } catch (err) {
      setPwError(err instanceof ApiError ? err.message : 'Could not change password');
    } finally {
      setPwBusy(false);
    }
  };

  const exportData = async () => {
    try {
      const data = await api.get<any>('/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rev-data-${user.name.toLowerCase().replace(/\s+/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Your Rev data has been downloaded');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not export your data');
    }
  };

  const signOutEverywhere = async () => {
    setSigningOut(true);
    try {
      await api.del('/auth/sessions');
      localStorage.removeItem('rev_token');
      toast.success('Signed out of all devices');
      navigate('/login');
      await logout();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not sign out');
      setSigningOut(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">Your profile, notifications, security and data.</p>
        </div>
        <Badge tone="green">
          <ShieldCheck size={12} /> Verified account
        </Badge>
      </div>

      <div className="split">
        <div className="col gap-4">
          <Card>
            <CardHeader title="Personal information" sub="This is what drivers and operators see." />
            <div className="grid two" style={{ gap: 14 }}>
              <Field label="Full name">
                <div className="input-wrap">
                  <UserIcon size={16} />
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
              </Field>
              <Field label="Email address">
                <div className="input-wrap">
                  <Mail size={16} />
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </div>
              </Field>
              <Field label="Phone number">
                <div className="input-wrap">
                  <Phone size={16} />
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+233 …" />
                </div>
              </Field>
              <Field label="Campus">
                <div className="input-wrap">
                  <MapPin size={16} />
                  <Input value={form.campus} onChange={(e) => setForm({ ...form, campus: e.target.value })} placeholder="Legon" />
                </div>
              </Field>
            </div>
            <div className="mt-3">
              <Field label="University">
                <Select value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })}>
                  <option value="">Not affiliated</option>
                  {[...new Set([form.university, ...UNIVERSITIES])].filter(Boolean).map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="mt-3">
              <Field label="About you" hint="Optional — shown to drivers on your trip.">
                <Textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} maxLength={300} style={{ minHeight: 74 }} placeholder="Level 300, Political Science." />
              </Field>
            </div>
            {profileError ? <div className="notice red mt-3">{profileError}</div> : null}
            <div className="row gap-2 mt-4">
              <Button onClick={saveProfile} loading={saving} icon={<Save size={15} />}>
                Save changes
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  setForm({
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    university: user.university,
                    campus: user.campus,
                    bio: user.bio,
                  })
                }
              >
                Reset
              </Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="Notifications" sub="Choose how Rev keeps you posted." />
            {[
              { key: 'notif_email' as const, title: 'Email updates', desc: 'Receipts, booking references and trip reminders.', icon: <Mail size={16} /> },
              { key: 'notif_push' as const, title: 'Push notifications', desc: 'Driver arrival, departure changes and refunds.', icon: <Bell size={16} /> },
              { key: 'notif_deals' as const, title: 'Student deals', desc: 'Fare drops on your routes and weekend offers.', icon: <Sparkles size={16} /> },
            ].map((n, i) => (
              <div
                key={n.key}
                className="row-between gap-3"
                style={{ padding: '13px 0', borderBottom: i < 2 ? '1px solid var(--line-2)' : 0 }}
              >
                <div className="row gap-3">
                  <span className="row-icon" style={{ width: 36, height: 36 }}>
                    {n.icon}
                  </span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{n.title}</div>
                    <div className="tiny muted">{n.desc}</div>
                  </div>
                </div>
                <Toggle checked={Boolean(user[n.key])} onChange={(v) => toggleNotif(n.key, v)} label={n.title} />
              </div>
            ))}
          </Card>

          <Card>
            <CardHeader title="Security" sub="Keep your account and wallet safe." />
            <div className="grid two" style={{ gap: 12 }}>
              <Field label="Current password">
                <Input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} placeholder="••••••••" autoComplete="current-password" />
              </Field>
              <Field label="New password">
                <Input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} placeholder="At least 6 characters" autoComplete="new-password" />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Confirm new password">
                <Input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} placeholder="Repeat new password" autoComplete="new-password" />
              </Field>
            </div>
            {pwError ? <div className="notice red mt-3">{pwError}</div> : null}
            <div className="row gap-2 mt-4 wrap">
              <Button variant="ghost" onClick={changePassword} loading={pwBusy} icon={<KeyRound size={15} />}>
                Update password
              </Button>
              <Button variant="ghost" onClick={() => setLogoutAll(true)} icon={<LogOut size={15} />}>
                Sign out everywhere
              </Button>
            </div>
          </Card>
        </div>

        <div className="col gap-4">
          <Card>
            <div className="col gap-3" style={{ alignItems: 'center', textAlign: 'center' }}>
              <Avatar name={user.name} color={user.avatar_color} size={72} />
              <div>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{user.name}</div>
                <div className="small muted">{user.email}</div>
              </div>
              <div className="row gap-2 wrap" style={{ justifyContent: 'center' }}>
                <Badge tone="green">{user.role === 'driver' ? 'Driver' : user.role === 'operator' ? 'Operator' : 'Rider'}</Badge>
                {user.university ? <Badge tone="outline">{user.university}</Badge> : null}
              </div>
              <hr className="divider" style={{ width: '100%' }} />
              <div className="row-between" style={{ width: '100%' }}>
                <span className="small muted">Wallet balance</span>
                <span style={{ fontWeight: 800 }}>{formatGhs(user.wallet_cents)}</span>
              </div>
              <div className="row-between" style={{ width: '100%' }}>
                <span className="small muted">Rider rating</span>
                <span style={{ fontWeight: 800 }}>{user.rating.toFixed(1)} ★</span>
              </div>
              <div className="row-between" style={{ width: '100%' }}>
                <span className="small muted">Member since</span>
                <span style={{ fontWeight: 700 }}>{formatDate(user.created_at, { month: 'long', year: 'numeric' })}</span>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Your data" sub="You own it. Take a copy any time." />
            <p className="small muted">
              Download everything Rev stores about you — profile, saved places, rides, intercity bookings and wallet
              transactions — as a JSON file.
            </p>
            <Button variant="ghost" className="mt-3" block onClick={exportData} icon={<Download size={15} />}>
              Export my data
            </Button>
          </Card>

          <Card>
            <CardHeader title="Support" />
            <div className="col gap-3">
              <div className="row gap-3">
                <span className="row-icon" style={{ width: 34, height: 34 }}>
                  <Phone size={15} />
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>24/7 rider support</div>
                  <div className="tiny muted">Call +233 30 000 0000 or chat from a live trip.</div>
                </div>
              </div>
              <div className="row gap-3">
                <span className="row-icon" style={{ width: 34, height: 34 }}>
                  <ShieldCheck size={15} />
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>Safety toolkit</div>
                  <div className="tiny muted">Trusted contacts, trip sharing and emergency assistance.</div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={logoutAll}
        onClose={() => setLogoutAll(false)}
        onConfirm={signOutEverywhere}
        loading={signingOut}
        danger
        title="Sign out of all devices?"
        confirmLabel="Sign out everywhere"
        body="Every active session, including this one, will end and you'll need to sign in again."
      />
    </div>
  );
}
