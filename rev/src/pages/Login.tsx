import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Lock, Mail, Sparkles } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Button, Field, Input } from '../components/ui';
import { ApiError } from '../lib/api';

export default function Login() {
  const { login, demoLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('ama@rev.app');
  const [password, setPassword] = useState('rev1234');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in. Try again.');
      setBusy(false);
    }
  };

  const demo = async () => {
    setError('');
    setDemoBusy(true);
    try {
      await demoLogin();
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open the demo account.');
      setDemoBusy(false);
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
            <Sparkles size={13} /> WELCOME BACK
          </span>
          <h2>Where are we going today?</h2>
          <p>Pick up where you left off — your campus rides, saved places and intercity tickets are all here.</p>
          <div className="auth-quote mt-4">
            "I book a RevGo from Volta Hall to Balme every morning and my Accra–Kumasi coach for the weekend in the same
            app. It just works."
            <div className="row gap-2 mt-2" style={{ color: '#7d9588', fontSize: 12.5 }}>
              <span className="avatar" style={{ width: 24, height: 24, background: '#0FA968', fontSize: 10 }}>
                AS
              </span>
              Ama S. · University of Ghana
            </div>
          </div>
        </div>
        <div className="row gap-4" style={{ color: '#7d9588', fontSize: 12.5, flexWrap: 'wrap' }}>
          <span>© {new Date().getFullYear()} Rev Mobility</span>
          <span>Accra · Kumasi · Tamale</span>
        </div>
      </aside>

      <div className="auth-form-wrap">
        <div className="auth-form">
          <Link to="/" className="row gap-2 small muted mb-3" style={{ fontWeight: 700 }}>
            <ArrowLeft size={15} /> Back to home
          </Link>
          <h1 style={{ fontSize: 30, letterSpacing: '-0.04em' }}>Sign in to Rev</h1>
          <p className="muted mt-2" style={{ fontSize: 14.5 }}>
            New here?{' '}
            <Link to="/signup" className="link">
              Create an account
            </Link>
          </p>

          <form onSubmit={submit} className="col gap-4 mt-4">
            <Field label="Email address" htmlFor="email">
              <div className="input-wrap">
                <Mail size={17} />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@ug.edu.gh"
                  required
                />
              </div>
            </Field>
            <Field label="Password" htmlFor="password">
              <div className="input-wrap">
                <Lock size={17} />
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            </Field>

            {error ? (
              <div className="notice red" role="alert">
                {error}
              </div>
            ) : null}

            <Button type="submit" size="lg" block loading={busy} icon={<ArrowRight size={17} />}>
              Sign in
            </Button>
          </form>

          <div className="demo-card">
            <div className="row-between gap-3">
              <div>
                <div style={{ fontWeight: 800, fontSize: 13.5 }}>Just exploring?</div>
                <div className="small muted">Open Ama's account with live demo data.</div>
              </div>
              <Button variant="dark" size="sm" onClick={demo} loading={demoBusy}>
                Try demo
              </Button>
            </div>
            <div className="tiny muted mt-2 mono">ama@rev.app · rev1234</div>
          </div>
        </div>
      </div>
    </div>
  );
}
