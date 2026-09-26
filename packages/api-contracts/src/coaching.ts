/**
 * Qori AI Coach API Contract — Coach M1
 *
 * Public contract for AI Coach advisory runs.
 * Coach runs analyze artifacts (Brief, Plan) and provide structured feedback.
 * Runs are bound to specific artifact versions — historical runs are immutable.
 *
 * Conventions:
 * - Resource types use public IDs (UUID), never internal integer IDs
 * - Requester identity uses public_id + display_name
 * - Token/cost telemetry is NOT exposed in public API
 * - Internal worker metadata is NOT exposed
 */

import type {
  CoachRunStatus,
  CoachReviewScope,
  CoachItemCategory,
  CoachContextRole,
  CoachFailureCode,
} from './enums';

// Re-export for convenience
export type {
  CoachRunStatus,
  CoachReviewScope,
  CoachItemCategory,
  CoachContextRole,
  CoachFailureCode,
};

// ─── Requester Identity ───────────────────────────────────────────────

/**
 * Minimal actor info for display in coaching runs.
 * Uses public_id only — never expose internal integer IDs.
 */
export interface CoachRunRequesterSummary {
  readonly public_id: string;
  readonly display_name: string | null;
}

// ─── Reference Resource ───────────────────────────────────────────────

/**
 * A reference from a coaching item to a Qori entity.
 */
export interface CoachRunReferenceResource {
  readonly id: string;
  readonly item_id: string;
  readonly object_type: string;
  readonly object_id: string;
  readonly section_key: string | null;
  readonly label: string;
}

// ─── Item Resource ────────────────────────────────────────────────────

/**
 * A single coaching item (strength, issue, suggestion, or question).
 */
export interface CoachRunItemResource {
  readonly id: string;
  readonly run_id: string;
  readonly category: CoachItemCategory;
  readonly position: number;
  readonly text: string;
  readonly references: CoachRunReferenceResource[];
}

// ─── Context Entry Resource ───────────────────────────────────────────

/**
 * An entry in the run's context manifest.
 */
export interface CoachRunContextEntryResource {
  readonly id: string;
  readonly run_id: string;
  readonly object_type: string;
  readonly object_id: string;
  readonly object_version: number | null;
  readonly section_key: string | null;
  readonly context_role: CoachContextRole;
  readonly position: number;
}

// ─── Run Summary Resource ─────────────────────────────────────────────

/**
 * Minimal coaching run info for list views.
 * Does NOT include items, references, or context manifest.
 */
export interface CoachRunSummaryResource {
  readonly id: string;
  readonly artifact_public_id: string;
  readonly artifact_type: string;
  readonly content_version: number;
  readonly selected_section_key: string | null;
  readonly review_scope: CoachReviewScope;
  readonly status: CoachRunStatus;
  readonly requested_by: CoachRunRequesterSummary;
  readonly requested_at: string; // ISO 8601
  readonly completed_at: string | null; // ISO 8601
  readonly failed_at: string | null; // ISO 8601
  /** True if this run is for the current artifact version */
  readonly is_current_version: boolean;
  /** ID of the run this was a retry of (null if original) */
  readonly retry_of_run_id: string | null;
}

// ─── Run Detail Resource ──────────────────────────────────────────────

/**
 * Full coaching run details including items and context.
 */
export interface CoachRunDetailResource extends CoachRunSummaryResource {
  /** Provenance: coaching contract version */
  readonly coaching_contract_version: string;
  /** Provenance: prompt template version */
  readonly prompt_template_version: string;
  /** Provenance: model used (e.g., claude-sonnet-4-20250514) */
  readonly model: string;
  /** Items grouped by category, sorted by position */
  readonly items: CoachRunItemResource[];
  /** Context manifest (what the coach "saw") */
  readonly context: CoachRunContextEntryResource[];
  /** Failure info (only present if status === 'failed') */
  readonly failure?: {
    readonly code: CoachFailureCode;
    /** Sanitized user-facing message — no raw provider details */
    readonly message: string;
  };
}

// ─── Request Inputs ───────────────────────────────────────────────────

/**
 * Create a new coaching run request.
 */
export interface CreateCoachRunInput {
  /** Artifact to coach (by public_id) */
  readonly artifact_public_id: string;
  /** Review scope: entire artifact or single section */
  readonly review_scope: CoachReviewScope;
  /** Section key (required if review_scope === 'section') */
  readonly section_key?: string;
}

/**
 * Create a researcher retry of a failed/completed run.
 * Creates a NEW run with new provenance, linked via retry_of_run_id.
 */
export interface RetryCoachRunInput {
  /** Original run to retry (by run ID) */
  readonly original_run_id: string;
}

// ─── Query Inputs ─────────────────────────────────────────────────────

/**
 * Query parameters for listing coaching runs.
 */
export interface CoachRunListQuery {
  /** Filter by artifact public_id */
  readonly artifact_public_id?: string;
  /** Filter by artifact content_version */
  readonly content_version?: number;
  /** Filter by status */
  readonly status?: CoachRunStatus;
  /** Filter by review scope */
  readonly review_scope?: CoachReviewScope;
  /** Filter by section key */
  readonly section_key?: string;
  /** Cursor for pagination */
  readonly cursor?: string;
  /** Max results (default 20, max 100) */
  readonly limit?: number;
}

// ─── Response Envelopes ───────────────────────────────────────────────

/**
 * List coaching runs response.
 */
export interface CoachRunListResponse {
  readonly artifact_public_id: string;
  readonly runs: CoachRunSummaryResource[];
  readonly cursor: string | null;
  readonly has_more: boolean;
}

/**
 * Get coaching run detail response.
 */
export interface CoachRunDetailResponse {
  readonly run: CoachRunDetailResource;
}

/**
 * Create coaching run response.
 */
export interface CreateCoachRunResponse {
  readonly run: CoachRunSummaryResource;
}

/**
 * Retry coaching run response.
 */
export interface RetryCoachRunResponse {
  readonly run: CoachRunSummaryResource;
  /** ID of the original run that was retried */
  readonly original_run_id: string;
}
