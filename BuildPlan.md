# Build Plan — ResQroute Disaster Response Simulator

Companion to `productSpec.md`. That document says what we are building and why.
This one says in what order, with what structure, and how we know each step is done.

---

## Guiding sequencing rule

**The demo must be complete and runnable before any LLM call exists.**

Phase 1 ships a fully working simulator driven by the deterministic rule engine — map,
vehicles, incidents, protocol messages, reroutes, stats. Only then does Phase 2 replace the
rule engine's decisions with live LLM reasoning, keeping the rule engine as the fallback.

This inverts the tempting order (LLM first, polish later) and is the single most important
risk decision in the plan. It guarantees that on demo day there is always something to show.

---

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Vite + React + TypeScript | Fast HMR, low ceremony |
| Map | MapLibre GL JS | Open, no vendor key, full style control |
| Tiles | Protomaps `.pmtiles`, Mumbai extract, served locally | **Zero network dependency at demo time**, no API key |
| State (client) | Zustand | Small, no boilerplate, fine for one screen |
| Backend | Node + Express + `ws` | Holds the LLM key, streams state |
| Transport | WebSocket, server→client state deltas | Push model matches a live sim |
| LLM | Provider-agnostic adapter, Anthropic default | Required: key must not be hardcoded to one vendor |
| Validation | Zod | Schema-validates every LLM output |
| Routing | OSRM, precomputed at scenario build time | Real street paths without a runtime dependency |
| Monorepo | pnpm workspaces | `shared/` types consumed by both sides |

### Tiles

Download a Mumbai `.pmtiles` extract once and commit or vendor it. Served by the backend as a
static range-request file. No MapTiler account, no rate limits, works with the venue wifi off.
This is a demo-reliability decision, same family as the fallback engine.

### Routing

Running OSRM live is unnecessary. Instead: at scenario authoring time, resolve the
station→incident routes with OSRM and bake the geometry into the scenario JSON. Vehicles
follow real streets with no runtime routing service.

For ad-hoc incidents (hotkeys, and later the judge sandbox), fall back to a straight-line
path with light waypoint jitter. Visually acceptable, and it never blocks.

---

## Repository structure

```
ResQroute/
├── productSpec.md
├── BuildPlan.md
├── AGENTS.md
├── package.json                    pnpm workspace root
├── .env.example                    provider-agnostic LLM config
│
├── shared/
│   └── src/
│       ├── world.ts                Incident, Unit, Assignment, WorldState
│       ├── protocol.ts             ANNOUNCE / BID / NO_BID / AWARD / REVOKE
│       └── events.ts               client↔server message envelopes
│
├── server/
│   ├── src/
│   │   ├── index.ts                Express + ws bootstrap
│   │   ├── config.ts               env loading, city selection
│   │   │
│   │   ├── core/
│   │   │   └── bus.ts              event bus — subscribers vs broadcasters
│   │   │
│   │   ├── world/
│   │   │   ├── state.ts            the blackboard — single source of truth
│   │   │   ├── reducer.ts          pure state transitions, the only mutator
│   │   │   ├── invariants.ts       the four predicates the reducer enforces
│   │   │   ├── clock.ts            500 ms tick loop, 6× time compression
│   │   │   └── movement.ts         vehicle position stepping along baked paths
│   │   │
│   │   ├── cnp/
│   │   │   ├── auction.ts          runs one Contract Net round to completion
│   │   │   └── validate.ts         schema + semantic validation of proposals
│   │   │
│   │   ├── agents/
│   │   │   ├── coordinator.ts      triage, announce, award, revoke
│   │   │   ├── department.ts       one generic department agent, 3 instances
│   │   │   ├── fallback.ts         deterministic rule engine, same message shapes
│   │   │   └── prompts/
│   │   │       ├── triage.ts
│   │   │       ├── bid.ts
│   │   │       └── award.ts
│   │   │
│   │   ├── llm/
│   │   │   ├── provider.ts         LLMProvider interface
│   │   │   ├── anthropic.ts
│   │   │   ├── openai.ts
│   │   │   └── factory.ts          selects impl from env, never hardcoded
│   │   │
│   │   ├── sim/
│   │   │   ├── ingest.ts           ingestEvent() — the single entry seam
│   │   │   ├── scenario.ts         timeline loader and driver
│   │   │   ├── baseline.ts         shadow greedy dispatcher, stats only
│   │   │   ├── recorder.ts         writes {offsetMs, event} to a run file
│   │   │   ├── replayer.ts         re-broadcasts a run, bypassing subscribers
│   │   │   ├── recordings/
│   │   │   │   └── golden-run.json
│   │   │   └── scenarios/
│   │   │       └── mumbai-monsoon.json
│   │   │
│   │   ├── config/
│   │   │   └── city.mumbai.ts      bbox, stations, gazetteer
│   │   │
│   │   └── transport/
│   │       ├── socket.ts           full world snapshots at tick rate
│   │       └── rest.ts             control plane — start/pause/reset/inject
│   ├── scripts/
│   │   └── fetch-map-assets.mjs    one-time tiles + glyphs + sprites fetch
│   ├── test/
│   │   ├── bus.test.ts             subscriber/broadcaster split, error isolation
│   │   └── invariants.test.ts      the four predicates, unit-tested
│   ├── assets/                     glyphs and sprites, served at /map-assets
│   │   ├── fonts/<fontstack>/<range>.pbf
│   │   └── sprites/black.{json,png}
│   └── tiles/
│       └── mumbai.pmtiles
│
└── web/
    └── src/
        ├── main.tsx
        ├── App.tsx                 the single-screen grid layout
        ├── map/
        │   ├── MapCanvas.tsx
        │   ├── style-dark.ts       neon restyle of the basemap
        │   └── layers/
        │       ├── incidents.ts
        │       ├── units.ts
        │       └── routes.ts
        ├── panels/
        │   ├── AgentActivity.tsx
        │   ├── IncidentFeed.tsx
        │   ├── ResourceBoard.tsx
        │   └── StatsBar.tsx
        ├── state/
        │   ├── socket.ts
        │   └── store.ts
        └── hotkeys.ts
```

