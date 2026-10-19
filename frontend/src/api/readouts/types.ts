/**
 * Readout Response Types — DR-6b-4a
 *
 * Matches actual backend JSON shapes from desk-readouts.routes.ts.
 * All Date fields arrive as ISO 8601 strings from JSON serialization.
 *
 * Verified against:
 * - backend/src/routes/api/v1/desk-readouts.routes.ts
 * - backend/src/services/desk-readout.service.ts (mapToReadoutDetail, mapToApprovalDetail)
 * - backend/src/database/models/desk_research_readout_draft.ts (DraftContent)
 */

// ═══════════════════════════════════════════════════════════════════════════
// CITATION TYPES (shared across draft content)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Citation to a pinned insight revision.
 * Matches backend DraftContent citation structure.
 */
export interface Citation {
  constructPublicId: string;
  revisionPublicId: string;
  revisionNumber: number;
  displayId: string; // "IN-0001"
}

// ═══════════════════════════════════════════════════════════════════════════
// DRAFT CONTENT STRUCTURE
// ═══════════════════════════════════════════════════════════════════════════

/** Finding with evidence citations */
export interface Finding {
  id: string;
  text: string;
  citations: Citation[];
}

/** Evidence limitation (no citations required) */
export interface Limitation {
  id: string;
  text: string;
}

/** Implication kind labels per design spec section 3 */
export type ImplicationKind = 'question' | 'gap' | 'priority' | 'hypothesis';

/** Implication for the Research Brief */
export interface Implication {
  id: string;
  kind: ImplicationKind;
  text: string;
  basedOnFindings: string[]; // finding IDs within this document
  basedOnCitations?: Citation[]; // direct insight citations (optional)
}

/** Summary section */
export interface Summary {
  text: string;
  citations?: Citation[];
}

/**
 * Complete draft content structure.
 * Matches backend DraftContent interface in desk_research_readout_draft.ts.
 */
export interface DraftContent {
  summary?: Summary;
  findings?: Finding[];
  limitations?: Limitation[];
  implications?: Implication[];
}

// ═══════════════════════════════════════════════════════════════════════════
// READOUT SUMMARY (list view)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Readout summary for list endpoints.
 * Matches backend mapToReadoutSummary output.
 */
