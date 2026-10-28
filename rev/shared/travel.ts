/* Shared travel domain: places, cities, fare engine. Used by both server and web. */

export type Place = {
  id: string;
  name: string;
  area: string;
  address: string;
  lat: number;
  lng: number;
  kind: 'campus' | 'transport' | 'mall' | 'food' | 'residence' | 'landmark';
};

export const ACCRA_PLACES: Place[] = [
  { id: 'balme', name: 'Balme Library', area: 'University of Ghana', address: 'Legon Campus, Accra', lat: 5.6508, lng: -0.187, kind: 'campus' },
  { id: 'legon-main', name: 'UG Main Gate', area: 'Legon', address: 'University of Ghana, Accra', lat: 5.6501, lng: -0.1929, kind: 'campus' },
  { id: 'upsa', name: 'UPSA Campus', area: 'Madina', address: 'UPSA, Accra', lat: 5.6415, lng: -0.1755, kind: 'campus' },
  { id: 'gimpa', name: 'GIMPA', area: 'Achimota', address: 'GIMPA, Accra', lat: 5.6296, lng: -0.2107, kind: 'campus' },
  { id: 'east-legon', name: 'East Legon Shell', area: 'East Legon', address: 'Boundary Road, East Legon', lat: 5.6355, lng: -0.1569, kind: 'landmark' },
  { id: 'accra-mall', name: 'Accra Mall', area: 'Tetteh Quarshie', address: 'Spintex Road, Accra', lat: 5.6228, lng: -0.1738, kind: 'mall' },
  { id: 'osu', name: 'Osu Oxford Street', area: 'Osu', address: 'Oxford Street, Osu', lat: 5.5571, lng: -0.1789, kind: 'landmark' },
  { id: 'labadi', name: 'Labadi Beach', area: 'La', address: 'Labadi Beach Road, Accra', lat: 5.5618, lng: -0.1529, kind: 'landmark' },
  { id: 'circle', name: 'Kwame Nkrumah Circle', area: 'Circle', address: 'Nkrumah Circle, Accra', lat: 5.5708, lng: -0.2071, kind: 'transport' },
  { id: 'madina-market', name: 'Madina Market', area: 'Madina', address: 'Madina, Accra', lat: 5.6838, lng: -0.1662, kind: 'landmark' },
  { id: 'adenta', name: 'Adenta Housing Down', area: 'Adenta', address: 'Adenta, Accra', lat: 5.7042, lng: -0.1578, kind: 'residence' },
  { id: 'tema-station', name: 'Tema Station', area: 'Accra Central', address: 'Tema Station, Accra', lat: 5.5446, lng: -0.2103, kind: 'transport' },
  { id: 'airport-city', name: 'Airport City Mall', area: 'Airport City', address: 'Airport City, Accra', lat: 5.6041, lng: -0.1733, kind: 'mall' },
  { id: 'spintex', name: 'Spintex Junction', area: 'Spintex', address: 'Spintex Road, Accra', lat: 5.626, lng: -0.1104, kind: 'landmark' },
  { id: 'achimota', name: 'Achimota Mall', area: 'Achimota', address: 'Achimota, Accra', lat: 5.6189, lng: -0.2258, kind: 'mall' },
  { id: 'dansoman', name: 'Dansoman Last Stop', area: 'Dansoman', address: 'Dansoman, Accra', lat: 5.5452, lng: -0.2452, kind: 'residence' },
  { id: 'wuse', name: 'Auntie Muni Waakye', area: 'Madina', address: 'Madina Zongo Junction', lat: 5.6801, lng: -0.1634, kind: 'food' },
  { id: 'east-legon-hostel', name: 'Hostel 4, East Legon', area: 'East Legon', address: 'American House, East Legon', lat: 5.6379, lng: -0.1521, kind: 'residence' },
  { id: 'airport', name: 'Kotoka International Airport', area: 'Airport', address: 'KIA, Accra', lat: 5.6052, lng: -0.1668, kind: 'transport' },
];

export type City = {
  name: string;
  lat: number;
  lng: number;
  region: string;
};