---

## Core data model

```ts
type Department = 'FIRE' | 'MEDICAL' | 'POLICE';
type Severity   = 1 | 2 | 3 | 4 | 5;

interface Incident {
  id: string;
  kind: 'FIRE' | 'ACCIDENT' | 'FLOOD' | 'COLLAPSE' | 'MEDICAL' | 'ROAD_BLOCK';
  location: { lat: number; lng: number; label: string };
  severity: Severity;
  description: string;
  reportedAt: number;                       // sim ms
  status: 'REPORTED' | 'TRIAGED' | 'ASSIGNED' | 'ON_SCENE' | 'RESOLVED';
  triage?: {
    priority: number;                       // 0-100, agent-assigned
    requiredUnits: Partial<Record<Department, number>>;
    rationale: string;
    source: 'llm' | 'fallback';
  };
  assignedUnitIds: string[];
  coverage: number;                         // 0-1, derived from triage.requiredUnits
  firstResponseAt?: number;
  resolvedAt?: number;
}

interface Unit {
  id: string;                               // "E-03", "AMB-11", "PTL-02"
  department: Department;
  type: 'ENGINE' | 'LADDER' | 'RESCUE' | 'AMBULANCE' | 'MCI' | 'PATROL' | 'TRAFFIC';
  home: LatLng;
  position: LatLng;
  status: 'AVAILABLE' | 'EN_ROUTE' | 'ON_SCENE' | 'RETURNING';
  assignedIncidentId?: string;
  path?: LatLng[];
  pathProgress?: number;                    // 0-1
  etaSeconds?: number;
}
```

### Protocol messages

```ts
type CnpMessage =
  | { t: 'ANNOUNCE'; incidentId: string; departments: Department[];
      priority: number; deadlineMs: number }
  | { t: 'BID'; incidentId: string; department: Department; unitIds: string[];
      etaSeconds: number; confidence: number; rationale: string;
      preempts?: { unitId: string; fromIncidentId: string; justification: string }[] }
  | { t: 'NO_BID'; incidentId: string; department: Department; reason: string }
  | { t: 'AWARD'; incidentId: string; department: Department;
      unitIds: string[]; rationale: string }
  | { t: 'REVOKE'; incidentId: string; unitIds: string[]; reason: string };
```

