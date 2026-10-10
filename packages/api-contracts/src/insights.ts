/**
 * Qori Desk Research Insights API Contracts — DR-4a
 *
 * Types for desk research insight management.
 * Mirrors backend/src/services/desk-insight.service.ts.
 *
 * Per SPEC-2 design authority:
 * - Insights are project-scoped (D1)
 * - Researchers and above may self-accept (D2)
 * - Save and Accept are separate (D3)
 * - Withdrawal reason required (D6)
 * - Display IDs use IN-0001 format (D7)
 * - Protect sources cited by accepted revisions (D9)
 */

// ─── Evidence Reference ──────────────────────────────────────────────

/**
 * Evidence locator within a source document.
 * Supports source-level attribution when precise locators unavailable.
 */
export interface EvidenceLocator {
  /** Page number or range */
  page?: string;

  /** Section heading or identifier */
  section?: string;

  /** Verbatim excerpt from source */
  excerpt?: string;

  /** True when linked to source as a whole (no precise locator) */
  sourceLevel?: boolean;

  /** Explanation when precise locator unavailable */
  attributionLimitation?: string;

  /** AI-extracted context for traceability */
  aiExtractedContext?: string;
}

/**
 * Reference to evidence supporting an insight revision.
 */
export interface EvidenceReference {
  /** Evidence source ID */
  evidenceSourceId: number;

  /** Source label for display */
  sourceLabel?: string;

  /** Locator within source */
  locator: EvidenceLocator;

  /** Validation status */
  validation?: 'verified' | 'ai_unverified' | 'researcher_provided';
}

// ─── Revision ────────────────────────────────────────────────────────

/** Origin of a revision */
export type RevisionOrigin = 'ai' | 'researcher';

/**
 * Revision content structure.
 */
export interface RevisionContent {
  /** Insight wording (required) */
  wording: string;
}

/**
 * Detail view of a single revision.
 */
export interface RevisionDetail {
  /** Internal ID */
  id: number;

  /** Public UUID */
  publicId: string;

  /** Revision number (1-based) */
  revisionNumber: number;

  /** Revision content */
  content: RevisionContent;

  /** Evidence snapshot at revision time */
  evidenceSnapshot: EvidenceReference[];

  /** Origin of this revision */
  origin: RevisionOrigin;

  /** Creator identity */
  createdBy: string;

  /** Creation timestamp */
  createdAt: string;

  /** Whether this revision is currently accepted */
  isAccepted: boolean;

  /** Whether this is the latest revision */
  isLatest: boolean;
}

// ─── Review ──────────────────────────────────────────────────────────

/** Review action type */
export type ReviewAction = 'accept' | 'reject' | 'withdraw';

/**
 * Review record from history.
 */
export interface ReviewRecord {
  /** Internal ID */
  id: number;

  /** Action taken */
  action: ReviewAction;

  /** Revision ID (if applicable) */
  revisionId: number | null;

  /** Reviewer identity */
  reviewedBy: string;

  /** Optional comment (required for withdraw per D6) */
  comment: string | null;

  /** Review timestamp */
  createdAt: string;
}

// ─── Insight Status ──────────────────────────────────────────────────

/**
 * UI-facing insight status.
 * Derived from revision and review state.
 */
export type InsightStatus =
  | 'proposed'              // No accepted revision; latest is proposed
  | 'accepted'              // Accepted revision exists; latest = accepted
  | 'accepted_with_pending' // Accepted exists; latest > accepted and proposed
  | 'rejected'              // Never accepted; latest decision rejected
  | 'withdrawn';            // Withdrawal decision exists

// ─── Insight Summary ─────────────────────────────────────────────────

/**
 * Summary view of an insight for list display.
 */
export interface InsightSummary {
  /** Internal ID */
  id: number;

  /** Public UUID */
  publicId: string;

  /** Display ID (IN-0001 format per D7) */
  displayId: string;

  /** Project ID */
  projectId: number;

  /** Latest revision wording */
  wording: string;

  /** Derived status */
  status: InsightStatus;

  /** Latest revision number */
  latestRevisionNumber: number;

  /** Accepted revision number (null if never accepted) */
  acceptedRevisionNumber: number | null;

