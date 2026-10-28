import express from 'express';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initSchema } from './db.ts';
import { seed } from './seed.ts';
import { attachUser } from './auth.ts';
import { authRouter } from './routes/auth.ts';
import { ridesRouter, sweepSearchingRides } from './routes/rides.ts';
import { intercityRouter } from './routes/intercity.ts';
import { placesRouter } from './routes/places.ts';
import { vehiclesRouter } from './routes/vehicles.ts';
import { accountRouter } from './routes/account.ts';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);
const isProd = process.env.NODE_ENV === 'production';

initSchema();
const seeded = seed();
sweepSearchingRides();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api')) {
      console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - started}ms`);
    }
  });
  next();
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: 'rev', version: '1.0.0', time: new Date().toISOString() });
});

app.use(attachUser);
app.use('/api/auth', authRouter);
app.use('/api/rides', ridesRouter);
app.use('/api/intercity', intercityRouter);
app.use('/api/places', placesRouter);
app.use('/api/vehicles', vehiclesRouter);
app.use('/api', accountRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API endpoint' }));

if (isProd) {
  const dist = resolve(here, '../dist');
  if (existsSync(dist)) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(resolve(dist, 'index.html')));
  } else {
    console.warn('⚠ No production build found in rev/dist — run `npm run build` first.');
  }
}

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err?.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err?.status ? err.message : 'Something went wrong on our end. Try again.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Rev API listening on http://0.0.0.0:${PORT}`);
  console.log(`  ${seeded.seeded ? '✓ Demo data seeded — sign in as ama@rev.app / rev1234' : '• Using existing database'}\n`);
});
