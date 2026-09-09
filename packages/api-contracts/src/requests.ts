/**
 * Qori API Request Types — stable contract boundary.
 */

import type { ResearchMethodology } from './enums';

export interface CreateProjectInput {
  name: string;
  problem_statement: string;
  description?: string;
  approver_actor_public_id?: string;
}

export interface SubmitBriefInput {
  problem_statement: string;
  learning_objectives: string;
  out_of_scope?: string;
  methodology: ResearchMethodology | string;
  method_override?: string;
  participant_approach?: string;
  recruitment_sources?: string;
  start_date?: string;
  decision_deadline?: string;
  budget?: string;
  discovery_selections?: string[];
}

export interface ApproveBriefInput {
  checklist_confirmed: boolean;
}

export interface RequestChangesInput {
  comment: string;
  files_to_update?: string;
  priority?: string;
  deadline?: string;
}

export interface SubmitPlanInput {
  lead_researcher_actor_public_id?: string;
  operational_risks?: string;
}