Every Agent Activity panel row is one of these five, rendered in English. Build the panel
directly off the protocol stream — do not invent a parallel logging format.

### The mutation rule

Agents emit `CnpMessage` proposals. `reducer.ts` is the only code permitted to write
`WorldState`. It validates every proposal against actual state before applying. A bid naming
a nonexistent unit, a unit from the wrong department, or a double-commitment without a
declared preemption is rejected at this boundary.

This is why hallucination is not a correctness risk.

### The four invariants

`world/invariants.ts` holds the predicates the reducer enforces on every proposal. They are
stated as named functions rather than inline `if`s so they can be unit-tested directly, which
is the only way the "hallucination is not a correctness risk" claim in `productSpec.md` §9 is
a fact rather than an aspiration.

| Predicate | Rejects |
|---|---|
| `unitExists` | Any unit ID not present in `WorldState.units` |
| `unitBelongsToDepartment` | Fire bidding an ambulance |
| `singleCommitment` | A unit assigned to two incidents without a declared preemption |
| `preemptionIsDeclared` | Pulling a committed unit without naming the incident and reason |

Each gets a test asserting a valid proposal passes and a crafted invalid one is rejected with
world state unchanged. Four predicates, eight tests. This is the whole test suite and it is
deliberately small — it covers the one boundary where a bug is invisible on stage but fatal
to the claim.

### The event bus

`core/bus.ts` distinguishes two kinds of listener, and conflating them is a real bug that is
easy to ship:

- **Subscribers** run agent logic and may mutate state through the reducer.
- **Broadcasters** are observers — the WebSocket fan-out, the recorder, the baseline shadow
  dispatcher's stats collector. They never write.

A throwing subscriber must not prevent other subscribers from running, and must not prevent
broadcasters from seeing the event. Every handler is wrapped; a throw is logged and the
dispatch continues. Without this, one bad agent handler silently freezes the dashboard, and
the failure looks like a hung UI rather than a caught exception.

### Control plane

`transport/rest.ts` exposes the simulation's controls as HTTP, separately from the WebSocket
state stream:

```
POST /api/simulation/start
POST /api/simulation/pause
POST /api/simulation/reset
POST /api/simulation/inject      { kind, lat, lng, severity, description }
POST /api/simulation/fallback    { forced: boolean }     kill-switch
GET  /api/health                 provider, model, tick, fallback counter
```

The same Express instance serves the basemap, so the browser reaches nothing but this
backend:

```
GET  /tiles/mumbai.pmtiles       range requests (HTTP 206) — MapLibre reads it in slices
GET  /map-assets/fonts/...       glyph ranges
GET  /map-assets/sprites/...     icon atlas
```

`/map-assets`, not `/assets`: `assets` is Vite's own default build output directory, so the
two collide the moment a production bundle is served from this origin. The dev proxy must
list `/map-assets` explicitly — when it does not, Vite answers glyph requests with
`index.html` and MapLibre reports the protobuf parse failure `Unimplemented type: 4`, which
names neither the real cause nor the missing route.

Which glyph ranges to vendor is decided by measurement, not by guessing: decode the tiles in
our own extract, read only the properties the style's `text-field` expressions consume, and
take the codepoints those contain. Mumbai needs Arabic and Devanagari for the features with
no `name:en`, and general punctuation for the curly apostrophe in names like *A.I.'s Allana
Boys High School*. It does not need the `name:ko` and `name:zh` tags that ship in the same
tiles, because a `lang: 'en'` style never draws them. A missing range is not an error — the
label silently disappears — so nothing but measurement catches it.

The hotkeys in Phase 4 and the judge sandbox in Phase 5 both call these endpoints. They do
not reach into simulator internals, which means neither can break the sim in a way the REST
surface cannot also produce — one code path to rehearse instead of three.

### Record and replay

`recorder.ts` writes every broadcast event to `recordings/<name>.json` as
`{ offsetMs, event }` pairs. `replayer.ts` reads one back and pushes each event to
**broadcasters only**, bypassing subscribers entirely, so nothing re-runs the agent layer.

