# Product Spec — ResQroute Disaster Response Simulator

**Codename:** ResQroute
**Date:** 2026-08-07
**Status:** Design approved, pre-implementation
**Target:** Hackathon demo, Agentic AI track, 2–3 minute live presentation

---

## 1. One-line summary

Four autonomous AI agents — Fire, Medical, Police, and a Central Coordinator — share a
live picture of a city under disaster, bid against each other for scarce emergency
vehicles, and visibly reroute those vehicles mid-journey when something worse happens.

## 2. Problem

During a multi-hazard disaster, emergency dispatch is a scarce-resource allocation problem
under continuous revision. Incidents arrive faster than they resolve, each department owns
its own fleet and capability knowledge, and priorities invert without warning: the truck
already en route to a flooded underpass is the truck you need at a collapsed building.

Human dispatchers handle this with radio traffic and judgement. This project models the
same coordination as a multi-agent system and makes the coordination itself *visible*.

## 3. What we are demonstrating

The primary claim, in the order a judge should perceive it:

1. Multiple autonomous agents maintain **shared situational awareness** over one world state.
2. They **coordinate** through an explicit negotiation protocol, not a hidden central solver.
3. They **prioritise** incidents by severity and consequence.
4. They **dynamically reallocate** committed resources when priorities invert.

Point 4 is the money shot. The demo is built so that point 4 happens on camera, on the map,
with the agent's own reasoning printed alongside it.

## 4. Setting

**City:** Mumbai, India — the Dadar–Byculla–Parel corridor, a north–south strip roughly
5 km across and 7 km tall.

Chosen because it is the only candidate city where all six incident types in scope occur as
*routine* events rather than once-a-decade catastrophes: structural fires, road accidents,
monsoon flooding, building collapse, civilian casualty, and waterlogged/blocked roads.
Dense street network, strong OpenStreetMap coverage, immediately legible skyline of
place names.

The city is a configuration value (`config/city.mumbai.ts`) holding the bounding box,
station coordinates, and place-name gazetteer. Swapping cities is a single-file change.

That the corridor is portrait and every screen is landscape is a real constraint, not a
detail. The area where incidents happen and the area the map must cover are different
shapes, and treating them as one value is what makes markers fall off the top edge of the
screen or leaves the panel half empty.

## 5. Agents

### 5.1 Central Coordinator

**Owns:** incident triage, task announcement, award decisions.
**Does not own:** any vehicle. It cannot dispatch directly; it can only award.

Responsibilities:
- Triage each incoming report into a **priority score (0–100)** and a set of
  **required departments**, with a one-sentence rationale in plain English.
- Announce the task to exactly those departments.
- Collect bids, award to the best combination, and revoke conflicting prior assignments.
- Re-open an auction when an incident escalates or a bid arrives late with a better offer.

### 5.2 Department agents — Fire, Medical, Police

Each owns a private fleet and its own capability rules. Each responds to an announcement
with a bid, a no-bid, or a **preemption bid**.

| Agent | Fleet | Handles |
|---|---|---|
| Fire | Engines, Ladders, Rescue units | Fires, collapses, water rescue, extrication |
| Medical | Ambulances, Mass-casualty rig | Injuries, casualties, triage on scene |
| Police | Patrol units, Traffic units | Road blocks, crowd control, scene perimeter, escort |

A department agent reasons over: distance and ETA, unit capability vs incident type,
what each unit is currently committed to, and whether pulling a committed unit is justified.

**Preemption is the distinguishing behaviour.** A department may bid a unit that is already
en route to another incident, provided it states which incident it is pulling from and why.
The Coordinator decides whether to accept.

## 6. Coordination protocol — Contract Net

Allocation runs as a Contract Net auction (Smith, 1980; later FIPA-standardised). This is a
real, citable decentralised protocol, not an invented one.

```
ANNOUNCE   Coordinator → departments   task available, priority, deadline
BID        department  → Coordinator   units offered, ETA, confidence, rationale
NO_BID     department  → Coordinator   reason for declining
AWARD      Coordinator → department    units committed
REVOKE     Coordinator → department    units pulled from a prior task
```

