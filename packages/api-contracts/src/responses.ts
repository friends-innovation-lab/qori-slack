/**
 * Qori API Response Types — stable contract boundary.
 *
 * All resource representations use public_id (UUID), never internal integer IDs.
 * Mirrors backend/src/types/api-responses.ts — this package is the source of truth.
 */

import type {
  BriefStatus,
  ProjectStatus,
  WorkflowStatus,
  PublicationStatus,
  QueueItemKind,
  LifecycleNodeState,
  ResearchMethodology,
} from './enums';

// ─── Response envelope ──────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  cursor?: string;
  limit: number;
  total?: number;
  hasMore: boolean;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
}

// ─── Actor / Organization ───────────────────────────────────────────

export interface ActorResource {
  public_id: string;
  display_name: string | null;
  organization_public_id: string;
}

export interface OrganizationResource {
  public_id: string;
  slug: string;
  name: string;
}

// ─── Me ─────────────────────────────────────────────────────────────

export interface MeResource {
  actor: ActorResource;
  organization: OrganizationResource;
  authentication_provider: string;
  memberships: ProjectMembership[];
}

export interface ProjectMembership {
  project_public_id: string;
  project_name: string;
  role: string;
}

// ─── Session ────────────────────────────────────────────────────────

export interface SessionStatus {
  authenticated: boolean;
  actor_public_id?: string;
  organization_public_id?: string;
  authenticated_at?: string;
}

// ─── Project ────────────────────────────────────────────────────────

export interface ProjectResource {
  public_id: string;
  slug: string;
  name: string;
  description: string | null;
  problem_statement: string | null;
  status: ProjectStatus;
  organization_public_id: string;
  team_public_id: string | null;
  created_at: string;
}

// ─── Study ──────────────────────────────────────────────────────────

export interface StudyResource {
  public_id: string;
  name: string;
  status: string;
  brief_status: BriefStatus | null;
  project_public_id: string;
  created_at: string;
}

/** Structured objective with stable ID */
export interface BriefObjective {
  id: string;
  objective: string;
}

/** Structured research question with stable ID and priority */
export interface BriefQuestion {
  id: string;
  question: string;
  priority?: string | null;
}

/** Structured barrier with stable ID and source */
export interface BriefBarrier {
  id: string;
  barrier: string;
  source?: string | null;
}

/** Participant segment for the Participants table */
export interface ParticipantSegment {
  segment: string;
  count: number | string;
  rationale: string;
}

/** Discovery source for provenance */
export interface DiscoverySource {
  prefix: string;
  source: string;
  type: string;
  findings: string;
}

/** Risk for the Risks table */
export interface BriefRisk {
  risk: string;
  source: string;
  mitigation: string;
}

export interface StudyBriefResource {
  study: StudyResource;
  brief_status: BriefStatus | null;
  brief_approved_at: string | null;
  brief_approved_by: string | null;
  brief_change_feedback: string | null;
  brief_reviewer_display_name: string | null;
  brief_url: string | null;
  /** Artifact version for optimistic concurrency */
  artifact_version?: number;
  /** Artifact public ID for linking */
  artifact_public_id?: string | null;
  /** Artifact metadata for Document Information section */
  artifact_metadata?: {
    created_at: string | null;
    template_id: string | null;
    template_version: string | null;
    path: string | null;
  };
  /** Cascade variables available from the brief (raw JSON strings) */
  cascade_fields: {
    research_objectives: string | null;
    research_questions: string | null;
    target_barriers: string | null;
    methodology_selection: string | null;
    timeline_preference: string | null;
    timeline_phases: string | null;
    start_date: string | null;
    decision_deadline: string | null;
    decision_deadline_context: string | null;
    participant_approach: string | null;
    participant_segments: string | null;
    recruitment_sources: string | null;
    session_format: string | null;
    session_duration: string | null;
    budget: string | null;
    budget_purpose: string | null;
    requestor_name: string | null;
    discovery_sources: string | null;
  };
  /** Structured arrays parsed from cascade_fields */
  structured_fields?: {
    research_objectives: BriefObjective[];
    research_questions: BriefQuestion[];
    target_barriers: BriefBarrier[];
    participant_segments: ParticipantSegment[];
    discovery_sources: DiscoverySource[];
  };
  /** AI-generated prose sections from artifact_sections table */
  prose_sections?: Record<string, string | null>;
  /** Study metadata for masthead */
  study_metadata?: {
    study_name: string;
    researcher_name: string | null;
    requestor_name: string | null;
    created_by_name: string | null;
    study_path: string | null;
    created_at: string | null;
  };
}

