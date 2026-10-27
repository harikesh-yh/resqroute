/**
 * WebSocket fan-out. Registered as a *broadcaster* — it observes and never
 * writes, so a replayed run reaches the dashboard through exactly this path.
 */

import type { Server } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';

import type { ActivityEntry, ServerEvent, SessionMeta } from '@sim/shared';
import type { EventBus } from '../core/bus.js';
import type { SimEvent } from '../core/events.js';
import type { WorldStore } from '../world/state.js';

export interface SocketDeps {
  server: Server;
  bus: EventBus<SimEvent>;
  store: WorldStore;
  meta: () => SessionMeta;
  /** Recent protocol messages, replayed to a client that joins mid-run. */
  activity: () => ActivityEntry[];
}

export function attachSocket({ server, bus, store, meta, activity }: SocketDeps): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });

  const send = (socket: WebSocket, event: ServerEvent): void => {
    if (socket.readyState !== socket.OPEN) return;
    socket.send(JSON.stringify(event));
  };

  const sendAll = (event: ServerEvent): void => {
    const payload = JSON.stringify(event);
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) client.send(payload);
    }
  };

  wss.on('connection', (socket) => {
    send(socket, {
      t: 'HELLO',
      meta: meta(),
      activity: activity(),
      world: store.current,
    });
  });

  bus.broadcast('websocket', (event) => {
    switch (event.t) {
      case 'TICK':
        sendAll({ t: 'HEARTBEAT', simTimeMs: event.simTimeMs, wallMs: event.wallMs });
        break;
      case 'WORLD':
        sendAll({ t: 'WORLD', world: event.world });
        break;
      case 'ACTIVITY':
        sendAll({ t: 'ACTIVITY', entry: event.entry });
        break;
      case 'INCIDENT_REPORTED':
      case 'INCIDENT_RESOLVED':
        // Reflected in the next WORLD snapshot; no separate wire message.
        break;
    }
  });

  return wss;
}
