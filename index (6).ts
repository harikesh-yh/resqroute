/**
 * Server bootstrap. Wires the bus, the clock, the tile host, and the socket.
 *
 * Nothing here makes decisions. It is composition only, so the pieces below can
 * each be reasoned about — and tested — on their own.
 */

import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import express from 'express';

import type { ActivityEntry, SessionMeta } from '@sim/shared';
import { config, publicSummary } from './config.js';
import { EventBus } from './core/bus.js';
import type { SimEvent } from './core/events.js';
import { Clock } from './world/clock.js';
import { WorldStore, createInitialWorld } from './world/state.js';
import { attachSocket } from './transport/socket.js';

const bus = new EventBus<SimEvent>();
const store = new WorldStore(() => createInitialWorld(config.city, config.fleet));
const clock = new Clock(bus, config.tickMs, config.simTimeScale);

/** Bounded ring so a long run cannot grow without limit. */
const MAX_ACTIVITY = 300;
const activity: ActivityEntry[] = [];

bus.broadcast('activity-log', (event) => {
  if (event.t !== 'ACTIVITY') return;
  activity.push(event.entry);
  if (activity.length > MAX_ACTIVITY) activity.shift();
});

/**
 * Snapshot the world to observers once per tick. Full snapshots, not deltas:
 * 11 units and ~14 incidents is a few KB at 2 Hz, and deltas would buy nothing
 * while introducing a whole class of desync bug.
 */
bus.subscribe('world-snapshot', (event) => {
  if (event.t !== 'TICK') return;
  bus.emit({ t: 'WORLD', world: store.current });
});

const meta = (): SessionMeta => ({
  city: config.city,
  simTimeScale: config.simTimeScale,
  ...publicSummary(),
  replay: Boolean(config.replayPath),
});

const app = express();
app.use(express.json());

const staticOpts = {
  acceptRanges: true,
  setHeaders: (res: express.Response) =>
    res.setHeader('Cache-Control', 'public, max-age=86400'),
};

/**
 * Local basemap. Range requests are what pmtiles needs, and express.static
 * serves them. No tile API, no key, works with the venue wifi off.
 */
app.use('/tiles', express.static(config.tilesDir, staticOpts));

/**
 * Glyphs and sprites, for the same reason — a CDN on the critical path is a
 * demo that fails when the venue wifi does.
 *
 * Mounted at /map-assets rather than /assets so it cannot collide with Vite's
 * build output directory when the production bundle is served from this origin.
 */
app.use('/map-assets', express.static(config.assetsDir, staticOpts));

app.get('/api/health', (_req, res) => {
  const world = store.current;
  res.json({
    ok: true,
    city: config.cityId,
    ...publicSummary(),
    replay: Boolean(config.replayPath),
    running: clock.running,
    simTimeMs: clock.simTimeMs,
    units: Object.keys(world.units).length,
    incidents: Object.keys(world.incidents).length,
    fallback: {
      decisions: world.stats.decisions,
      fallbackDecisions: world.stats.fallbackDecisions,
      forced: world.forcedFallback,
    },
    bus: bus.stats,
  });
});

const server = createServer(app);
attachSocket({ server, bus, store, meta, activity: () => [...activity] });

server.listen(config.port, () => {
  const tiles = `${config.cityId}.pmtiles`;
  if (!existsSync(`${config.tilesDir}/${tiles}`)) {
    console.warn(
      `[tiles] ${tiles} missing — the map will render empty.\n` +
        `        Run: pnpm --filter @sim/server tiles`,
    );
  }
  const { provider, model } = publicSummary();
  console.log(`[server] http://localhost:${config.port}  city=${config.cityId}`);
  console.log(
    `[server] agents=${provider ? `${provider}/${model}` : 'rules only (no LLM_API_KEY)'}` +
      `  tick=${config.tickMs}ms  scale=${config.simTimeScale}x`,
  );
  clock.start();
});