Every line in the on-screen Agent Activity panel is one of these five messages rendered in
readable English. The protocol *is* the narrative.

**Why agents and not an optimiser.** A judge may ask why this is not an integer program.
The answer the design supports: each department holds private capability knowledge and
private state, no global optimiser is required, departments can be added or removed at
runtime, and the system degrades gracefully when one department is unreachable. We also
ship a baseline (§10) so the claim is measured rather than asserted.

## 7. Incident model

Six types, each carrying **location, severity, and description** as the brief requires.

| Type | Departments typically required |
|---|---|
| `FIRE` | Fire, often Medical, Police for perimeter |
| `ACCIDENT` | Medical, Police, Fire if extrication |
| `FLOOD` | Fire (rescue), Police (road closure) |
| `COLLAPSE` | Fire (rescue), Medical, Police |
| `MEDICAL` | Medical |
| `ROAD_BLOCK` | Police |

Severity is 1–5. Severity is reported; **priority is computed by the Coordinator** and may
differ — a severity-3 fire next to a hospital can outrank a severity-4 fire in open ground.
That gap between reported severity and agent-assigned priority is deliberate and is one of
the things the demo narrates.

Lifecycle: `REPORTED → TRIAGED → ASSIGNED → ON_SCENE → RESOLVED`.

### 7.1 Coverage

An incident is rarely all-or-nothing. The Coordinator's triage states how many units of each
department the incident *requires*; the awards record how many it actually *got*. The ratio
between them is the incident's **coverage**, and it is rendered on the incident card as a
percentage — "Stabilised 40%" — with a partial-fill bar.

```
coverage = |assignedUnitIds matching requiredUnits| / Σ requiredUnits
```

This matters for the demo because scarcity is the point. A row reading "COLLAPSE · Dadar ·
sev 5 · Stabilised 33%" says *we are losing this one* far faster than any log line, and it is
computed from real state rather than narrated.

## 8. Dashboard

Single screen, dark/neon theme, no scrolling, designed to be readable on a projector from
the back of a room.

```
┌──────────────────────────────────────────────┬─────────────────────────┐
│                                              │  AGENT ACTIVITY         │
│                                              │  ─────────────────────  │
│              LIVE MAP                        │  Coordinator: ANNOUNCE  │
│         (MapLibre, Mumbai)                   │  Fire: BID Engine-3     │
│                                              │  Fire: BID preempts...  │
│   incidents pulsing by severity              │  Coordinator: AWARD     │
│   vehicles moving along real roads           │  Coordinator: REVOKE    │
│   routes drawn as neon arcs                  │                         │
│                                              ├─────────────────────────┤
│                                              │  RESOURCES              │
│                                              │  FIRE   ▓▓░░  1/4       │
│                                              │  MED    ▓▓▓░  3/4       │
│                                              │  POLICE ▓░░   1/3       │
├──────────────────────────────────────────────┼─────────────────────────┤
│  STATS                                       │  INCIDENT FEED          │
│  Active 7 · Resolved 12 · Avg resp 4:12      │  newest first, severity │
│  Baseline 7:48 · Fallback 0/23 decisions     │  coded, coverage bar    │
├──────────────────────────────────────────────┴─────────────────────────┤
│  SIMULATION ONLY — not connected to any emergency service              │
└────────────────────────────────────────────────────────────────────────┘
```

**Map** — MapLibre GL with a real Mumbai basemap, restyled dark with neon accents.
Incidents render as pulsing markers sized and coloured by severity. Vehicles render as
department-coloured chevrons moving along real street geometry. Active assignments draw a
route arc from unit to incident. A revoked assignment fades its old arc and draws the new
one — the visual signature of a reroute.

**Agent Activity** — the reasoning feed. Each entry shows the agent, the protocol verb, and
the agent's own one-line rationale. Preemption entries are visually distinct.

**Resources** — per-department availability bars. These go red under load, which is what
makes scarcity felt rather than explained.

**Incident Feed** — incoming reports, newest first, with location, severity, description, and
the coverage bar from §7.1.

**Stats** — active incidents, resolved count, average first-response time, the uncoordinated
baseline for comparison, and the fallback counter from §9.

## 9. Agent intelligence — the validated envelope