export interface ReadoutSummary {
  id: number;
  publicId: string;
  displayId: string; // "RO-0001"
  studyId: number;
  projectId: number;
  title: string;
  question: string | null;
  approvedAt: string | null; // ISO 8601 or null
  approvedVersion: number | null;
  outOfDateSince: string | null; // ISO 8601 or null
  outOfDateReason: string | null;
  currentGenerationRequestId: string | null;
  createdAt: string; // ISO 8601
  createdByActorId: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// DRAFT DETAIL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Draft detail with content and review state.
 * Matches backend mapToReadoutDetail draft section.
 */
export interface DraftDetail {
  content: DraftContent;
  findingsChecked: string[]; // finding IDs marked as checked
  implicationsReviewed: string[]; // implication IDs marked as reviewed
  contentVersion: number; // for optimistic concurrency
  lastEditedAt: string; // ISO 8601
  lastEditedByActorId: number | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// APPROVAL DETAIL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Evidence snapshot entry for approval records.
 * Matches backend EvidenceSnapshotEntry (desk_research_readout_approval.ts).
 * Note: Does NOT include displayId — only the pinned revision reference.
 */
export interface EvidenceSnapshotEntry {
  constructPublicId: string;
  revisionPublicId: string;
  revisionNumber: number;
}

/**
 * Evidence snapshot structure for approval records.
 * Matches backend EvidenceSnapshot (desk_research_readout_approval.ts).
 */
export interface EvidenceSnapshot {
  cited_constructs: EvidenceSnapshotEntry[];
}

/**
 * Approval record with immutable snapshot.
 * Matches backend mapToApprovalDetail output.
 */
export interface ApprovalDetail {
  id: number;
  approvalNumber: number;
  sourceDraftContentVersion: number;
  approvedAt: string; // ISO 8601
  approvedByActorId: number;
  approvalNote: string | null;
  contentSnapshot: DraftContent;
  findingsCheckedSnapshot: string[];
  implicationsReviewedSnapshot: string[];
  evidenceSnapshot: EvidenceSnapshot;
  supersessionNotes: Record<string, string> | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// READOUT DETAIL (single view)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Full readout detail with draft and latest approval.
 * Matches backend mapToReadoutDetail output.
 */
export interface ReadoutDetail extends ReadoutSummary {
  draft: DraftDetail;
  latestApproval: ApprovalDetail | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERATION VERSION (history)
// ═══════════════════════════════════════════════════════════════════════════

export type GenerationStatus =
  | 'pending'
  | 'generating'
  | 'completed'
  | 'failed'
  | 'superseded';

/**
 * Generation version record.
 * Matches backend DeskResearchReadoutVersion model fields.
 */
export interface GenerationVersion {
  id: number;
  versionNumber: number;
  generationRequestId: string;
  generationStatus: GenerationStatus;
  generationStartedAt: string | null; // ISO 8601
  generationCompletedAt: string | null; // ISO 8601
  generationError: string | null;
  draftContentVersionAtStart: number;
  evidenceSet: Citation[];
  createdAt: string; // ISO 8601
}

// ═══════════════════════════════════════════════════════════════════════════
// APPROVAL ELIGIBILITY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Superseded citation metadata for approval eligibility.
 * Each entry represents a cited revision that has been superseded by a newer accepted revision.
 * Frontend must collect justification notes keyed by revisionPublicId.
 */
export interface SupersededCitation {
  constructPublicId: string;
  revisionPublicId: string;
  revisionNumber: number;
  displayId: string; // "IN-0001"
}

/**
 * Approval eligibility check result.
 * Matches backend checkApprovalEligibility output.
 */
export interface ApprovalEligibility {
  eligible: boolean;
  errors: string[];
  /** Revisions cited in the draft that have been superseded by newer accepted revisions */
  supersededCitations: SupersededCitation[];
}

// ═══════════════════════════════════════════════════════════════════════════
// ELIGIBLE EVIDENCE (for citation)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Source attribution (null-safe per DR-6b-3).
 * Matches backend EligibleInsightSource interface.
 */
export interface EligibleInsightSource {
  sourceId: number;
  sourcePublicId: string;
  sourceType: string;
  label: string;
}

/**
 * Eligible insight with accepted revision for citation.
 * Matches backend EligibleInsight interface.
 */
export interface EligibleInsight {
  constructPublicId: string;
  displayId: string; // "IN-0001"
  wording: string;
  acceptedRevision: {
    revisionPublicId: string;
    revisionNumber: number;
    acceptedAt: string; // ISO 8601
  };
  source: EligibleInsightSource | null; // null-safe attribution
}

// ═══════════════════════════════════════════════════════════════════════════
// API RESPONSES (match routes.ts JSON shapes)
// ═══════════════════════════════════════════════════════════════════════════

export interface ReadoutListResponse {
  data: {
    readouts: ReadoutSummary[];
    total: number;
    limit: number;
    offset: number;
  };
}

export interface ReadoutDetailResponse {
  data: ReadoutDetail;
}

export interface ReadoutCreateResponse {
  data: ReadoutDetail;
}

export interface SaveDraftResponse {
  data: {
    draft: DraftDetail;
    invalidatedFindings: string[];
    invalidatedImplications: string[];
  };
}

export interface ApprovalEligibilityResponse {
  data: ApprovalEligibility;
}

export interface ApproveResponse {
  data: ApprovalDetail;
}

export interface ApprovalHistoryResponse {
  data: {
    approvals: ApprovalDetail[];
  };
}

export interface GenerationHistoryResponse {
  data: {
    versions: GenerationVersion[];
  };
}

export interface EligibleEvidenceResponse {
  data: {
    insights: EligibleInsight[];
    total: number;
    limit: number;
    offset: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface CreateReadoutRequest {
  title: string;
  question?: string;
}

export interface SaveDraftRequest {
  expectedVersion: number;
  content: DraftContent;
  findingsChecked?: string[];
  implicationsReviewed?: string[];
}

export interface ApproveReadoutRequest {
  expectedVersion: number;
  approvalNote?: string;
  supersessionNotes?: Record<string, string>;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
}
