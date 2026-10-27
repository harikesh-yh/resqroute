import { useEffect, useRef, useState } from 'react';
import maplibregl, { Map as MapLibreMap } from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import 'maplibre-gl/dist/maplibre-gl.css';

import type { CityConfig } from '@sim/shared';
import { useStore } from '../state/store.js';
import { darkStyle } from './style-dark.js';
import { addUnitLayers, updateUnits } from './layers/units.js';

// Registered once for the page, not per mount: MapLibre keeps protocol handlers
// in a module-level registry and re-adding throws.
let protocolRegistered = false;
function registerPmtiles(): void {
  if (protocolRegistered) return;
  maplibregl.addProtocol('pmtiles', new Protocol().tile);
  protocolRegistered = true;
}

export function MapCanvas({ city }: { city: CityConfig }): React.JSX.Element {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!container.current || map.current) return;
    registerPmtiles();

    const instance = new maplibregl.Map({
      container: container.current,
      style: darkStyle(city),
      center: [city.center.lng, city.center.lat],
      zoom: city.zoom,
      maxBounds: city.mapBbox,
      attributionControl: { compact: true },
    });

    instance.on('load', () => {
      addUnitLayers(instance, city);
      setReady(true);
    });

    // Dev-only handle, so a console or a headless render check can ask the map
    // what it actually drew. `import.meta.env.DEV` is statically false in a
    // production build, so this disappears at bundle time.
    if (import.meta.env.DEV) {
      (window as unknown as { __map?: MapLibreMap }).__map = instance;
    }

    map.current = instance;
    return () => {
      instance.remove();
      map.current = null;
      setReady(false);
    };
  }, [city]);

  // Units come from the world snapshot, which arrives at tick rate. Pushing
  // straight into the GeoJSON source keeps React out of the animation path.
  const units = useStore((s) => s.world?.units);
  useEffect(() => {
    if (!ready || !map.current || !units) return;
    updateUnits(map.current, Object.values(units));
  }, [ready, units]);

  return <div ref={container} className="map" />;
}
