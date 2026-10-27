/**
 * Environment loading and city selection.
 *
 * `llm.apiKey` is read here and never leaves this process. It is not placed on
 * any object that is serialised to the client — see `publicSummary()`, which is
 * the only shape the browser ever sees.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import type { CityConfig } from '@sim/shared';
import { mumbai, mumbaiFleet, type UnitSeed } from './config/city.mumbai.js';

const here = dirname(fileURLToPath(import.meta.url));
export const serverRoot = resolve(here, '..');
export const repoRoot = resolve(serverRoot, '..');

dotenv.config({ path: resolve(repoRoot, '.env'), quiet: true });

const CITIES: Record<string, { city: CityConfig; fleet: UnitSeed[] }> = {
  mumbai: { city: mumbai, fleet: mumbaiFleet },
};

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number, got "${raw}"`);
  }
  return parsed;
}

function str(name: string): string | null {
  const raw = process.env[name]?.trim();
  return raw ? raw : null;
}

const cityId = str('CITY') ?? 'mumbai';
const selected = CITIES[cityId];
if (!selected) {
  throw new Error(`Unknown CITY "${cityId}". Known: ${Object.keys(CITIES).join(', ')}`);
}

export interface LlmConfig {
  provider: string | null;
  apiKey: string | null;
  model: string | null;
}

export const config = {
  port: num('PORT', 8787),
  cityId,
  city: selected.city,
  fleet: selected.fleet,

  /** Sim seconds per wall second. */
  simTimeScale: num('SIM_TIME_SCALE', 6),
  /** Wall ms between ticks. */
  tickMs: num('TICK_MS', 500),

  llm: {
    provider: str('LLM_PROVIDER'),
    apiKey: str('LLM_API_KEY'),
    model: str('LLM_MODEL'),
  } satisfies LlmConfig,

  /** Path to a recording, relative to server/. Empty means live agents. */
  replayPath: str('REPLAY_MODE'),

  tilesDir: resolve(serverRoot, 'tiles'),
  assetsDir: resolve(serverRoot, 'assets'),
} as const;

/** True only when a provider is both selected and actually credentialed. */
export function llmAvailable(): boolean {
  return Boolean(config.llm.provider && config.llm.apiKey);
}

/**
 * Everything the client is allowed to know about the LLM setup. Deliberately
 * hand-built rather than a spread of `config.llm`, so adding a secret to that
 * object cannot leak it by accident.
 */
export function publicSummary(): { provider: string | null; model: string | null } {
  return {
    provider: llmAvailable() ? config.llm.provider : null,
    model: llmAvailable() ? config.llm.model : null,
  };
}
