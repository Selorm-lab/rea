import { useId } from 'react';
import { cityPoint } from '../../shared/travel';

type Point = { lat: number; lng: number; name?: string };

const BOUNDS = { minLat: 5.46, maxLat: 5.76, minLng: -0.34, maxLng: -0.04 };

function project({ lat, lng }: { lat: number; lng: number }) {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * 100;
  const y = ((BOUNDS.maxLat - lat) / (BOUNDS.maxLat - BOUNDS.minLat)) * 100;
  return { x: Math.min(94, Math.max(6, x)), y: Math.min(92, Math.max(8, y)) };
}

/** Stylised Accra street map with an animated pickup → dropoff route. */
export function RouteMap({
  pickup,
  dropoff,
  height = 260,
  compact = false,
  progress = 0,
}: {
  pickup?: Point | null;
  dropoff?: Point | null;
  height?: number;
  compact?: boolean;
  progress?: number;
}) {
  const gid = useId().replace(/[:]/g, '');
  const p = pickup ? project(pickup) : null;
  const d = dropoff ? project(dropoff) : null;
  const mid = p && d ? { x: (p.x + d.x) / 2 + (d.y - p.y) * 0.14, y: (p.y + d.y) / 2 - (d.x - p.x) * 0.14 } : null;
  const path = p && d && mid ? `M ${p.x} ${p.y} Q ${mid.x} ${mid.y} ${d.x} ${d.y}` : null;

  return (
    <div className="map-wrap" style={{ height }} aria-label="Map preview of your route">
      <svg className="map-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" role="img">
        <defs>
          <linearGradient id={`land${gid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#eef3e8" />
            <stop offset="100%" stopColor="#e3ecdd" />
          </linearGradient>
          <pattern id={`blocks${gid}`} width="12" height="12" patternUnits="userSpaceOnUse">
            <rect width="12" height="12" fill="none" />
            <path d="M0 12H12M12 0V12" stroke="#dbe5d5" strokeWidth="0.25" />
          </pattern>
          <filter id={`shadow${gid}`} x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0.6" stdDeviation="0.8" floodColor="#0b2417" floodOpacity="0.25" />
          </filter>
        </defs>

        <rect width="100" height="100" fill={`url(#land${gid})`} />
        <rect width="100" height="100" fill={`url(#blocks${gid})`} opacity="0.75" />

        {/* green spaces */}
        <ellipse cx="26" cy="70" rx="18" ry="11" fill="#d7e6c9" opacity="0.85" />
        <ellipse cx="76" cy="25" rx="16" ry="9" fill="#d7e6c9" opacity="0.7" />
        <path d="M0 91 Q 30 84 58 92 T 100 90 L100 100 L0 100 Z" fill="#cfe3e8" opacity="0.9" />

        {/* arterial roads */}
        <g stroke="#f7faf5" strokeLinecap="round" fill="none">
          <path d="M-5 34 Q 30 40 55 30 T 105 26" strokeWidth="5" />
          <path d="M8 -5 Q 18 30 12 60 T 26 105" strokeWidth="4.4" />
          <path d="M-5 66 Q 34 62 62 70 T 105 62" strokeWidth="4.8" />
          <path d="M68 -5 Q 62 28 74 52 T 66 105" strokeWidth="4.2" />
          <path d="M-5 14 Q 40 20 70 12" strokeWidth="3" />
          <path d="M40 -5 Q 44 40 36 74 T 48 105" strokeWidth="2.6" />
        </g>
        <g stroke="#e6eede" strokeLinecap="round" fill="none" strokeDasharray="2 2.4">
          <path d="M-5 48 Q 30 52 56 46 T 105 44" strokeWidth="1.6" />
          <path d="M88 -5 Q 82 34 92 62 T 84 105" strokeWidth="1.6" />
        </g>
        {/* motorway */}
        <path d="M-5 78 Q 26 74 52 82 T 105 76" stroke="#f2e9cf" strokeWidth="3.4" fill="none" strokeLinecap="round" />

        {path ? (
          <>
            <path d={path} stroke="#0b2417" strokeOpacity="0.13" strokeWidth={compact ? 2.6 : 2.2} fill="none" strokeLinecap="round" transform="translate(0,0.5)" />
            <path d={path} stroke="#0fa968" strokeWidth={compact ? 1.9 : 1.5} fill="none" strokeLinecap="round" />
            <path d={path} stroke="#eafff3" strokeWidth={compact ? 0.7 : 0.55} fill="none" strokeLinecap="round" className="route-draw" opacity="0.85" />
          </>
        ) : null}

        {p ? (
          <g filter={`url(#shadow${gid})`}>
            <circle cx={p.x} cy={p.y} r={compact ? 3.4 : 2.8} fill="#0fa968" />
            <circle cx={p.x} cy={p.y} r={compact ? 1.5 : 1.2} fill="#fff" />
          </g>
        ) : null}
        {d ? (
          <g filter={`url(#shadow${gid})`}>
            <rect x={d.x - 2.1} y={d.y - 2.1} width="4.2" height="4.2" rx="1.1" fill="#08150f" />
            <rect x={d.x - 0.75} y={d.y - 0.75} width="1.5" height="1.5" rx="0.4" fill="#c7f464" />
          </g>
        ) : null}

        {/* moving car along the route */}
        {path && progress > 0 ? (
          <circle r={compact ? 2.2 : 1.8} fill="#08150f" stroke="#c7f464" strokeWidth="0.6">
            <animateMotion dur="6s" repeatCount="indefinite" path={path} keyPoints="0;1" keyTimes="0;1" calcMode="linear" />
          </circle>
        ) : null}
      </svg>

      {!compact && pickup?.name ? (
        <div className="map-badge">
          <span className="live-dot" />
          {pickup.name} → {dropoff?.name ?? 'Choose destination'}
        </div>
      ) : null}
      {!compact ? (
        <div className="map-legend">
          <span className="badge outline" style={{ background: '#ffffffe8' }}>
            Accra
          </span>
        </div>
      ) : null}
    </div>
  );
}

const GHANA_OUTLINE = `M 20 12 L 63 10 L 70 18 L 68 28 L 74 36 L 70 46 L 76 56 L 68 68 L 60 76 L 52 90 L 38 92 L 28 84 L 22 70 L 24 54 L 17 42 L 19 28 Z`;

/** Stylised national map used for intercity route previews. */
export function GhanaMap({ from, to, height = 220 }: { from?: string; to?: string; height?: number }) {
  const cities = [
    { name: 'Accra', lat: 5.6037, lng: -0.187 },
    { name: 'Kumasi', lat: 6.6885, lng: -1.6244 },
    { name: 'Cape Coast', lat: 5.1053, lng: -1.2466 },
    { name: 'Takoradi', lat: 4.9016, lng: -1.7831 },
    { name: 'Ho', lat: 6.6008, lng: 0.4713 },
    { name: 'Tamale', lat: 9.4008, lng: -0.8393 },
    { name: 'Bolgatanga', lat: 10.7856, lng: -0.8514 },
    { name: 'Wa', lat: 10.0601, lng: -2.5099 },
    { name: 'Sunyani', lat: 7.3399, lng: -2.3268 },
    { name: 'Koforidua', lat: 6.094, lng: -0.2591 },
  ];
  const fromCity = cities.find((c) => c.name === from);
  const toCity = cities.find((c) => c.name === to);
  const a = fromCity ? cityPoint(fromCity.lat, fromCity.lng) : null;
  const b = toCity ? cityPoint(toCity.lat, toCity.lng) : null;
  const mid = a && b ? { x: (a.x + b.x) / 2, y: Math.min(a.y, b.y) - 9 } : null;

  return (
    <div className="map-wrap" style={{ height, background: '#08150f' }}>
      <svg className="map-svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" role="img" aria-label={from && to ? `${from} to ${to} route map` : 'Ghana route map'}>
        <defs>
          <linearGradient id="landGh" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#17362a" />
            <stop offset="100%" stopColor="#0f281e" />
          </linearGradient>
          <pattern id="ghGrid" width="8" height="8" patternUnits="userSpaceOnUse">
            <path d="M8 0H0V8" fill="none" stroke="#1d4433" strokeWidth="0.2" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="#0a1913" />
        <rect width="100" height="100" fill="url(#ghGrid)" opacity="0.9" />
        <path d={GHANA_OUTLINE} fill="url(#landGh)" stroke="#2c5540" strokeWidth="0.6" />
        <g fill="#2c5540" opacity="0.55">
          <circle cx="40" cy="34" r="7" />
          <circle cx="52" cy="62" r="5" />
          <circle cx="30" cy="55" r="4" />
        </g>
        {cities.map((c) => {
          const p = cityPoint(c.lat, c.lng);
          const active = c.name === from || c.name === to;
          return (
            <g key={c.name}>
              <circle cx={p.x} cy={p.y} r={active ? 1.7 : 1} fill={active ? '#c7f464' : '#5d8171'} />
              {active ? (
                <text x={p.x + 2.6} y={p.y + 1} fontSize="2.6" fill="#e9f3ec" fontWeight="700" fontFamily="Plus Jakarta Sans, sans-serif">
                  {c.name}
                </text>
              ) : null}
            </g>
          );
        })}
        {a && b && mid ? (
          <>
            <path d={`M ${a.x} ${a.y} Q ${mid.x} ${mid.y} ${b.x} ${b.y}`} stroke="#0fa968" strokeOpacity="0.25" strokeWidth="1.6" fill="none" />
            <path d={`M ${a.x} ${a.y} Q ${mid.x} ${mid.y} ${b.x} ${b.y}`} stroke="#c7f464" strokeWidth="0.7" fill="none" strokeDasharray="2 2" className="route-draw" />
          </>
        ) : null}
      </svg>
      <div className="map-badge" style={{ background: 'rgba(10,25,19,0.85)', color: '#d8e7dd', border: '1px solid #27422f' }}>
        <span className="dot" style={{ background: '#c7f464' }} />
        {from && to ? `${from} → ${to}` : 'Ghana · 14 intercity routes'}
      </div>
    </div>
  );
}