export const CITIES: City[] = [
  { name: 'Accra', lat: 5.6037, lng: -0.187, region: 'Greater Accra' },
  { name: 'Kumasi', lat: 6.6885, lng: -1.6244, region: 'Ashanti' },
  { name: 'Cape Coast', lat: 5.1053, lng: -1.2466, region: 'Central' },
  { name: 'Takoradi', lat: 4.9016, lng: -1.7831, region: 'Western' },
  { name: 'Ho', lat: 6.6008, lng: 0.4713, region: 'Volta' },
  { name: 'Tamale', lat: 9.4008, lng: -0.8393, region: 'Northern' },
  { name: 'Bolgatanga', lat: 10.7856, lng: -0.8514, region: 'Upper East' },
  { name: 'Wa', lat: 10.0601, lng: -2.5099, region: 'Upper West' },
  { name: 'Sunyani', lat: 7.3399, lng: -2.3268, region: 'Bono' },
  { name: 'Koforidua', lat: 6.094, lng: -0.2591, region: 'Eastern' },
  { name: 'Aflao', lat: 6.1167, lng: 1.1833, region: 'Volta' },
  { name: 'Hohoe', lat: 7.1519, lng: 0.4729, region: 'Volta' },
  { name: 'Techiman', lat: 7.5833, lng: -1.9333, region: 'Bono East' },
  { name: 'Lomé', lat: 6.1319, lng: 1.2228, region: 'Togo' },
];

export function cityByName(name: string) {
  return CITIES.find((c) => c.name.toLowerCase() === name.toLowerCase());
}

/** Great-circle distance in km, rounded to 0.1 */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 10) / 10;
}

export type TierId = 'bike' | 'go' | 'comfort' | 'xl';

export type Tier = {
  id: TierId;
  name: string;
  blurb: string;
  seats: number;
  etaMin: number;
  baseCents: number;
  perKmCents: number;
  minCents: number;
  perMinCents: number;
  emoji: string;
};

export const TIERS: Tier[] = [
  {
    id: 'bike',
    name: 'Rev Bike',
    blurb: 'Beats traffic, cheapest',
    seats: 1,
    etaMin: 3,
    baseCents: 350,
    perKmCents: 230,
    perMinCents: 30,
    minCents: 550,
    emoji: '🛵',
  },
  {
    id: 'go',
    name: 'RevGo',
    blurb: 'Everyday campus rides',
    seats: 4,
    etaMin: 4,
    baseCents: 600,
    perKmCents: 390,
    perMinCents: 45,
    minCents: 900,
    emoji: '🚗',
  },
  {
    id: 'comfort',
    name: 'Rev Comfort',
    blurb: 'Newer cars, extra legroom',
    seats: 4,
    etaMin: 6,
    baseCents: 900,
    perKmCents: 520,
    perMinCents: 60,
    minCents: 1400,
    emoji: '✨',
  },
  {
    id: 'xl',
    name: 'Rev XL',
    blurb: 'Six seats, group trips',
    seats: 6,
    etaMin: 8,
    baseCents: 1400,
    perKmCents: 660,
    perMinCents: 75,
    minCents: 2000,
    emoji: '🚙',
  },
];

export function tierById(id: string): Tier {
  return TIERS.find((t) => t.id === id) ?? TIERS[1];
}

export type Estimate = {
  tier: TierId;
  distanceKm: number;
  durationMin: number;
  fareCents: number;
  surge: number;
  etaPickupMin: number;
  currency: string;
};

/** Deterministic fare estimate from coordinates. */
export function estimateRide(
  pickup: { lat: number; lng: number },
  dropoff: { lat: number; lng: number },
  tierId: TierId | string,
  at: Date = new Date(),
): Estimate {
  const tier = tierById(String(tierId));
  const straight = haversineKm(pickup, dropoff);
  // road factor: Accra roads are rarely straight
  const distanceKm = Math.max(0.8, Math.round(straight * 1.32 * 10) / 10);
  const avgSpeed = tier.id === 'bike' ? 24 : 20; // km/h in city traffic
  const durationMin = Math.max(4, Math.round((distanceKm / avgSpeed) * 60 + 3));
  const hour = at.getHours();
  const surge = hour >= 7 && hour <= 9 ? 1.15 : hour >= 17 && hour <= 19 ? 1.25 : 1;
  const raw = tier.baseCents + distanceKm * tier.perKmCents + durationMin * tier.perMinCents;
  const fareCents = Math.max(tier.minCents, Math.round((raw * surge) / 50) * 50);
  return {
    tier: tier.id,
    distanceKm,
    durationMin,
    fareCents,
    surge,
    etaPickupMin: tier.etaMin + (surge > 1 ? 2 : 0),
    currency: 'GHS',
  };
}

export function formatGhs(cents: number): string {
  const value = cents / 100;
  return `GH₵${value.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatKm(km: number): string {
  return `${km.toFixed(1)} km`;
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Normalised x/y for the stylised Ghana map */
export function cityPoint(lat: number, lng: number) {
  const x = ((lng + 3.6) / (1.35 + 3.6)) * 100;
  const y = ((11.3 - lat) / (11.3 - 4.6)) * 100;
  return { x: Math.min(96, Math.max(4, x)), y: Math.min(94, Math.max(6, y)) };
}
