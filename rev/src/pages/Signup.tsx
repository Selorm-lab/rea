import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, GraduationCap, Lock, Mail, Phone, Sparkles, User } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Button, Field, Input, Select } from '../components/ui';
import { ApiError } from '../lib/api';

const UNIVERSITIES = [
  'University of Ghana',
  'KNUST',
  'University of Cape Coast',
  'UPSA',
  'GIMPA',
  'Central University',
  'UDS',
  'University of Education, Winneba',
  'Accra Technical University',
  'Other / not a student',
];

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', university: 'University of Ghana', campus: 'Legon', phone: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      await signup(form);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create your account. Try again.');
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <aside className="auth-aside">
        <Link to="/" className="row gap-3">
          <span className="brand-mark">R</span>
          <span className="brand-name">Rev</span>
        </Link>
        <div>
          <span className="hero-badge">
            <GraduationCap size={13} /> BUILT FOR STUDENTS
          </span>
          <h2>One account. Every ride home.</h2>
          <p>Join thousands of students moving between campus, hostels and the station. Your wallet is ready the moment you sign up.</p>
          <div className="col gap-3 mt-4">
            {['₵150 demo wallet credit to start', 'Fixed student fares on campus routes', 'Intercity bookings in the same app'].map((t) => (
              <div key={t} className="row gap-3" style={{ color: '#c3d5c8', fontSize: 14 }}>
                <span className="toast-icon" style={{ background: 'rgba(199,244,100,0.2)', color: '#c7f464' }}>
                  <Check size={12} strokeWidth={3} />
                </span>
                {t}
              </div>
            ))}
          </div>
        </div>
        <div style={{ color: '#7d9588', fontSize: 12.5 }}>© {new Date().getFullYear()} Rev Mobility · Accra, Ghana</div>
      </aside>

      <div className="auth-form-wrap">
        <div className="auth-form">
          <Link to="/" className="row gap-2 small muted mb-3" style={{ fontWeight: 700 }}>
            <ArrowLeft size={15} /> Back to home
          </Link>
          <h1 style={{ fontSize: 30, letterSpacing: '-0.04em' }}>Create your Rev account</h1>
          <p className="muted mt-2" style={{ fontSize: 14.5 }}>
            Already riding with us?{' '}
            <Link to="/login" className="link">
              Sign in
            </Link>
          </p>

          <form onSubmit={submit} className="col gap-4 mt-4">
            <Field label="Full name" htmlFor="name">
              <div className="input-wrap">
                <User size={17} />
                <Input id="name" value={form.name} onChange={set('name')} placeholder="Ama Serwaa" autoComplete="name" required />
              </div>
            </Field>
            <Field label="Email address" htmlFor="email" hint="Use your university email if you have one.">
              <div className="input-wrap">
                <Mail size={17} />
                <Input id="email" type="email" value={form.email} onChange={set('email')} placeholder="you@ug.edu.gh" autoComplete="email" required />
              </div>
            </Field>
            <div className="grid two" style={{ gap: 12 }}>
              <Field label="University" htmlFor="university">
                <Select id="university" value={form.university} onChange={set('university')}>
                  {UNIVERSITIES.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Campus" htmlFor="campus">
                <Input id="campus" value={form.campus} onChange={set('campus')} placeholder="Legon" />
              </Field>
            </div>
            <div className="grid two" style={{ gap: 12 }}>
              <Field label="Phone (optional)" htmlFor="phone">
                <div className="input-wrap">
                  <Phone size={17} />
                  <Input id="phone" value={form.phone} onChange={set('phone')} placeholder="+233 …" autoComplete="tel" />
                </div>
              </Field>
              <Field label="Password" htmlFor="password" hint="At least 6 characters.">
                <div className="input-wrap">
                  <Lock size={17} />
                  <Input id="password" type="password" value={form.password} onChange={set('password')} placeholder="••••••••" autoComplete="new-password" required />
                </div>
              </Field>
            </div>

            {error ? (
              <div className="notice red" role="alert">
                {error}
              </div>
            ) : null}

            <Button type="submit" size="lg" block loading={busy} icon={<ArrowRight size={17} />}>
              Create account
            </Button>
            <p className="hint center">
              By joining you agree to Rev's rider terms and privacy policy. <Sparkles size={11} style={{ verticalAlign: -1 }} />
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
