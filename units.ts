import type { FeatureCollection, Point } from 'geojson';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { CityConfig, Department, Unit } from '@sim/shared';

export const DEPARTMENT_COLOR: Record<Department, string> = {
  FIRE: '#ff5a3c',
  MEDICAL: '#2ee6a8',
  POLICE: '#4d9dff',
};

const UNITS_SOURCE = 'units';
const STATIONS_SOURCE = 'stations';

function unitsToGeoJSON(units: Unit[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: units.map((unit) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [unit.position.lng, unit.position.lat] },
      properties: {
        id: unit.id,
        department: unit.department,
        type: unit.type,
        status: unit.status,
        color: DEPARTMENT_COLOR[unit.department],
      },
    })),
  };
}

function stationsToGeoJSON(city: CityConfig): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: city.stations.map((station) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [station.position.lng, station.position.lat] },
      properties: {
        id: station.id,
        name: station.name,
        color: DEPARTMENT_COLOR[station.department],
      },
    })),
  };
}

const EMPTY: FeatureCollection<Point> = { type: 'FeatureCollection', features: [] };

export function addUnitLayers(map: MapLibreMap, city: CityConfig): void {
  map.addSource(STATIONS_SOURCE, { type: 'geojson', data: stationsToGeoJSON(city) });
  map.addSource(UNITS_SOURCE, { type: 'geojson', data: EMPTY });

  map.addLayer({
    id: 'stations',
    type: 'circle',
    source: STATIONS_SOURCE,
    paint: {
      'circle-radius': 5,
      'circle-color': '#0b0f16',
      'circle-stroke-width': 2,
      'circle-stroke-color': ['get', 'color'],
      'circle-opacity': 0.9,
    },
  });

  map.addLayer({
    id: 'units-halo',
    type: 'circle',
    source: UNITS_SOURCE,
    paint: {
      'circle-radius': 13,
      'circle-color': ['get', 'color'],
      'circle-opacity': 0.18,
    },
  });

  map.addLayer({
    id: 'units-dot',
    type: 'circle',
    source: UNITS_SOURCE,
    paint: {
      'circle-radius': 7,
      'circle-color': ['get', 'color'],
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#0b0f16',
    },
  });

  map.addLayer({
    id: 'units-label',
    type: 'symbol',
    source: UNITS_SOURCE,
    layout: {
      'text-field': ['get', 'id'],
      'text-font': ['Noto Sans Medium'],
      'text-size': 12,
      'text-offset': [0, 1.3],
      'text-anchor': 'top',
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#e8eef7',
      'text-halo-color': '#0b0f16',
      'text-halo-width': 1.5,
    },
  });
}

export function updateUnits(map: MapLibreMap, units: Unit[]): void {
  // Undefined between style load and addUnitLayers, and after a style reload.
  const source = map.getSource<GeoJSONSource>(UNITS_SOURCE);
  source?.setData(unitsToGeoJSON(units));
}
