#!/usr/bin/env node
/**
 * One-time fetch of everything the map needs, so that at demo time the browser
 * talks to nothing but our own backend.
 *
 *   tiles   a bbox extract of the Protomaps daily basemap build
 *   fonts   the glyph ranges the style's fontstacks reference
 *   sprites the icon atlas for the flavor
 *
 * The usual MapLibre + Protomaps setup points glyphs and sprites at a CDN. That
 * is fine in production and fatal on a conference stage, so all three land on
 * disk here. Run: pnpm --filter @sim/server tiles
 */

import { execFileSync } from 'node:child_process';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ASSETS = 'https://protomaps.github.io/basemaps-assets';
const BUILDS = 'https://build.protomaps.com';

/** The three stacks the flavor's text-font expressions reference. */
const FONTSTACKS = ['Noto Sans Regular', 'Noto Sans Medium', 'Noto Sans Italic'];

/**
 * Not a guess. These are ranges the label text in the current map extract
 * actually occupies, measured by decoding its tiles and reading only the
 * properties the style's text-field expressions consume (`name`, `name:en`,
 * `ref`, `shield_text`, ...), ignoring the name:ko / name:zh / name:th tags
 * that ship in the tiles but that a `lang: 'en'` style never draws.
 *
 * The four beyond plain Latin all earn their place at the demo's own zoom:
 *
 *   1536-1791   Arabic     mosque names, e.g. احمدیہ مسجد
 *   2304-2559   Devanagari the many features with no name:en, e.g. गोकुळदास तेजपाल रुग्णालय
 *   8192-8447   punctuation the curly apostrophe in "A.I.'s Allana Boys High School"
 *   512-1279    Greek/Cyrillic only reachable by zooming out to continental scale
 *
 * Protomaps also encodes shaped Devanagari into a private-use area (`pgf:name`,
 * U+F8xx). Those ranges are deliberately absent: Noto Sans carries no glyphs
 * there, and the assets server returns a 29-byte empty stack for them, so
 * fetching them would add files that can never draw anything.
 */
const RANGES = [
  '0-255',
  '256-511',
  '512-767',
  '768-1023',
  '1024-1279',
  '1536-1791',
  '2304-2559',
  '8192-8447',
];
const SPRITES = ['black.json', 'black.png', 'black@2x.png'];

const CITIES = {
  // Byculla–Parel–Dadar corridor. Must match server/src/config/city.mumbai.ts.
  mumbai: { mapBbox: '72.79,18.95,72.90,19.05', maxzoom: 15 },
};

function ymd(date) {
  return (
    `${date.getUTCFullYear()}` +
    String(date.getUTCMonth() + 1).padStart(2, '0') +
    String(date.getUTCDate()).padStart(2, '0')
  );
}

/**
 * Protomaps keeps daily builds for a rolling window, so a hardcoded date rots.
 * Walk back from today until one answers.
 */
async function latestBuild() {
  for (let back = 1; back <= 14; back += 1) {
    const date = new Date(Date.now() - back * 86_400_000);
    const url = `${BUILDS}/${ymd(date)}.pmtiles`;
    const res = await fetch(url, { method: 'HEAD' });
    if (res.ok) return url;
  }
  throw new Error(`No Protomaps daily build found in the last 14 days at ${BUILDS}`);
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
}

async function fetchTiles(cityId) {
  const city = CITIES[cityId];
  if (!city) throw new Error(`Unknown city "${cityId}". Known: ${Object.keys(CITIES).join(', ')}`);

  const dest = resolve(serverRoot, 'tiles', `${cityId}.pmtiles`);
  if (await exists(dest)) {
    console.log(`tiles   ${cityId}.pmtiles already present — skipping`);
    return;
  }

  const source = await latestBuild();
  console.log(`tiles   extracting ${city.mapBbox} from ${source}`);
  await mkdir(dirname(dest), { recursive: true });

  try {
    // Range requests: only the tiles inside the bbox cross the network, not the
    // whole planet archive.
    execFileSync(
      'pmtiles',
      ['extract', source, dest, `--bbox=${city.mapBbox}`, `--maxzoom=${city.maxzoom}`],
      { stdio: 'inherit' },
    );
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error('pmtiles CLI not found. Install it: brew install pmtiles');
    }
    throw error;
  }
}

async function fetchFonts() {
  let fetched = 0;
  for (const stack of FONTSTACKS) {
    for (const range of RANGES) {
      const dest = resolve(serverRoot, 'assets/fonts', stack, `${range}.pbf`);
      if (await exists(dest)) continue;
      await download(`${ASSETS}/fonts/${encodeURIComponent(stack)}/${range}.pbf`, dest);
      fetched += 1;
    }
  }
  console.log(`fonts   ${FONTSTACKS.length} stacks, ${fetched} range files fetched`);
}

async function fetchSprites() {
  let fetched = 0;
  for (const name of SPRITES) {
    const dest = resolve(serverRoot, 'assets/sprites', name);
    if (await exists(dest)) continue;
    await download(`${ASSETS}/sprites/v4/${name}`, dest);
    fetched += 1;
  }
  console.log(`sprites ${fetched} files fetched`);
}

const cityId = process.argv[2] ?? process.env.CITY ?? 'mumbai';

await fetchTiles(cityId);
await fetchFonts();
await fetchSprites();

console.log('\nMap assets ready. The browser now needs nothing but this backend.');