This is a demo-reliability mechanism distinct from the fallback engine, and the distinction
matters. The fallback engine keeps the demo *running* with templated rationales. A replay of
a recorded golden run shows the *actual LLM reasoning* from a healthy run — real agent prose,
real timings, real preemption — with no API dependency at all. If the venue network is dead
before we even start, replay is a better story than fallback.

---

## Phases

### Phase 0 — Skeleton

Scaffold pnpm workspace, `shared/` types, Express + ws bootstrap, Vite app. `core/bus.ts`
with the subscriber/broadcaster split and per-handler error isolation. MapLibre renders
Mumbai from local `.pmtiles`. Static units painted at station coordinates. WebSocket echoes a
heartbeat and the client renders it.

The bus lands here rather than later because every subsequent phase attaches to it. Retrofit
the subscriber/broadcaster distinction in Phase 2 and the recorder ends up wired as a
subscriber, which is exactly the bug the split exists to prevent.

**Done when:** map loads with zero network access, 11 static markers are visible, and a
deliberately throwing test handler does not stop other handlers from running.

Verify the marker criterion in a real browser, not over HTTP. Every asset can return 200 and
the map still be wrong: the check that matters is `queryRenderedFeatures` against the
`units-dot` layer, because it counts what is actually on screen rather than what is in the
source. That distinction is what caught the framing defect below — the source held all 11
units while only 10 were drawn.

**Status:** scaffold, bus, config, world store, clock, tile pipeline and dashboard shell are
built and verified. `pnpm typecheck` clean, `bus.test.ts` 6/6, `/api/health` reporting 11
units with the clock advancing, pmtiles serving range requests, and a headless load showing
no page errors, no failed requests and no glyph warnings. Two exit criteria met; the marker
criterion is not, per the open item below.

### Phase 1 — Working simulator, no LLM

The whole system, driven by `fallback.ts`.

- `WorldState` + reducer + `invariants.ts` + 500 ms tick loop with 6× compression
- Vehicle movement along baked paths, ETA computation, arrival, resolution
- Coverage ratio computed on every award and revoke
- `ingestEvent()` seam and the scripted scenario driver
- Rule-based dispatcher emitting real `CnpMessage`s, including preemption
- `transport/rest.ts` control plane
- All four panels live: map, activity, resources, feed, stats
- Baseline shadow dispatcher

The REST control plane lands here, not in Phase 4 alongside the hotkeys. Building it now
means the scripted scenario driver, the hotkeys, and the judge sandbox all drive the sim
through one surface that has been exercised since the first working run.

**Done when:** a full scripted run completes unattended, at least one reroute is visible on
the map, the stats bar shows a real coordinated-vs-baseline delta, and **the four invariant
tests pass**. The last one is a hard exit criterion, not a nice-to-have: Phase 2 hands
decision authority to a model, and these tests are what makes that safe.

At the end of this phase the project is demo-ready. Everything after is upgrade.

### Phase 2 — LLM agents

- `LLMProvider` interface, factory, Anthropic implementation, one alternate implementation
  to prove the abstraction holds
- Triage / bid / award prompts
- Zod schemas per response type, semantic validation, one retry with error fed back
- Automatic fallback to Phase 1 logic on second failure
- Parallel bid collection so latency is `max(bids)` not `sum(bids)`
- Source badge on each activity row (`llm` / `fallback`) and the `Fallback: N/M` counter
- `recorder.ts` capturing a golden run

The recorder lands here because this is the first phase that produces something worth
recording — real agent reasoning. Record a clean run at the end of the phase and keep the
file; Phase 4 turns it into a rehearsal and fallback-of-last-resort asset.

**Done when:** a run completes on live LLM decisions with the counter reading `0/N`, pulling
the network mid-run degrades to fallback without visible interruption and the counter climbs
visibly, and `recordings/golden-run.json` replays.

### Phase 3 — Dashboard polish

Dark/neon map restyle. Incident pulse animation keyed to severity. Vehicle chevrons with
heading. Route arcs, with the revoke→reassign transition given a distinct visual treatment
since it is the demo's centrepiece. Panel typography sized for projector legibility.
Activity rows animate in.

