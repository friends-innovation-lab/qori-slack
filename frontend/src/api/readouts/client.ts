/**
 * Readouts API Client — DR-6b-4a
 *
 * Low-level API functions for Desk Research Readouts.
 * Uses existing ky client instance from @/api/client.
 *
 * All nine endpoints from DR-6b-3:
 * - POST /readouts (create)
 * - GET /readouts (list)
 * - GET /readouts/:id (get single)
 * - PATCH /readouts/:id/draft (save draft)
 * - GET /readouts/:id/eligibility (check approval eligibility)
 * - POST /readouts/:id/approve (approve)
 * - GET /readouts/:id/approvals (approval history)
 * - GET /readouts/:id/versions (generation history)
 * - GET /readouts/:id/evidence-eligibility (eligible evidence)
 */

import { api } from '@/api/client';
import type {
  PaginationParams,
  CreateReadoutRequest,
  SaveDraftRequest,
  ApproveReadoutRequest,
  ReadoutListResponse,
  ReadoutDetailResponse,
  ReadoutCreateResponse,
  SaveDraftResponse,
  ApprovalEligibilityResponse,
  ApproveResponse,
  ApprovalHistoryResponse,
  GenerationHistoryResponse,
  EligibleEvidenceResponse,
  InitiateGenerationRequest,
  InitiateGenerationResponse,
  GenerationStatusResponse,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════
// BASE PATH BUILDER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build readouts endpoint path.
 * Matches backend route: /api/v1/projects/:projectId/studies/:studyId/readouts
 */
function readoutsPath(
  projectId: string,
  studyId: string,
  readoutId?: string,
  suffix?: string,
): string {
  const base = `projects/${projectId}/studies/${studyId}/readouts`;
  if (!readoutId) return base;
  return suffix ? `${base}/${readoutId}/${suffix}` : `${base}/${readoutId}`;
}

/**
 * Build URLSearchParams from pagination params.
 */
function buildPaginationParams(params?: PaginationParams): URLSearchParams {
  const searchParams = new URLSearchParams();
  if (params?.limit !== undefined) {
    searchParams.set('limit', String(params.limit));
  }
  if (params?.offset !== undefined) {
    searchParams.set('offset', String(params.offset));
  }
  return searchParams;
}

// ═══════════════════════════════════════════════════════════════════════════
// LIST READOUTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /projects/:projectId/studies/:studyId/readouts
 *
 * List readouts for a study with pagination.
 */
export async function listReadouts(
  projectId: string,
  studyId: string,
  params?: PaginationParams,
): Promise<ReadoutListResponse> {
  const searchParams = buildPaginationParams(params);

  return api
    .get(readoutsPath(projectId, studyId), {
      searchParams: searchParams.toString() ? searchParams : undefined,
    })
    .json<ReadoutListResponse>();
}

// ═══════════════════════════════════════════════════════════════════════════
// GET SINGLE READOUT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /projects/:projectId/studies/:studyId/readouts/:readoutId
 *
 * Retrieve a single readout with its draft.
 */
export async function getReadout(
  projectId: string,
  studyId: string,
  readoutId: string,
): Promise<ReadoutDetailResponse> {
  return api
    .get(readoutsPath(projectId, studyId, readoutId))
    .json<ReadoutDetailResponse>();
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE READOUT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /projects/:projectId/studies/:studyId/readouts
 *
 * Create a new readout for a study.
 * Returns the created readout with empty draft.
 */
export async function createReadout(
  projectId: string,
  studyId: string,
  request: CreateReadoutRequest,
): Promise<ReadoutCreateResponse> {
  return api
    .post(readoutsPath(projectId, studyId), { json: request })
    .json<ReadoutCreateResponse>();
}

// ═══════════════════════════════════════════════════════════════════════════
// SAVE DRAFT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * PATCH /projects/:projectId/studies/:studyId/readouts/:readoutId/draft
 *
 * Save draft with optimistic concurrency.
 * Returns 409 on version conflict with submitted content for recovery.
 */
export async function saveDraft(
  projectId: string,
  studyId: string,
  readoutId: string,
  request: SaveDraftRequest,
): Promise<SaveDraftResponse> {
  return api
    .patch(readoutsPath(projectId, studyId, readoutId, 'draft'), {
      json: request,
    })
    .json<SaveDraftResponse>();
}

// ═══════════════════════════════════════════════════════════════════════════
// APPROVAL ELIGIBILITY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /projects/:projectId/studies/:studyId/readouts/:readoutId/eligibility
 *
 * Check if readout is eligible for approval.
 */
export async function checkEligibility(
  projectId: string,
  studyId: string,
  readoutId: string,
): Promise<ApprovalEligibilityResponse> {
  return api
    .get(readoutsPath(projectId, studyId, readoutId, 'eligibility'))
    .json<ApprovalEligibilityResponse>();
}

// ═══════════════════════════════════════════════════════════════════════════
// APPROVE READOUT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /projects/:projectId/studies/:studyId/readouts/:readoutId/approve
 *
 * Approve readout with optimistic concurrency.
 * Creates immutable approval snapshot.
 * Returns 422 if not eligible.
 */
export async function approveReadout(
  projectId: string,
  studyId: string,
  readoutId: string,
  request: ApproveReadoutRequest,
): Promise<ApproveResponse> {
  return api
    .post(readoutsPath(projectId, studyId, readoutId, 'approve'), {
      json: request,
    })
    .json<ApproveResponse>();
}

// ═══════════════════════════════════════════════════════════════════════════
// APPROVAL HISTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /projects/:projectId/studies/:studyId/readouts/:readoutId/approvals
 *
 * Retrieve approval history for a readout.
 */
export async function getApprovalHistory(
  projectId: string,
  studyId: string,
  readoutId: string,
): Promise<ApprovalHistoryResponse> {
  return api
    .get(readoutsPath(projectId, studyId, readoutId, 'approvals'))
    .json<ApprovalHistoryResponse>();
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERATION HISTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /projects/:projectId/studies/:studyId/readouts/:readoutId/versions
 *
 * Retrieve generation history for a readout.
 */
export async function getGenerationHistory(
  projectId: string,
  studyId: string,
  readoutId: string,
): Promise<GenerationHistoryResponse> {
  return api
    .get(readoutsPath(projectId, studyId, readoutId, 'versions'))
    .json<GenerationHistoryResponse>();
}

// ═══════════════════════════════════════════════════════════════════════════
// ELIGIBLE EVIDENCE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /projects/:projectId/studies/:studyId/readouts/:readoutId/evidence-eligibility
 *
 * Retrieve eligible evidence (accepted, non-withdrawn insights) for citation.
 * Evidence is project-scoped but accessed through the readout endpoint.
 */
export async function getEligibleEvidence(
  projectId: string,
  studyId: string,
  readoutId: string,
  params?: PaginationParams,
): Promise<EligibleEvidenceResponse> {
  const searchParams = buildPaginationParams(params);

  return api
    .get(readoutsPath(projectId, studyId, readoutId, 'evidence-eligibility'), {
      searchParams: searchParams.toString() ? searchParams : undefined,
    })
    .json<EligibleEvidenceResponse>();
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERATION API (DR-6b-5d-A)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /projects/:projectId/studies/:studyId/readouts/:readoutId/generate
 *
 * Initiate async readout generation. Returns 202 Accepted with pending job.
 *
 * Idempotency:
 * - Same key + same payload → returns existing job (created: false)
 * - Same key + different payload → 409 IDEMPOTENCY_CONFLICT
 *
 * Supersession:
 * - Automatically marks pending/generating jobs as 'superseded'
 *
 * Validation:
 * - All selectedRevisionIds must be accepted, non-withdrawn revisions
 * - Invalid selections → 422 EVIDENCE_SELECTION_ERROR
 */
export async function initiateGeneration(
  projectId: string,
  studyId: string,
  readoutId: string,
  request: InitiateGenerationRequest,
): Promise<InitiateGenerationResponse> {
  return api
    .post(readoutsPath(projectId, studyId, readoutId, 'generate'), {
      json: request,
    })
    .json<InitiateGenerationResponse>();
}

/**
 * GET /projects/:projectId/studies/:studyId/readouts/:readoutId/generate/:generationRequestId
 *
 * Poll generation status. Use TanStack Query's refetchInterval for polling.
 *
 * Terminal states (stop polling): 'completed' | 'failed' | 'superseded'
 * Active states (continue polling): 'pending' | 'generating'
 */
export async function getGenerationStatus(
  projectId: string,
  studyId: string,
  readoutId: string,
  generationRequestId: string,
): Promise<GenerationStatusResponse> {
  return api
    .get(
      readoutsPath(
        projectId,
        studyId,
        readoutId,
        `generate/${generationRequestId}`,
      ),
    )
    .json<GenerationStatusResponse>();
}
