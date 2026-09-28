/**
 * Coaching API Client — Coach M3A
 *
 * Typed API client functions for AI Coach advisory runs.
 * Uses public contract types from @qori/api-contracts.
 */

import { api } from '@/api/client';
import type {
  CoachRunStatus,
  CoachReviewScope,
  CoachRunListResponse,
  CoachRunDetailResponse,
  CreateCoachRunResponse,
} from '@qori/api-contracts';

// ─── List Coaching Runs ─────────────────────────────────────────────────────

export interface ListCoachRunsParams {
  artifactPublicId: string;
  status?: CoachRunStatus;
  reviewScope?: CoachReviewScope;
  sectionKey?: string;
  limit?: number;
}

/**
 * GET /api/v1/artifacts/:artifactPublicId/coaching
 *
 * Lists coaching runs for an artifact with optional filtering.
 */
export async function listCoachRuns(
  params: ListCoachRunsParams,
): Promise<CoachRunListResponse> {
  const searchParams = new URLSearchParams();

  if (params.status) {
    searchParams.set('status', params.status);
  }
  if (params.reviewScope) {
    searchParams.set('review_scope', params.reviewScope);
  }
  if (params.sectionKey) {
    searchParams.set('section_key', params.sectionKey);
  }
  if (params.limit) {
    searchParams.set('limit', String(params.limit));
  }

  const queryString = searchParams.toString();
  const url = `artifacts/${params.artifactPublicId}/coaching${queryString ? `?${queryString}` : ''}`;

  const res = await api.get(url).json<{ data: CoachRunListResponse }>();
  return res.data;
}

// ─── Create Coaching Run ────────────────────────────────────────────────────

export interface CreateCoachRunParams {
  artifactPublicId: string;
  reviewScope: CoachReviewScope;
  /** M3B: Required when reviewScope === 'section' */
  sectionKey?: string;
}

/**
 * POST /api/v1/artifacts/:artifactPublicId/coaching
 *
 * Creates a new coaching run (artifact-level or section-level).
 * Returns immediately with pending run (does NOT wait for AI generation).
 */
export async function createCoachRun(
  params: CreateCoachRunParams,
): Promise<CreateCoachRunResponse> {
  const body: { review_scope: CoachReviewScope; section_key?: string } = {
    review_scope: params.reviewScope,
  };

  // M3B: Include section_key for section-scoped reviews
  if (params.reviewScope === 'section' && params.sectionKey) {
    body.section_key = params.sectionKey;
  }

  const res = await api
    .post(`artifacts/${params.artifactPublicId}/coaching`, {
      json: body,
    })
    .json<{ data: CreateCoachRunResponse }>();
  return res.data;
}

// ─── Get Coaching Run Detail ────────────────────────────────────────────────

/**
 * GET /api/v1/coaching/runs/:runId
 *
 * Retrieves a single coaching run with full details.
 */
export async function getCoachRun(runId: string): Promise<CoachRunDetailResponse> {
  const res = await api.get(`coaching/runs/${runId}`).json<{ data: CoachRunDetailResponse }>();
  return res.data;
}
