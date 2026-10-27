import { useEffect } from 'react';

import { connect } from './state/socket.js';
import { useStore } from './state/store.js';
import { MapCanvas } from './map/MapCanvas.js';
import { Panel } from './panels/Panel.js';
import { ResourceBoard } from './panels/ResourceBoard.js';

function Header(): React.JSX.Element {
  const connected = useStore((s) => s.connected);
  const meta = useStore((s) => s.meta);
  const simTimeMs = useStore((s) => s.world?.simTimeMs ?? 0);

  const minutes = Math.floor(simTimeMs / 60000);
  const seconds = Math.floor((simTimeMs % 60000) / 1000);

  return (
    <header className="app-head">
      <h1>ResQroute · Multi-Agent Dispatch</h1>
      <div className="head-meta">
        <span className="clock" aria-label="Simulation clock">
          T+{minutes}:{String(seconds).padStart(2, '0')}
        </span>
        <span className="agents">
          {meta?.provider ? `${meta.provider} · ${meta.model}` : 'rules engine'}
        </span>
        {meta?.replay ? <span className="badge replay">REPLAY</span> : null}
        <span className={`badge ${connected ? 'up' : 'down'}`}>
          {connected ? 'LIVE' : 'RECONNECTING'}
        </span>
      </div>
    </header>
  );
}

export function App(): React.JSX.Element {
  useEffect(() => connect(), []);
  const city = useStore((s) => s.meta?.city);

  return (
    <div className="app">
      <Header />

      <main className="grid">
        <div className="map-cell">{city ? <MapCanvas city={city} /> : <div className="map placeholder">Connecting…</div>}</div>

        <div className="side">
          <Panel title="Agent Activity" live className="grow">
            <p className="empty">No protocol traffic yet.</p>
          </Panel>
          <ResourceBoard />
        </div>

        <Panel title="Statistics" className="stats-cell">
          <p className="empty">Waiting for the first resolved incident.</p>
        </Panel>

        <Panel title="Incident Feed" className="feed-cell">
          <p className="empty">No reports.</p>
        </Panel>
      </main>

      <footer className="disclaimer">
        <strong>Simulation only.</strong> Not connected to any emergency service. Incidents,
        units, and stations are synthetic; response times are properties of this simulation and
        do not describe Mumbai&rsquo;s emergency services.
      </footer>
    </div>
  );
}
