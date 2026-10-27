/**
 * The tick loop. Emits TICK on the bus; it does not touch state itself.
 *
 * Physics runs here and never waits on a model. Agent reasoning happens off
 * this loop, so an LLM call that takes three seconds slows the decision, not
 * the city — vehicles keep moving while a department is thinking.
 */

import type { EventBus } from '../core/bus.js';
import type { SimEvent } from '../core/events.js';

export class Clock {
  #timer: NodeJS.Timeout | null = null;
  #simTimeMs = 0;

  constructor(
    private readonly bus: EventBus<SimEvent>,
    private readonly tickMs: number,
    private readonly timeScale: number,
  ) {}

  get simTimeMs(): number {
    return this.#simTimeMs;
  }

  get running(): boolean {
    return this.#timer !== null;
  }

  start(): void {
    if (this.#timer) return;
    this.#timer = setInterval(() => this.#tick(), this.tickMs);
  }

  pause(): void {
    if (!this.#timer) return;
    clearInterval(this.#timer);
    this.#timer = null;
  }

  reset(): void {
    this.pause();
    this.#simTimeMs = 0;
  }

  #tick(): void {
    this.#simTimeMs += this.tickMs * this.timeScale;
    this.bus.emit({ t: 'TICK', simTimeMs: this.#simTimeMs, wallMs: Date.now() });
  }
}
