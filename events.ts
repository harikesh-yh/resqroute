/**
 * Wire envelopes.
 *
 * The server pushes full world snapshots rather than deltas. With 11 units and
 * roughly 14 incidents a snapshot is a few KB at 2 Hz, so delta encoding would
 * buy nothing and cost a whole class of desync bug.
 */

import type { CityConfig, IncidentKind, Severity, WorldState } from './world.js';
import type { ActivityEntry } from './protocol.js';

/** Sent once on connect, before any snapshot. */
export interface SessionMeta {
  city: CityConfig;
  simTimeScale: number;
  /** Which provider is configured, or null when running on rules only. */
  provider: string | null;
  model: string | null;
  /** True when booted from a recording; the UI says so out loud. */
  replay: boolean;
}

export type ServerEvent =
  | { t: 'HELLO'; meta: SessionMeta; activity: ActivityEntry[]; world: WorldState }
  | { t: 'WORLD'; world: WorldState }
  | { t: 'ACTIVITY'; entry: ActivityEntry }
  | { t: 'HEARTBEAT'; simTimeMs: number; wallMs: number };

/**
 * The only shape that enters the simulation. Scripted timeline, hotkeys, and
 * the judge sandbox all produce this — see server/src/sim/ingest.ts.
 */
export interface IncidentReport {
  kind: IncidentKind;
  lat: number;
  lng: number;
  severity: Severity;
  description: string;
  /** Omitted for ad-hoc reports; resolved from the gazetteer. */
  label?: string;
}