There are two failure modes here and the design has to miss both. Give the LLM authority over
everything and a hallucinated unit ID corrupts the world. Give it authority over nothing and
the "agentic" claim is theatre — a rules engine with a narrator bolted on.

The resolution is a **validated envelope**: the envelope is deterministic and non-negotiable;
inside it, the LLM chooses freely and its choices are load-bearing.

**Deterministic — the LLM cannot influence these.** Physics and bookkeeping. Vehicle
positions, path following, ETA arithmetic, arrival and resolution timing, unit existence,
department ownership, and the rule that a unit occupies exactly one assignment. These are
computed by the reducer and hold no matter what any agent emits.

**LLM-decided — and genuinely so.** Judgement calls with no arithmetic answer. What priority
a report deserves given its description. Which departments an ambiguous incident needs.
Whether a slower specialised unit beats a nearer generic one. Whether pulling a committed
unit off a live call is justified, and which call to rob. The rationale text that appears
on screen.

The line is: **the LLM decides what should happen; the reducer decides what is possible.**
When an LLM bid is rejected, it is rejected for violating an invariant, never for
disagreeing with a rule about who *ought* to go.

### 9.1 Provider

Provider is **not hardcoded**: the backend exposes a single `LLMProvider` interface selected
from environment configuration, with Anthropic as the default implementation and others
pluggable. The API key lives in the backend process only and is never bundled into or
reachable from the browser client.

### 9.2 The safety net

Every LLM output is validated before it can touch world state:

1. Schema validation (structure, types, enums).
2. Semantic validation — units must exist, belong to the bidding department, and not be
   double-committed unless a preemption was explicitly declared.
3. On failure: one retry with the validation error fed back.
4. On second failure: the deterministic fallback engine produces the decision instead.

The **fallback engine** is a rule-based dispatcher that emits the *same* protocol messages
with templated rationales. If the network dies mid-demo, the activity feed keeps flowing and
the demo continues. The fallback engine is built first (see BuildPlan Phase 1) so a working
demo exists before any LLM call is made.

**The LLM never mutates state.** It emits proposals. A pure reducer validates and applies
them. This is what makes hallucinated unit IDs a non-event.

### 9.3 Degradation is never silent

A system that quietly falls back to rules while still presenting itself as agent-driven is
lying to its operator, and on a demo stage it is lying to the panel. Two mechanisms prevent
that:

- Every activity row carries a **source badge** — `llm` or `fallback`.
- The stats bar carries a running **`Fallback: N/M decisions`** counter, visible for the
  whole run.

On a healthy run that counter reads `0/23` and is itself a claim worth making. If the venue
network dies, it climbs on screen and we say so out loud. Either outcome is honest, and the
second is a better story than pretending it did not happen.

## 10. Baseline comparison

A shadow dispatcher runs on the identical event stream: nearest available unit, first come
first served, no cross-department coordination, no preemption. Its results are tracked but
never rendered on the map.

The stats bar shows both. This converts "our agents coordinate well" from an assertion into
a measured delta, and it pre-empts the most likely technical challenge from the panel.

## 11. Demo control

**Phase 1 — scripted timeline plus hotkeys.** A scenario file defines the incident sequence
with timestamps, so every run is identical and the narration can be rehearsed against it.
Agents still reason live; only the incoming events are scripted. Hotkeys inject incidents on
demand for pacing control.

**Phase 2 — judge sandbox (only if time remains).** Free-play mode where judges click the
map to place their own incidents. All events, scripted or sandbox, enter through a single
`ingestEvent()` port, so the sandbox requires no changes to the agent layer.

## 12. Demo narrative — 2:30

| Time | Beat |
|---|---|
| 0:00–0:20 | Calm city. Units idle at stations. Establish the map and the four agents. |
| 0:20–0:50 | **One incident, end to end.** Structural fire, Byculla. Narrate ANNOUNCE → BID → AWARD. Judge learns the mechanic on a single clean example. |
| 0:50–1:30 | **Monsoon surge.** Five incidents in thirty seconds. Resource bars go red. Departments start declining. Scarcity becomes visible. |
| 1:30–2:05 | **The reroute.** Severity-5 building collapse, Dadar. The city's only Rescue unit, `RSQ-1`, is committed to a lesser flood call. Fire agent bids a preemption naming it. Coordinator awards. The vehicle turns around on the map and the rationale prints in plain English. |
| 2:05–2:30 | Stats. Coordinated response time against the uncoordinated baseline, and `Fallback: 0/N` — every decision on screen was made by an agent. Close. |

