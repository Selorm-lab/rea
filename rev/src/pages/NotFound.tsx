import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { useAuth } from '../lib/auth';

export default function NotFound() {
  const { user } = useAuth();
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)', padding: 24 }}>
      <div className="col gap-4" style={{ alignItems: 'center', textAlign: 'center', maxWidth: 420 }}>
        <span className="empty-icon" style={{ width: 72, height: 72, borderRadius: 22 }}>
          <Compass size={30} />
        </span>
        <h1 style={{ fontSize: 30, letterSpacing: '-0.04em' }}>Off the route</h1>
        <p className="muted">That page does not exist. Your driver has been notified — actually, let's just get you back.</p>
        <div className="row gap-2">
          <Link to="/" className="btn ghost">
            <ArrowLeft size={15} /> Home
          </Link>
          <Link to={user ? '/app' : '/login'} className="btn">
            {user ? 'Open dashboard' : 'Sign in'}
          </Link>
        </div>
      </div>
    </div>
  );
}
