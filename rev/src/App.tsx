import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect, type ReactNode } from 'react';
import { useAuth } from './lib/auth';
import { AppShell } from './components/AppShell';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import BookRide from './pages/BookRide';
import RideHistory from './pages/RideHistory';
import Intercity from './pages/Intercity';
import TripDetail from './pages/TripDetail';
import Bookings from './pages/Bookings';
import SavedPlaces from './pages/SavedPlaces';
import WalletPage from './pages/Wallet';
import Vehicles from './pages/Vehicles';
import Operator from './pages/Operator';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';
import { Spinner } from './components/ui';

function BootScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--bg)' }}>
      <div className="col gap-3" style={{ alignItems: 'center' }}>
        <span className="brand-mark" style={{ width: 48, height: 48, fontSize: 24, borderRadius: 14 }}>
          R
        </span>
        <Spinner label="Starting Rev…" />
      </div>
    </div>
  );
}

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <BootScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <BootScreen />;
  if (user) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from.startsWith('/app') ? from : '/app'} replace />;
  }
  return <>{children}</>;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route
          path="/login"
          element={
            <GuestOnly>
              <Login />
            </GuestOnly>
          }
        />
        <Route
          path="/signup"
          element={
            <GuestOnly>
              <Signup />
            </GuestOnly>
          }
        />
        <Route
          path="/app"
          element={
            <Protected>
              <AppShell />
            </Protected>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="ride" element={<BookRide />} />
          <Route path="rides" element={<RideHistory />} />
          <Route path="intercity" element={<Intercity />} />
          <Route path="intercity/:tripId" element={<TripDetail />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="places" element={<SavedPlaces />} />
          <Route path="wallet" element={<WalletPage />} />
          <Route path="vehicles" element={<Vehicles />} />
          <Route path="operator" element={<Operator />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
