import { Router } from 'express';
import { all, get, nowIso, run, uid } from '../db.ts';
import { requireAuth } from '../auth.ts';
import { bad, notFound, num, oneOf, str } from '../lib.ts';
import { TIERS } from '../../shared/travel.ts';

export const vehiclesRouter = Router();
vehiclesRouter.use(requireAuth);

const TYPES = TIERS.map((t) => t.id);

vehiclesRouter.get('/', (req, res) => {
  res.json({ vehicles: all('SELECT * FROM vehicles WHERE user_id = ? ORDER BY created_at DESC', req.user!.id) });
});

vehiclesRouter.post('/', (req, res) => {
  const plate = str(req.body?.plate, 'Plate number', { max: 24 }).toUpperCase();
  const dupe = get('SELECT id FROM vehicles WHERE user_id = ? AND plate = ?', req.user!.id, plate);
  if (dupe) bad('You already added a vehicle with that plate');
  const id = uid('veh');
  run(
    `INSERT INTO vehicles (id, user_id, make, model, plate, color, type, seats, is_active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    req.user!.id,
    str(req.body?.make, 'Make', { max: 60 }),
    str(req.body?.model, 'Model', { max: 60 }),
    plate,
    str(req.body?.color ?? 'White', 'Colour', { max: 40 }),
    oneOf(req.body?.type ?? 'go', TYPES, 'Vehicle type'),
    Math.round(num(req.body?.seats ?? 4, 'Seats', { min: 1, max: 20 })),
    req.body?.is_active === false ? 0 : 1,
    nowIso(),
  );
  res.status(201).json({ vehicle: get('SELECT * FROM vehicles WHERE id = ?', id) });
});

vehiclesRouter.patch('/:id', (req, res) => {
  const v = get<any>('SELECT * FROM vehicles WHERE id = ? AND user_id = ?', req.params.id, req.user!.id);
  if (!v) notFound('Vehicle not found');
  const body = req.body ?? {};
  run(
    'UPDATE vehicles SET make = ?, model = ?, plate = ?, color = ?, type = ?, seats = ?, is_active = ? WHERE id = ?',
    body.make !== undefined ? str(body.make, 'Make', { max: 60 }) : v.make,
    body.model !== undefined ? str(body.model, 'Model', { max: 60 }) : v.model,
    body.plate !== undefined ? str(body.plate, 'Plate', { max: 24 }).toUpperCase() : v.plate,
    body.color !== undefined ? str(body.color, 'Colour', { max: 40 }) : v.color,
    body.type !== undefined ? oneOf(body.type, TYPES, 'Vehicle type') : v.type,
    body.seats !== undefined ? Math.round(num(body.seats, 'Seats', { min: 1, max: 20 })) : v.seats,
    body.is_active !== undefined ? (body.is_active ? 1 : 0) : v.is_active,
    v.id,
  );
  res.json({ vehicle: get('SELECT * FROM vehicles WHERE id = ?', v.id) });
});

vehiclesRouter.delete('/:id', (req, res) => {
  const v = get('SELECT id FROM vehicles WHERE id = ? AND user_id = ?', req.params.id, req.user!.id);
  if (!v) notFound('Vehicle not found');
  run('DELETE FROM vehicles WHERE id = ?', req.params.id);
  res.json({ ok: true });
});
