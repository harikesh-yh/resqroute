/**
 * The world model. Both sides of the wire agree on these shapes.
 *
 * Only `server/src/world/reducer.ts` is permitted to produce a new WorldState.
 * Everything else — agents, the LLM, the scenario driver — emits proposals.
 */

export type Department = 'FIRE' | 'MEDICAL' | 'POLICE';

export type Severity = 1 | 2 | 3 | 4 | 5;

export type IncidentKind =
  | 'FIRE'
  | 'ACCIDENT'
  | 'FLOOD'
  | 'COLLAPSE'
  | 'MEDICAL'
  | 'ROAD_BLOCK';

export type UnitType =
  | 'ENGINE'
  | 'LADDER'
  | 'RESCUE'
  | 'AMBULANCE'
  | 'MCI'
  | 'PATROL'
  | 'TRAFFIC';

export type UnitStatus = 'AVAILABLE' | 'EN_ROUTE' | 'ON_SCENE' | 'RETURNING';

export type IncidentStatus =
  | 'REPORTED'
  | 'TRIAGED'
  | 'ASSIGNED'
  | 'ON_SCENE'
  | 'RESOLVED';

/** Which engine produced a decision. Rendered as a badge; never inferred. */
export type DecisionSource = 'llm' | 'fallback';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Place extends LatLng {
  label: string;
}

export const DEPARTMENTS: readonly Department[] = ['FIRE', 'MEDICAL', 'POLICE'];

/** Which department owns which unit types. The reducer enforces this. */
export const UNIT_TYPES_BY_DEPARTMENT: Readonly<Record<Department, readonly UnitType[]>> = {
  FIRE: ['ENGINE', 'LADDER', 'RESCUE'],
  MEDICAL: ['AMBULANCE', 'MCI'],
  POLICE: ['PATROL', 'TRAFFIC'],
};

export interface Triage {
  /** 0-100, assigned by the Coordinator. Deliberately distinct from severity. */
  priority: number;
  requiredUnits: Partial<Record<Department, number>>;
  rationale: string;
  source: DecisionSource;
}

export interface Incident {
  id: string;
  kind: IncidentKind;
  location: Place;
  severity: Severity;
  description: string;
  /** Sim clock, ms since run start. */
  reportedAt: number;
  status: IncidentStatus;
  triage?: Triage;
  assignedUnitIds: string[];
  /** 0-1. Assigned units matching triage.requiredUnits, over units required. */
  coverage: number;
  firstResponseAt?: number;
  resolvedAt?: number;
}

export interface Unit {
  /** "E-01", "AMB-02", "RSQ-1" — stable and human-readable, shown on the map. */
  id: string;
  department: Department;
  type: UnitType;
  stationId: string;
  home: LatLng;
  position: LatLng;
  status: UnitStatus;
  assignedIncidentId?: string;
  /** Baked route geometry from the current position to the destination. */
  path?: LatLng[];
  /** 0-1 along `path`. */
  pathProgress?: number;
  etaSeconds?: number;
  /** Degrees clockwise from north. Drives the chevron rotation. */
  heading?: number;
}

export interface Stats {
  active: number;
  resolved: number;
  /** Sim ms from report to first unit on scene. Null until one resolves. */
  avgFirstResponseMs: number | null;
  /** Same measure, computed by the shadow dispatcher in sim/baseline.ts. */
  baselineAvgFirstResponseMs: number | null;
  /** Denominator of the fallback counter: every agent decision this run. */
  decisions: number;
  /** Numerator. Climbs only when the LLM path actually failed. */
  fallbackDecisions: number;
}

export interface WorldState {
  /** Sim ms since run start. Advances by tick * SIM_TIME_SCALE. */
  simTimeMs: number;
  running: boolean;
  /** True when the operator has forced fallback via the kill-switch. */
  forcedFallback: boolean;
  units: Record<string, Unit>;
  incidents: Record<string, Incident>;
  stats: Stats;
}

export interface Station {
  id: string;
  name: string;
  department: Department;
  position: LatLng;
}

export interface CityConfig {
  id: string;
  name: string;
  /** [west, south, east, north] */
  bbox: [number, number, number, number];
  /** [west, south, east, north]; wider extent for basemap extract and camera bounds. */
  mapBbox: [number, number, number, number];
  center: LatLng;
  zoom: number;
  stations: Station[];
  /** Place names the agents may cite, and the sandbox snaps incidents to. */
  gazetteer: Place[];
}
