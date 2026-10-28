import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Bus,
  Car,
  CreditCard,
  Gauge,
  History,
  LayoutGrid,
  LogOut,
  MapPin,
  Menu,
  Navigation,
  Plus,
  Search,
  Settings as SettingsIcon,
  Ticket,
  Wallet,
  X,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useToast } from '../lib/toast';
import { api } from '../lib/api';
import { Avatar } from './ui';
import { formatGhs } from '../lib/format';

type NavEntry = { to: string; label: string; icon: ReactNode; badge?: number };

export function AppShell() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [upcoming, setUpcoming] = useState(0);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let alive = true;
    api
      .get<{ bookings: any[] }>('/intercity/bookings')
      .then((d) => {
        if (!alive) return;
        setUpcoming(d.bookings.filter((b) => b.status === 'confirmed' && new Date(b.depart_at) > new Date()).length);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [location.pathname]);

  if (!user) return null;

  const primary: NavEntry[] = [
    { to: '/app', label: 'Dashboard', icon: <LayoutGrid size={18} /> },
    { to: '/app/ride', label: 'Book a ride', icon: <Navigation size={18} /> },
    { to: '/app/rides', label: 'Ride history', icon: <History size={18} /> },
  ];
  const travel: NavEntry[] = [
    { to: '/app/intercity', label: 'Intercity', icon: <Bus size={18} /> },
    { to: '/app/bookings', label: 'My bookings', icon: <Ticket size={18} />, badge: upcoming },
    { to: '/app/places', label: 'Saved places', icon: <MapPin size={18} /> },
  ];
  const account: NavEntry[] = [
    { to: '/app/wallet', label: 'Wallet', icon: <Wallet size={18} /> },
    { to: '/app/vehicles', label: 'Vehicles', icon: <Car size={18} /> },
    { to: '/app/operator', label: 'Operator console', icon: <Gauge size={18} /> },
    { to: '/app/settings', label: 'Settings', icon: <SettingsIcon size={18} /> },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navGroup = (label: string, items: NavEntry[]) => (
    <>
      <div className="nav-label">{label}</div>
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.to === '/app'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          {item.icon}
          <span>{item.label}</span>
          {item.badge ? <span className="nav-badge">{item.badge}</span> : null}
        </NavLink>
      ))}
    </>
  );

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`} id="rev-sidebar">
        <div className="row-between" style={{ padding: '2px 4px 0' }}>
          <NavLink to="/app" className="brand" style={{ padding: '4px 6px 16px' }}>
            <span className="brand-mark">R</span>
            <span className="col">
              <span className="brand-name">Rev</span>
              <span style={{ fontSize: 10.5, color: '#7d9588', fontWeight: 700, letterSpacing: '0.1em', marginTop: -2 }}>RIDE LOCAL · GO FAR</span>
            </span>
          </NavLink>
          <button className="icon-btn sidebar-close" style={{ background: 'transparent', border: 0, color: '#9fb5a8' }} onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav aria-label="Main">
          {navGroup('Ride', primary)}
          {navGroup('Travel', travel)}
          {navGroup('Account', account)}
        </nav>

        <div className="sidebar-foot">
          <div className="side-card">
            <div className="row gap-2" style={{ color: '#c7f464', fontSize: 11, fontWeight: 800, letterSpacing: '0.1em' }}>
              <CreditCard size={13} /> REV WALLET
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginTop: 6, letterSpacing: '-0.03em' }}>
              {formatGhs(user.wallet_cents)}
            </div>
            <button className="btn lime sm block mt-2" onClick={() => navigate('/app/wallet')}>
              <Plus size={14} /> Top up
            </button>
          </div>

          <div className="row-between" style={{ marginTop: 10, padding: '4px 6px' }}>
            <NavLink to="/app/settings" className="user-pill grow">
              <Avatar name={user.name} color={user.avatar_color} size={34} />
              <div className="col" style={{ minWidth: 0 }}>
                <span className="truncate" style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                  {user.name}
                </span>
                <span className="truncate" style={{ fontSize: 11, color: '#7d9588' }}>
                  {user.university || (user.role === 'operator' ? 'Rev Intercity ops' : 'Rev member')}
                </span>
              </div>
            </NavLink>
            <button className="icon-btn" style={{ background: '#101f18', borderColor: '#21382c', color: '#9fb5a8', width: 34, height: 34 }} onClick={handleLogout} aria-label="Sign out" title="Sign out">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {open ? <div style={{ position: 'fixed', inset: 0, zIndex: 110 }} onClick={() => setOpen(false)} aria-hidden="true" /> : null}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-toggle" onClick={() => setOpen(true)} aria-label="Open menu" aria-controls="rev-sidebar" aria-expanded={open}>
            <Menu size={19} />
          </button>

          <button
            className="search-field grow"
            style={{ maxWidth: 340, textAlign: 'left', cursor: 'pointer' }}
            onClick={() => navigate('/app/ride')}
            aria-label="Book a ride"
          >
            <Search size={16} />
            <span style={{ color: 'var(--muted-2)', fontSize: 14 }}>Where to today?</span>
            <span className="badge outline mono" style={{ marginLeft: 'auto', fontSize: 10.5 }}>
              ⏎
            </span>
          </button>

          <div className="grow" />

          <div className="row gap-2">
            <button className="icon-btn" onClick={() => toast.info('You are all caught up — 3 reminders and no new alerts.')} aria-label="Notifications" title="Notifications" style={{ position: 'relative' }}>
              <Bell size={17} />
              <span style={{ position: 'absolute', top: 7, right: 8, width: 7, height: 7, borderRadius: 99, background: 'var(--green)', boxShadow: '0 0 0 2px #fff' }} />
            </button>
            <button className="row gap-2" onClick={() => navigate('/app/wallet')} style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--text)', padding: '4px 6px', borderRadius: 10 }} aria-label="Wallet balance">
              <span className="badge green" style={{ height: 32, gap: 7 }}>
                <Wallet size={13} /> {formatGhs(user.wallet_cents)}
              </span>
            </button>
            <button className="btn dark sm" onClick={() => navigate('/app/ride')}>
              <Navigation size={14} /> Book
            </button>
            <NavLink to="/app/settings" aria-label="Your profile">
              <Avatar name={user.name} color={user.avatar_color} size={36} />
            </NavLink>
          </div>
        </header>

        <main>
          <Outlet />
        </main>
      </div>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        <NavLink to="/app" end className={({ isActive }) => (isActive ? 'active' : '')}>
          <LayoutGrid size={19} />
          Home
        </NavLink>
        <NavLink to="/app/ride" className={({ isActive }) => (isActive ? 'active' : '')}>
          <Navigation size={19} />
          Ride
        </NavLink>
        <NavLink to="/app/intercity" className={({ isActive }) => (isActive ? 'active' : '')}>
          <Bus size={19} />
          Intercity
        </NavLink>
        <NavLink to="/app/bookings" className={({ isActive }) => (isActive ? 'active' : '')}>
          <Ticket size={19} />
          Trips
        </NavLink>
        <button onClick={() => setOpen(true)} aria-label="More options">
          <Menu size={19} />
          More
        </button>
      </nav>
    </div>
  );
}
