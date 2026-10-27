/**
 * Contract Net Protocol (Smith, 1980; later FIPA-standardised).
 *
 * These five messages are the entire agent vocabulary. Every row in the Agent
 * Activity panel is one of them rendered in English — the panel is built off
 * this stream directly, so there is no parallel logging format that can drift
 * away from what the agents actually did.
 */

import type { Department, DecisionSource } from './world.js';

/** A unit being pulled off a live call, with the reason it is justified. */
export interface Preemption {
  unitId: string;
  fromIncidentId: string;
  justification: string;
}

export type CnpMessage =
  | {
      t: 'ANNOUNCE';
      incidentId: string;
      departments: Department[];
      priority: number;
      /** Bids arriving after this are ignored; forces progress under latency. */
      deadlineMs: number;
    }
  | {
      t: 'BID';
      incidentId: string;
      department: Department;
      unitIds: string[];
      etaSeconds: number;
      /** 0-1, the department's own confidence in the offer. */
      confidence: number;
      rationale: string;
      preempts?: Preemption[];
    }
  | {
      t: 'NO_BID';
      incidentId: string;
      department: Department;
      reason: string;
    }
  | {
      t: 'AWARD';
      incidentId: string;
      department: Department;
      unitIds: string[];
      rationale: string;
    }
  | {
      t: 'REVOKE';
      incidentId: string;
      unitIds: string[];
      reason: string;
    };

export type CnpVerb = CnpMessage['t'];

/** Who is speaking. Departments speak as themselves. */
export type AgentId = 'COORDINATOR' | Department;

/**
 * One protocol message plus the provenance the dashboard needs.
 *
 * `latencyMs` is measured, not estimated. If a decision path did not time
 * itself, this is null and the UI shows nothing rather than a zero.
 */
export interface ActivityEntry {
  id: string;
  atSimMs: number;
  agent: AgentId;
  source: DecisionSource;
  latencyMs: number | null;
  message: CnpMessage;
}
