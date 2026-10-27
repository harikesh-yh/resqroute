/**
 * The internal event vocabulary carried by the bus.
 *
 * Broader than `ServerEvent` in @sim/shared: agents subscribe to domain events
 * the dashboard never sees. `transport/socket.ts` is the broadcaster that maps
 * the subset the client cares about onto the wire.
 */

import type { Incident, WorldState, ActivityEntry } from '@sim/shared';

export type SimEvent =
  /** Clock advanced. Carries sim time so handlers never read a global. */
  | { t: 'TICK'; simTimeMs: number; wallMs: number }
  /** A new report entered through sim/ingest.ts, from any source. */
  | { t: 'INCIDENT_REPORTED'; incident: Incident }
  /** An incident reached RESOLVED. */
  | { t: 'INCIDENT_RESOLVED'; incident: Incident }
  /** A protocol message was produced and accepted. */
  | { t: 'ACTIVITY'; entry: ActivityEntry }
  /** State after a reducer application. Observers render this. */
  | { t: 'WORLD'; world: WorldState };

export type SimEventType = SimEvent['t'];