export interface StudyPlanResource {
  study: StudyResource;
  plan_url: string | null;
  plan_created_at: string | null;
  /** Artifact version for optimistic concurrency */
  artifact_version?: number;
  /** Artifact public ID for linking */
  artifact_public_id?: string | null;
  /** Artifact metadata for Document Information section */
  artifact_metadata?: {
    created_at: string | null;
    template_id: string | null;
    template_version: string | null;
    path: string | null;
    model: string | null;
  };
  /** Cascade variables inherited from Brief (raw JSON strings) */
  inherited_context: {
    research_objectives: string | null;
    research_questions: string | null;
    target_barriers: string | null;
    methodology_selection: string | null;
    timeline_phases: string | null;
    participant_approach: string | null;
    session_format: string | null;
    session_duration: string | null;
    compensation: string | null;
    deliverables: string | null;
    budget: string | null;
  };
  /** Structured arrays parsed from inherited_context */
  structured_fields?: {
    research_objectives: BriefObjective[];
    research_questions: BriefQuestion[];
    target_barriers: BriefBarrier[];
  };
  /** AI-generated prose sections from artifact_sections table */
  prose_sections?: Record<string, string | null>;
  /** Study metadata for masthead */
  study_metadata?: {
    study_name: string;
    researcher_name: string | null;
    study_path: string | null;
    created_at: string | null;
  };
}

export interface CascadeReadiness {
  ready: boolean;
  missing: Array<{
    variable: string;
    human_label: string;
    resolution_hint: string;
  }>;
}

// ─── Artifact ───────────────────────────────────────────────────────

export interface ArtifactResource {
  public_id: string;
  artifact_type: string;
  title: string | null;
  workflow_status: WorkflowStatus;
  publication_status: PublicationStatus;
  template_id: string;
  template_version: string;
  project_public_id: string;
  study_public_id: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Discovery ──────────────────────────────────────────────────────

export interface DiscoveryArtifactResource {
  type: string;
  slug: string;
  label: string;
  created_at: string;
}

// ─── Home ───────────────────────────────────────────────────────────

export interface HomeResource {
  greeting_name: string;
  queue_preview: QueueItemResource[];
  active_studies: ActiveStudyResource[];
  recent_activity: ActivityEvent[];
}

export interface ActiveStudyResource {
  public_id: string;
  name: string;
  project_name: string;
  project_public_id: string;
  status: string;
  brief_status: BriefStatus | null;
  next_action: string | null;
  next_action_route: string | null;
  updated_at: string;
}

export interface ActivityEvent {
  id: string;
  description: string;
  study_public_id: string | null;
  study_name: string | null;
  created_at: string;
}

// ─── Queue ──────────────────────────────────────────────────────────

export interface QueueItemResource {
  id: string;
  kind: QueueItemKind;
  statement: string;
  study_public_id: string | null;
  study_name: string | null;
  action_label: string;
  action_route: string;
  created_at: string;
  age_category: 'fresh' | 'aging' | 'overdue';
}

// ─── Lifecycle ──────────────────────────────────────────────────────

export interface LifecycleNode {
  stage: string;
  label: string;
  state: LifecycleNodeState;
  unlock_hint: string | null;
  count: number;
  is_current: boolean;
}

// ─── Branding ───────────────────────────────────────────────────────

export interface BrandingResource {
  organization_name: string;
  organization_short_name: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  theme_tokens: {
    brand?: string;
    brand_ink?: string;
    link?: string;
    focus?: string;
    surface_selected?: string;
  };
}