Also in this phase, because they are visual-design work rather than a separate concern:

- The accessibility floor from `productSpec.md` §14 — non-colour severity and department
  encoding, `aria-live` activity feed, type and contrast floors, `prefers-reduced-motion`
- The simulation-only disclaimer footer from §17
- Collaboration graph rows showing real measured timings

On timings: if a value is not actually measured, it does not get displayed. A hardcoded
`0.0` latency rendered as a metric is worse than no metric, because it invites a question
whose honest answer is "that number is fake."

**Done when:** readable from the back of a room, the reroute moment is unmistakable, and
every number on screen traces to a measurement.

### Phase 4 — Demo hardening

- Hotkeys: `1`–`6` spawn incident by type at cursor, `M` mass-casualty escalation,
  `Space` pause, `R` reset — each bound to the Phase 1 REST endpoints, no direct sim access
- Manual kill-switch forcing fallback mode
- `REPLAY_MODE=recordings/golden-run.json` boot path for rehearsal and for a dead-network
  venue
- Full offline verification with wifi disabled
- Bundle grep confirming no API key reaches the client
- Timed rehearsal against `productSpec.md` §12
- Cold-start check: clone, install, run, on a second machine

Rehearse in `REPLAY_MODE`. It burns no tokens, runs identically every time, and lets the
narration be timed against fixed beats — then the live run on stage has the same shape.

**Done when:** three consecutive clean timed runs under 2:30.

### Phase 5 — Judge sandbox (only if time remains)

Click-to-place incidents on the map, severity picker, straight-line pathing for ad-hoc
routes. Enters through `ingestEvent()`, so no agent-layer changes.

---

## Configuration

`.env.example`:

```
LLM_PROVIDER=anthropic          # anthropic | openai | ...
LLM_API_KEY=
LLM_MODEL=claude-opus-5
SIM_TIME_SCALE=6
CITY=mumbai
PORT=8787
REPLAY_MODE=                    # path to a recording; empty = live agents
```

The key is read in `server/src/config.ts` and never leaves the server process. `web/` has no
access path to it. Verify with a bundle grep in Phase 4.

---

## Risk register

| Risk | Mitigation |
|---|---|
| LLM latency stalls the sim | Auctions run async off the tick loop; bids collected in parallel; deadline forces fallback |
| Venue network fails | Local tiles, local scenario, fallback engine — demo runs fully offline |
| LLM emits invalid units | Reducer is the only mutator and validates every proposal |
| Demo run varies between rehearsal and stage | Scripted timeline with fixed timestamps |
| Judge asks "why not an optimiser?" | Baseline dispatcher ships measured numbers; decentralisation argument in spec §6 |
| Reroute doesn't fire during the run | Scenario authored so the single Rescue unit is committed when the collapse lands; verified every rehearsal |
| Map too busy to read | Scale capped at 11 units / ~14 incidents |
| Network dead before the demo even starts | `REPLAY_MODE` boots from a recorded golden run — real agent reasoning, no API |
| Degrading to fallback without noticing | Source badge per row plus a persistent `Fallback: N/M` counter |
| A throwing agent handler freezes the dashboard | Bus isolates handlers; broadcasters run regardless of subscriber failure |

---

## Open items

- **Resolved Phase 0 map framing/extract defect (2026-08-07).** `bbox` remains the
  incident operating area; `mapBbox` now owns the wider basemap extract and camera
  bounds. Initial zoom is 13.0. The regenerated extract serves a 72.79–72.90 /
  18.95–19.05 extent; at 1600 × 950 the headless check renders all 11 units,
  6 stations, 1,406 basemap features, and zero glyph warnings. The widened glyph
  scan found only the already-excluded PGF private-use ranges in addition to the
  supported ranges.
- Whether the initial view should be a fixed zoom at all, or `fitBounds` on the operating
  area. Fixed zoom clips differently on every projector aspect ratio; `fitBounds` cannot, but
  it letterboxes, because the Byculla–Dadar corridor is portrait and the panel is landscape
- Second LLM provider implementation: which one, decided at Phase 2 start
- Whether Police traffic units get distinct visual treatment from patrol units
- Recording format versioning if the event shape changes after the golden run is captured
