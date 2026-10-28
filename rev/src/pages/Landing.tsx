import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Bus,
  Clock,
  GraduationCap,
  MapPin,
  Navigation,
  ShieldCheck,
  Sparkles,
  Star,
  Ticket,
  Wallet,
  Wifi,
} from 'lucide-react';
import { RouteMap, GhanaMap } from '../components/MapView';
import { formatGhs } from '../lib/format';
import { ACCRA_PLACES } from '../../shared/travel';

const POPULAR = [
  { from: 'Accra', to: 'Kumasi', price: 12000, duration: '4h 15m', departures: 7 },
  { from: 'Accra', to: 'Cape Coast', price: 7000, duration: '2h 45m', departures: 5 },
  { from: 'Accra', to: 'Ho', price: 8000, duration: '3h 00m', departures: 4 },
  { from: 'Accra', to: 'Takoradi', price: 11000, duration: '4h 00m', departures: 4 },
  { from: 'Kumasi', to: 'Tamale', price: 15000, duration: '6h 30m', departures: 3 },
  { from: 'Accra', to: 'Tamale', price: 22000, duration: '10h 00m', departures: 2 },
];

export default function Landing() {
  return (
    <div className="landing">
      <nav className="landing-nav">
        <Link to="/" className="row gap-3">
          <span className="brand-mark">R</span>
          <span className="brand-name">Rev</span>
        </Link>
        <div className="landing-links">
          <a href="#ride">Campus rides</a>
          <a href="#intercity">Intercity</a>
          <a href="#how">How it works</a>
          <a href="#students">Students</a>
        </div>
        <div className="row gap-3">
          <Link to="/login" className="btn ghost sm" style={{ color: '#dbe9df', borderColor: '#2a4234', background: 'transparent' }}>
            Sign in
          </Link>
          <Link to="/signup" className="btn lime sm">
            Get Rev <ArrowRight size={14} />
          </Link>
        </div>
      </nav>

      <header className="hero">
        <div className="hero-copy">
          <div className="hero-badge">
            <b>NEW</b> Intercity coaches now in 14 corridors
          </div>
          <h1 className="balance">
            Campus rides.
            <br />
            <em>Country-wide</em> trips.
          </h1>
          <p className="lede">
            Rev gets students across campus in minutes and puts every Ghanaian city on one timetable. Book a bike, a
            comfortable car, or a coach seat — pay with MoMo, all in one app.
          </p>
          <div className="hero-actions">
            <Link to="/signup" className="btn lime lg">
              Start riding <ArrowRight size={17} />
            </Link>
            <Link to="/login" className="btn ghost lg" style={{ borderColor: '#2a4234', color: '#dbe9df', background: 'transparent' }}>
              Explore the demo
            </Link>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <b>GH₵8</b>
              <span>Average campus trip</span>
            </div>
            <div className="hero-stat">
              <b>2.4 min</b>
              <span>Median pickup time</span>
            </div>
            <div className="hero-stat">
              <b>14 cities</b>
              <span>On the Rev timetable</span>
            </div>
            <div className="hero-stat">
              <b>4.9★</b>
              <span>Driver rating, Legon</span>
            </div>
          </div>
        </div>

        <div className="phone-wrap">
          <div className="phone">
            <div className="phone-notch" />
            <div className="phone-screen">
              <div className="phone-top">
                <span>Rev · Legon</span>
                <span className="badge green" style={{ height: 21 }}>
                  <span className="live-dot" /> Live
                </span>
              </div>
              <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #d9e4d5' }}>
                <RouteMap pickup={ACCRA_PLACES[1]} dropoff={ACCRA_PLACES[0]} compact height={132} progress={1} />
              </div>
              <div className="col gap-2 mt-3">
                <div className="row-between">
                  <span className="tiny muted">RevGo · 4 min away</span>
                  <span style={{ fontWeight: 800 }}>{formatGhs(1400)}</span>
                </div>
                <div className="mini-ride-row">
                  <span className="avatar" style={{ width: 32, height: 32, background: '#0F766E', fontSize: 12 }}>
                    KB
                  </span>
                  <div className="col grow">
                    <span style={{ fontWeight: 700 }}>Kofi · Toyota Corolla</span>
                    <span className="tiny muted">GC 4821-24 · 4.9★</span>
                  </div>
                  <span className="badge green" style={{ height: 22 }}>
                    2 min
                  </span>
                </div>
                <div className="mini-ride-row">
                  <Bus size={16} color="#0b8b55" />
                  <div className="col grow">
                    <span style={{ fontWeight: 700 }}>Accra → Kumasi</span>
                    <span className="tiny muted">Tomorrow · 07:00 · Vibe Express</span>
                  </div>
                  <span style={{ fontWeight: 800, fontSize: 13 }}>GH₵120</span>
                </div>
                <button className="btn lime block sm" style={{ marginTop: 4 }}>
                  Confirm RevGo
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="section" id="ride">
        <div className="section-head">
          <div className="hero-badge" style={{ marginBottom: 14 }}>
            <Sparkles size={13} /> ONE APP, TWO WAYS TO MOVE
          </div>
          <h2>Short hops on campus. Long hauls across Ghana.</h2>
          <p>Most apps stop at the city limits. Rev was built for the student who has an 8am lecture in Legon and a bus home to Tamale on Friday.</p>
        </div>
        <div className="grid three">
          <div className="feature-card">
            <div className="feature-icon">
              <Navigation size={21} />
            </div>
            <h3>Campus & city rides</h3>
            <p>Bikes, RevGo, Comfort and XL. Fares are locked before you tap, so a traffic jam on the Spintex road never changes the price.</p>
            <div className="row gap-2 mt-3 wrap">
              <span className="badge outline" style={{ color: '#9db3a6', borderColor: '#2a4234' }}>
                <Clock size={11} /> 2.4 min avg pickup
              </span>
              <span className="badge outline" style={{ color: '#9db3a6', borderColor: '#2a4234' }}>
                <ShieldCheck size={11} /> Verified drivers
              </span>
            </div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <Bus size={21} />
            </div>
            <h3>Intercity, booked like a flight</h3>
            <p>Compare operators on price, departure time and amenities, pick your exact seat, and board with a QR-ready reference.</p>
            <div className="row gap-2 mt-3 wrap">
              <span className="badge outline" style={{ color: '#9db3a6', borderColor: '#2a4234' }}>
                <Ticket size={11} /> Seat selection
              </span>
              <span className="badge outline" style={{ color: '#9db3a6', borderColor: '#2a4234' }}>
                <Wifi size={11} /> Wi-Fi & A/C filters
              </span>
            </div>
          </div>
          <div className="feature-card">
            <div className="feature-icon">
              <GraduationCap size={21} />
            </div>
            <h3>Built around student money</h3>
            <p>Wi-Fi you can actually use, fares split into a wallet you top up with MoMo, and refunds that land the moment you cancel.</p>
            <div className="row gap-2 mt-3 wrap">
              <span className="badge outline" style={{ color: '#9db3a6', borderColor: '#2a4234' }}>
                <Wallet size={11} /> MoMo wallet
              </span>
              <span className="badge outline" style={{ color: '#9db3a6', borderColor: '#2a4234' }}>
                <BadgeCheck size={11} /> Instant refunds
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="intercity" style={{ paddingTop: 10 }}>
        <div className="split" style={{ alignItems: 'stretch' }}>
          <div>
            <div className="section-head" style={{ marginBottom: 20 }}>
              <h2>Tonight's departure board</h2>
              <p>Live timetable across our busiest corridors. Prices update with demand — never with the queue at the station.</p>
            </div>
            <div className="route-board">
              {POPULAR.map((r) => (
                <div className="route-board-row" key={`${r.from}-${r.to}`}>
                  <div className="row gap-3">
                    <span className="row gap-2" style={{ color: '#c7f464' }}>
                      <MapPin size={14} />
                    </span>
                    <div>
                      <div style={{ fontWeight: 700, color: '#fff' }}>
                        {r.from} <span style={{ color: '#5d8171' }}>→</span> {r.to}
                      </div>
                      <div style={{ fontSize: 11.5, color: '#7d9588' }}>
                        {r.duration} · {r.departures} daily departures
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: '#fff' }}>{formatGhs(r.price)}</div>
                    <div style={{ fontSize: 11, color: '#7d9588' }}>from</div>
                  </div>
                  <Link to="/login" className="btn ghost sm" style={{ borderColor: '#2a4234', color: '#c7f464', background: 'transparent' }}>
                    Book
                  </Link>
                </div>
              ))}
            </div>
          </div>
          <div className="col gap-4">
            <GhanaMap from="Accra" to="Tamale" height={250} />
            <div className="feature-card" style={{ padding: 20 }}>
              <div className="row gap-3">
                <div className="feature-icon" style={{ margin: 0, width: 38, height: 38 }}>
                  <Ticket size={18} />
                </div>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700 }}>Reserve up to 6 seats</div>
                  <div style={{ color: '#9db3a6', fontSize: 13 }}>Buy for your hallmates, pay once, split later.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="how">
        <div className="section-head">
          <h2>Three taps from here to there</h2>
          <p>No haggling with a trotro mate. No queue at the station.</p>
        </div>
        <div className="grid three">
          {[
            { n: '01', t: 'Set your route', d: 'Drop a pin, pick a saved place or choose your campus gate. Rev prices every tier instantly.' },
            { n: '02', t: 'Pick your ride', d: 'Compare fare, ETA and comfort. Schedule it for later or grab a coach seat for the weekend.' },
            { n: '03', t: 'Pay and go', d: 'Wallet, MoMo or card. Your driver and reference are confirmed before you move.' },
          ].map((s) => (
            <div key={s.n} className="feature-card">
              <div className="mono" style={{ color: '#c7f464', fontSize: 13, marginBottom: 10 }}>
                {s.n}
              </div>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="students" style={{ paddingTop: 0 }}>
        <div className="grid two" style={{ alignItems: 'center', gap: 40 }}>
          <div>
            <div className="hero-badge">
              <GraduationCap size={13} /> STUDENT PASS
            </div>
            <h2 style={{ fontSize: 'clamp(26px, 3.4vw, 38px)', color: '#fff', letterSpacing: '-0.035em', marginTop: 14 }}>
              Lectures don't wait. Neither should you.
            </h2>
            <p style={{ color: '#9db3a6', marginTop: 14, fontSize: 15.5, lineHeight: 1.65, maxWidth: 480 }}>
              Verify your student email and unlock fixed campus fares, 10% off intercity trips and a shared wallet for
              group travel. Rev is the ride your hallmates already use.
            </p>
            <div className="col gap-3 mt-4">
              {[
                'Locked ₵6 fares between halls and lecture theatres',
                'Skip the queue: priority matching at library close',
                'Split intercity bookings with up to 5 friends',
              ].map((t) => (
                <div key={t} className="row gap-3" style={{ color: '#c3d5c8', fontSize: 14 }}>
                  <BadgeCheck size={17} color="#c7f464" />
                  {t}
                </div>
              ))}
            </div>
          </div>
          <div className="feature-card" style={{ padding: 26 }}>
            <div className="row-between mb-3">
              <div className="row gap-3">
                <span className="avatar" style={{ background: '#0FA968', width: 44, height: 44 }}>
                  AS
                </span>
                <div>
                  <div style={{ color: '#fff', fontWeight: 700 }}>Ama Serwaa</div>
                  <div style={{ color: '#7d9588', fontSize: 12.5 }}>University of Ghana · Level 300</div>
                </div>
              </div>
              <span className="badge" style={{ background: 'rgba(199,244,100,0.15)', color: '#c7f464' }}>
                Verified student
              </span>
            </div>
            <div style={{ background: '#0a1913', border: '1px solid #1d3227', borderRadius: 14, padding: 16 }}>
              <div className="tiny" style={{ color: '#7d9588', letterSpacing: '0.1em' }}>
                THIS MONTH
              </div>
              <div className="row-between mt-2">
                <div>
                  <div style={{ color: '#fff', fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>12 rides</div>
                  <div style={{ color: '#7d9588', fontSize: 12 }}>81 km · 9.5 kg CO₂ saved</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#c7f464', fontWeight: 800, fontSize: 18 }}>GH₵85.20</div>
                  <div style={{ color: '#7d9588', fontSize: 12 }}>spent in October</div>
                </div>
              </div>
            </div>
            <div className="row gap-2 mt-3" style={{ color: '#9db3a6', fontSize: 12.5 }}>
              <Star size={13} color="#c7f464" fill="#c7f464" /> 4.9 rider rating · member since 2024
            </div>
          </div>
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <h2>Your ride is already on the way.</h2>
          <p>Free to join. Your first campus trip is on us with the demo wallet.</p>
        </div>
        <div className="row gap-3 wrap">
          <Link to="/signup" className="btn dark lg">
            Create account <ArrowRight size={17} />
          </Link>
          <Link to="/login" className="btn lg" style={{ background: '#08150f', color: '#fff' }}>
            Sign in
          </Link>
        </div>
      </section>

      <footer className="landing-foot">
        <div className="row gap-3">
          <span className="brand-mark" style={{ width: 28, height: 28, fontSize: 16, borderRadius: 8 }}>
            R
          </span>
          <span>© {new Date().getFullYear()} Rev Mobility · Accra, Ghana</span>
        </div>
        <div className="row gap-5 wrap">
          <span>Campus rides</span>
          <span>Intercity</span>
          <span>Safety</span>
          <span>Support</span>
        </div>
      </footer>
    </div>
  );
}
