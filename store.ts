import { create } from 'zustand';
import type { ActivityEntry, ServerEvent, SessionMeta, WorldState } from '@sim/shared';

/** Matches the server's ring so a long run cannot grow the client unbounded. */
const MAX_ACTIVITY = 300;

interface AppState {
  connected: boolean;
  meta: SessionMeta | null;
  world: WorldState | null;
  activity: ActivityEntry[];
  /** Wall clock of the last heartbeat — proves the sim is alive, not just up. */
  lastHeartbeat: number | null;

  setConnected: (connected: boolean) => void;
  apply: (event: ServerEvent) => void;
}

export const useStore = create<AppState>((set) => ({
  connected: false,
  meta: null,
  world: null,
  activity: [],
  lastHeartbeat: null,

  setConnected: (connected) => set({ connected }),

  apply: (event) =>
    set((state) => {
      switch (event.t) {
        case 'HELLO':
          return {
            meta: event.meta,
            world: event.world,
            activity: event.activity,
          };
        case 'WORLD':
          return { world: event.world };
        case 'ACTIVITY': {
          const next = [...state.activity, event.entry];
          return { activity: next.slice(-MAX_ACTIVITY) };
        }
        case 'HEARTBEAT':
          return { lastHeartbeat: event.wallMs };
      }
    }),
}));
