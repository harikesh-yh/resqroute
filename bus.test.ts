/**
 * Phase 0 exit criterion: a throwing handler must not stop the dispatch.
 *
 * Without this, one bad agent handler silently freezes the dashboard and the
 * failure presents as a hung UI rather than a caught exception.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { EventBus, type BusError } from '../src/core/bus.js';

interface Ping {
  n: number;
}

function silentBus(): { bus: EventBus<Ping>; errors: BusError[] } {
  const errors: BusError[] = [];
  const bus = new EventBus<Ping>((e) => errors.push(e));
  return { bus, errors };
}

test('a throwing subscriber does not stop later subscribers', () => {
  const { bus, errors } = silentBus();
  const seen: string[] = [];

  bus.subscribe('first', () => {
    seen.push('first');
  });
  bus.subscribe('explodes', () => {
    throw new Error('boom');
  });
  bus.subscribe('third', () => {
    seen.push('third');
  });

  bus.emit({ n: 1 });

  assert.deepEqual(seen, ['first', 'third']);
  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.listener, 'explodes');
  assert.equal(errors[0]?.kind, 'subscriber');
});

test('a throwing subscriber does not stop broadcasters', () => {
  const { bus } = silentBus();
  const observed: number[] = [];

  bus.subscribe('explodes', () => {
    throw new Error('boom');
  });
  bus.broadcast('observer', (e) => {
    observed.push(e.n);
  });

  bus.emit({ n: 7 });

  assert.deepEqual(observed, [7]);
});

test('a rejecting async handler is caught and reported', async () => {
  const { bus, errors } = silentBus();
  const observed: number[] = [];

  bus.subscribe('async-explodes', async () => {
    throw new Error('async boom');
  });
  bus.broadcast('observer', (e) => {
    observed.push(e.n);
  });

  bus.emit({ n: 2 });
  await new Promise((r) => setImmediate(r));

  assert.deepEqual(observed, [2]);
  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.listener, 'async-explodes');
});

test('emitToObservers skips subscribers entirely — the replay path', () => {
  const { bus } = silentBus();
  const agentRan: number[] = [];
  const observed: number[] = [];

  bus.subscribe('agent', (e) => {
    agentRan.push(e.n);
  });
  bus.broadcast('dashboard', (e) => {
    observed.push(e.n);
  });

  bus.emitToObservers({ n: 42 });

  assert.deepEqual(agentRan, [], 'replay must not re-run agent logic');
  assert.deepEqual(observed, [42]);
});

test('unsubscribing during dispatch does not skip the next listener', () => {
  const { bus } = silentBus();
  const seen: string[] = [];

  const off = bus.subscribe('self-removing', () => {
    seen.push('self-removing');
    off();
  });
  bus.subscribe('next', () => {
    seen.push('next');
  });

  bus.emit({ n: 1 });
  bus.emit({ n: 2 });

  assert.deepEqual(seen, ['self-removing', 'next', 'next']);
});

test('stats count listeners and errors', () => {
  const { bus } = silentBus();
  bus.subscribe('ok', () => {});
  bus.subscribe('bad', () => {
    throw new Error('boom');
  });
  bus.broadcast('obs', () => {});

  bus.emit({ n: 1 });

  assert.deepEqual(bus.stats, { emitted: 1, subscribers: 2, broadcasters: 1, errors: 1 });
});
