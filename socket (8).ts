import type { ServerEvent } from '@sim/shared';
import { useStore } from './store.js';

/**
 * Reconnecting WebSocket client.
 *
 * It retries forever rather than surfacing a failure dialog: on a stage, a
 * server restart should heal itself while the operator keeps talking. The
 * connection indicator in the header is the honest signal.
 */
export function connect(): () => void {
  let socket: WebSocket | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const open = (): void => {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    socket = new WebSocket(`${proto}//${location.host}/ws`);

    socket.onopen = () => useStore.getState().setConnected(true);

    socket.onmessage = (raw) => {
      let event: ServerEvent;
      try {
        event = JSON.parse(raw.data as string) as ServerEvent;
      } catch (error) {
        console.error('[ws] unparseable frame', error);
        return;
      }
      useStore.getState().apply(event);
    };

    socket.onclose = () => {
      useStore.getState().setConnected(false);
      if (!closed) retry = setTimeout(open, 1000);
    };

    // `onclose` always follows `onerror`, so reconnection is handled there.
    socket.onerror = () => socket?.close();
  };

  open();

  return () => {
    closed = true;
    if (retry) clearTimeout(retry);
    socket?.close();
  };
}
