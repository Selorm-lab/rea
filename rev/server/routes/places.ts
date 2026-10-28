import { Router } from 'express';
import { all, get, nowIso, run, uid } from '../db.ts';
import { requireAuth } from '../auth.ts';
import { notFound, num, oneOf, str } from '../lib.ts';
import { ACCRA_PLACES, CITIES } from '../../shared/travel.ts';

export const placesRouter = Router();

const ICONS = ['home', 'campus', 'work', 'food', 'gym', 'heart', 'pin', 'star'] as const;

/** Public search index: campuses, landmarks and cities. */
placesRouter.get('/suggestions', (req, res) => {
  const q = String(req.query.q ?? '').toLowerCase().trim();
  const places = ACCRA_PLACES.filter(
    (p) => !q || p.name.toLowerCase().includes(q) || p.area.toLowerCase().includes(q) || p.address.toLowerCase().includes(q),
  ).slice(0, 8);
  const cities = CITIES.filter((c) => !q || c.name.toLowerCase().includes(q) || c.region.toLowerCase().includes(q)).slice(0, 5);
  res.json({ places, cities });
});

placesRouter.use(requireAuth);

placesRouter.get('/', (req, res) => {
  res.json({ places: all('SELECT * FROM places WHERE user_id = ? ORDER BY created_at DESC', req.user!.id) });
});

placesRouter.post('/', (req, res) => {
  const id = uid('plc');
  run(
    `INSERT INTO places (id, user_id, label, name, address, icon, notes, lat, lng, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    req.user!.id,
    str(req.body?.label, 'Label', { max: 60 }),
    str(req.body?.name, 'Place name', { max: 140 }),
    str(req.body?.address, 'Address', { max: 240, optional: true }),
    oneOf(req.body?.icon ?? 'pin', ICONS, 'Icon'),
    str(req.body?.notes, 'Notes', { max: 300, optional: true }),
    num(req.body?.lat ?? 5.6037, 'Latitude', { min: -90, max: 90 }),
    num(req.body?.lng ?? -0.187, 'Longitude', { min: -180, max: 180 }),
    nowIso(),
  );
  res.status(201).json({ place: get('SELECT * FROM places WHERE id = ?', id) });
});

placesRouter.patch('/:id', (req, res) => {
  const place = get<any>('SELECT * FROM places WHERE id = ? AND user_id = ?', req.params.id, req.user!.id);
  if (!place) notFound('Saved place not found');
  const body = req.body ?? {};
  const next = {
    label: body.label !== undefined ? str(body.label, 'Label', { max: 60 }) : place.label,
    name: body.name !== undefined ? str(body.name, 'Place name', { max: 140 }) : place.name,
    address: body.address !== undefined ? str(body.address, 'Address', { max: 240, optional: true }) : place.address,
    icon: body.icon !== undefined ? oneOf(body.icon, ICONS, 'Icon') : place.icon,
    notes: body.notes !== undefined ? str(body.notes, 'Notes', { max: 300, optional: true }) : place.notes,
  };
  run(
    'UPDATE places SET label = ?, name = ?, address = ?, icon = ?, notes = ? WHERE id = ?',
    next.label,
    next.name,
    next.address,
    next.icon,
    next.notes,
    place.id,
  );
  res.json({ place: get('SELECT * FROM places WHERE id = ?', place.id) });
});

placesRouter.delete('/:id', (req, res) => {
  const place = get('SELECT id FROM places WHERE id = ? AND user_id = ?', req.params.id, req.user!.id);
  if (!place) notFound('Saved place not found');
  run('DELETE FROM places WHERE id = ?', req.params.id);
  res.json({ ok: true });
});