  /** Pending revision number (null if no pending) */
  pendingRevisionNumber: number | null;

  /** Origin of latest revision */
  origin: RevisionOrigin;

  /** True if needs review (proposed and not accepted) */
  needsReview: boolean;

  /** Creator identity */
  createdBy: string;

  /** Creation timestamp */
  createdAt: string;

  /** Withdrawal timestamp (if withdrawn) */
  withdrawnAt: string | null;

  /** Version for optimistic concurrency */
  version: number;
}

// ─── Insight Detail ──────────────────────────────────────────────────

/**
 * Full detail view of an insight.
 */
export interface InsightDetail extends InsightSummary {
  /** Latest revision detail */
  latestRevision: RevisionDetail;

  /** Accepted revision detail (null if never accepted) */
  acceptedRevision: RevisionDetail | null;

  /** Total revision count */
  revisionCount: number;
}

// ─── List Filters ────────────────────────────────────────────────────

/**
 * Filter options for insights list.
 */
export interface InsightListFilters {
  /** Status filter */
  status?: 'proposed' | 'accepted' | 'rejected' | 'withdrawn' | 'all';

  /** Filter by evidence source ID */
  sourceId?: number;

  /** Maximum results (default 50, max 100) */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

// ─── API Responses ───────────────────────────────────────────────────

/**
 * Response for GET /api/v1/projects/:projectId/insights
 */
export interface InsightsListResponse {
  data: InsightSummary[];
  meta: {
    total: number;
    needsReviewCount: number;
    limit: number;
    offset: number;
  };
}

/**
 * Response for GET /api/v1/projects/:projectId/insights/:insightId
 */
export interface InsightDetailResponse {
  data: InsightDetail;
}

/**
 * Response for GET /api/v1/projects/:projectId/insights/needs-review-count
 */
export interface NeedsReviewCountResponse {
  data: {
    count: number;
  };
}

/**
 * Response for GET /api/v1/projects/:projectId/insights/:insightId/revisions
 */
export interface RevisionsListResponse {
  data: RevisionDetail[];
}

/**
 * Response for GET /api/v1/projects/:projectId/insights/:insightId/reviews
 */
export interface ReviewsListResponse {
  data: ReviewRecord[];
}

/**
 * Response for GET /api/v1/projects/:projectId/insights/source-protection/:sourceId
 */
export interface SourceProtectionResponse {
  data: {
    sourceId: number;
    isCitedByAcceptedRevision: boolean;
    protected: boolean;
  };
}

// ─── API Requests ────────────────────────────────────────────────────

/**
 * Request body for POST /api/v1/projects/:projectId/insights
 */
export interface CreateInsightRequest {
  /** Insight wording (required) */
  wording: string;

  /** Evidence references (at least one required) */
  evidenceReferences: EvidenceReference[];

  /** Origin (default: 'researcher') */
  origin?: RevisionOrigin;

  /** Discovery run ID (for AI-generated insights) */
  discoveryRunId?: number;
}

/**
 * Request body for POST /api/v1/projects/:projectId/insights/:insightId/revisions
 */
export interface CreateRevisionRequest {
  /** New wording (required) */
  wording: string;

  /** Evidence references (at least one required) */
  evidenceReferences: EvidenceReference[];

  /** Expected version for optimistic concurrency */
  expectedVersion: number;
}

/**
 * Request body for POST /api/v1/projects/:projectId/insights/:insightId/reviews
 */
export interface CreateReviewRequest {
  /** Review action */
  action: ReviewAction;

  /** Revision ID (required for accept/reject) */
  revisionId?: number;

  /** Comment (required for withdraw per D6, optional for others) */
  comment?: string;

  /** Expected version for optimistic concurrency */
  expectedVersion: number;
}

// ─── API Errors ──────────────────────────────────────────────────────

/**
 * Error codes returned by the insights API.
 */
export type InsightErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'AUTHORIZATION_ERROR'
  | 'PROJECT_ACCESS_ERROR'
  | 'CONCURRENCY_ERROR';

/**
 * Standard error response shape.
 */
export interface InsightErrorResponse {
  error: {
    code: InsightErrorCode;
    message: string;
    /** Current version (only for CONCURRENCY_ERROR / 409) */
    currentVersion?: number;
  };
}
