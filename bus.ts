/**
 * The event bus.
 *
 * Two kinds of listener, and conflating them is a real bug that is easy to ship:
 *
 *   - Subscribers run agent logic and may mutate state through the reducer.
 *   - Broadcasters observe. The WebSocket fan-out, the recorder, the baseline
 *     stats collector. They never write.
 *
 * The split is what makes replay possible: `emitToObservers` re-broadcasts a
 * recorded run to the dashboard without re-running the agent layer.
 *
 * Every handler is isolated. A throwing subscriber must not stop other
 * subscribers, and must not stop broadcasters from seeing the event — otherwise
 * one bad agent handler silently freezes the dashboard and the failure looks
 * like a hung UI rather than a caught exception.
 */

export type BusHandler<E> = (event: E) => void | Promise<void>;

export type ListenerKind = 'subscriber' | 'broadcaster';

interface Listener<E> {
  name: string;
  kind: ListenerKind;
  handler: BusHandler<E>;
}

export interface BusError {
  listener: string;
  kind: ListenerKind;
  error: unknown;
}

export interface BusStats {
  emitted: number;
  subscribers: number;
  broadcasters: number;
  errors: number;
}

export class EventBus<E> {
  #subscribers: Listener<E>[] = [];
  #broadcasters: Listener<E>[] = [];
  #emitted = 0;
  #errors = 0;
  #onError: (e: BusError) => void;

  constructor(onError?: (e: BusError) => void) {
    this.#onError =
      onError ??
      (({ listener, kind, error }) => {
        console.error(`[bus] ${kind} "${listener}" threw:`, error);
      });
  }

  /** Register a handler that may mutate state. Returns an unsubscribe fn. */
  subscribe(name: string, handler: BusHandler<E>): () => void {
    return this.#add(this.#subscribers, { name, kind: 'subscriber', handler });
  }

  /** Register a read-only observer. Returns an unsubscribe fn. */
  broadcast(name: string, handler: BusHandler<E>): () => void {
    return this.#add(this.#broadcasters, { name, kind: 'broadcaster', handler });
  }

  /** Normal path: agents react, then observers see the result. */
  emit(event: E): void {
    this.#emitted += 1;
    this.#run(this.#subscribers, event);
    this.#run(this.#broadcasters, event);
  }

  /**
   * Replay path: observers only. Nothing re-runs the agent layer, so a recorded
   * run reproduces exactly what happened rather than deciding it again.
   */
  emitToObservers(event: E): void {
    this.#emitted += 1;
    this.#run(this.#broadcasters, event);
  }

  get stats(): BusStats {
    return {
      emitted: this.#emitted,
      subscribers: this.#subscribers.length,
      broadcasters: this.#broadcasters.length,
      errors: this.#errors,
    };
  }

  #add(into: Listener<E>[], listener: Listener<E>): () => void {
    into.push(listener);
    return () => {
      const i = into.indexOf(listener);
      if (i >= 0) into.splice(i, 1);
    };
  }

  /**
   * Iterate over a copy: a handler may unsubscribe itself or register another
   * mid-dispatch, and mutating the live array during iteration would skip
   * listeners.
   */
  #run(listeners: Listener<E>[], event: E): void {
    for (const listener of [...listeners]) {
      try {
        const result = listener.handler(event);
        if (result instanceof Promise) {
          result.catch((error: unknown) => this.#report(listener, error));
        }
      } catch (error) {
        this.#report(listener, error);
      }
    }
  }

  #report(listener: Listener<E>, error: unknown): void {
    this.#errors += 1;
    this.#onError({ listener: listener.name, kind: listener.kind, error });
  }
}
