import { layers, namedFlavor } from '@protomaps/basemaps';
import type { StyleSpecification } from 'maplibre-gl';
import type { CityConfig } from '@sim/shared';

/**
 * Basemap style, assembled locally.
 *
 * Every asset — tiles, glyphs, sprites — is served by our own backend. The
 * usual Protomaps setup points glyphs and sprites at protomaps.github.io, which
 * would put a CDN on the critical path of a demo whose whole reliability story
 * is "works with the wifi off". See server/scripts/fetch-map-assets.mjs.
 */
export const SOURCE_ID = 'protomaps';

export function darkStyle(city: CityConfig): StyleSpecification {
  return {
    version: 8,
    glyphs: `${location.origin}/map-assets/fonts/{fontstack}/{range}.pbf`,
    sprite: `${location.origin}/map-assets/sprites/black`,
    sources: {
      [SOURCE_ID]: {
        type: 'vector',
        url: `pmtiles://${location.origin}/tiles/${city.id}.pmtiles`,
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> · Protomaps',
      },
    },
    layers: layers(SOURCE_ID, namedFlavor('black'), { lang: 'en' }),
  };
}
