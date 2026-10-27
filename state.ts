/**
 * The blackboard — one authoritative WorldState every agent reads.
 *
 * This module owns the reference and hands it out. It does not decide how state
 * changes; `reducer.ts` does, and it is the only writer.
 */

import type { CityConfig, Station, Unit, WorldState } from '@sim/shared';
import type { UnitSeed } from '../config/city.mumbai.js';

export function createInitialWorld(city: CityConfig, fleet: UnitSeed[]): WorldState {
  const stations = new Map<string, Station>(city.stations.map((s) => [s.id, s]));
  const units: Record<string, Unit> = {};

  for (const seed of fleet) {
    const station = stations.get(seed.stationId);
    if (!station) {
      throw new Error(`Unit ${seed.id} references unknown station ${seed.stationId}`);
    }
    if (station.department !== seed.department) {
      throw new Error(
        `Unit ${seed.id} (${seed.department}) is stationed at ${station.id} (${station.department})`,
      );
    }
    units[seed.id] = {
      id: seed.id,
      department: seed.department,
      type: seed.type,
      stationId: station.id,
      home: { ...station.position },
      position: { ...station.position },
      status: 'AVAILABLE',
    };
  }

  return {
    simTimeMs: 0,
    running: false,
    forcedFallback: false,
    units,
    incidents: {},
    stats: {
      active: 0,
      resolved: 0,
      avgFirstResponseMs: null,
      baselineAvgFirstResponseMs: null,
      decisions: 0,
      fallbackDecisions: 0,
    },
  };
}

/** Holds the current reference. Swapped only by the reducer. */
export class WorldStore {
  #world: WorldState;
  readonly #initial: () => WorldState;

  constructor(build: () => WorldState) {
    this.#initial = build;
    this.#world = build();
  }

  get current(): WorldState {
    return this.#world;
  }

  /**
   * Not exported for general use — `reducer.ts` is the only caller. Kept
   * narrow deliberately: if this becomes a convenient setter, the single-writer
   * guarantee that makes hallucinated unit IDs harmless quietly disappears.
   */
  commit(next: WorldState): void {
    this.#world = next;
  }

  reset(): void {
    this.#world = this.#initial();
  }
}