## 13. Scale

Deliberately small so scarcity bites and the map stays readable.

**11 units total.**

| Department | Units | Composition |
|---|---|---|
| Fire | 4 | 2 × Engine, 1 × Ladder, 1 × Rescue |
| Medical | 4 | 3 × Ambulance, 1 × Mass-casualty rig |
| Police | 3 | 2 × Patrol, 1 × Traffic |

- **~14 incidents** in the scripted timeline
- **Sim clock runs 6× real time**, so a 2.5-minute demo covers roughly 15 minutes of city time

Scarcity is a design requirement, not an accident. If every incident can be served
immediately, there is nothing to demonstrate.

Eleven rather than eighteen for three reasons. Eleven chevrons on a 4 km map are individually
trackable from the back of a room; eighteen are a swarm. Scarcity arrives sooner and harder,
so the preemption in §12 is forced by the arithmetic rather than arranged. And exactly one
Rescue unit means the collapse at 1:30 has precisely one right answer, which is what makes
the reroute inevitable instead of lucky.

## 14. Accessibility and legibility floor

This is a projected demo watched from ten metres away by people who did not build it. The
same choices that make it accessible make it legible on stage, so this is not a separate
concern from the visual design — it *is* the visual design.

- **Severity is never encoded by colour alone.** Every severity carries a numeral and a
  distinct marker size; colour is the third channel, not the only one. Roughly 1 in 12 men
  has a colour vision deficiency, and red-on-dark is the exact axis that fails.
- **Department is never encoded by colour alone.** Fire, Medical, and Police units carry
  distinct chevron glyphs as well as distinct hues.
- **The activity feed is an `aria-live="polite"` region.** New protocol messages are
  announced rather than silently appearing.
- **Type floor:** no text below 14 px, panel body text at 16 px, stats numerals at 24 px.
- **Contrast floor:** WCAG AA (4.5:1) for body text against the dark theme. The neon accents
  are decoration and are never the sole carrier of meaning.
- **Motion:** `prefers-reduced-motion` disables the incident pulse and the activity row
  slide-in. Vehicle movement continues, since it is content rather than decoration.

## 15. Success criteria

The build is done when all of the following hold:

1. A full scripted run completes without operator intervention.
2. At least one preemption/reroute occurs on the map during the run, visibly.
3. The activity panel is readable by a non-technical observer with no explanation.
4. Killing network access mid-run does not stop the demo.
5. The stats bar shows a real, computed delta against the baseline dispatcher.
6. The fallback counter is visible throughout and reads `0/N` on a healthy run.
7. Incident coverage percentages are computed from state, not narrated.
8. No API key is present anywhere in the client bundle.
9. Every claim in the README is backed by code that runs — no aspirational features
   described in the past tense.

Criterion 9 exists because the most common failure in this project category is a README that
documents intent rather than behaviour. If a capability is not demonstrable, it does not get
written down as though it were.

## 16. Out of scope

- Real emergency data ingestion or any claim of operational readiness
- Authentication, multi-user, persistence across restarts
- Mobile layout
- Human-in-the-loop dispatcher override
- Anything beyond the six incident types listed

## 17. Simulation-only disclaimer

**This is a simulation. It is not connected to any emergency service, and no part of it is
fit for operational use.**

Every incident is synthetic. Every unit is fictional. The Mumbai basemap is real
OpenStreetMap geometry, but the fire stations, hospitals, and police posts placed on it are
positioned for the demo and do not represent actual facilities or actual response capacity.
Response times shown are properties of the simulation's own physics, not measurements of
Mumbai's emergency services.

This notice is rendered persistently in the dashboard footer, not buried in a README. The
subject matter is real harm to real people, and a system that looks operational while being
a toy owes its audience an unambiguous statement of which one it is.
