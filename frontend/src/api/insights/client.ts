/**
 * Insights API Client — DR-4b + DR-4d
 *
 * Low-level API functions for Desk Research Insights.
 * Uses ky with session credentials and CSRF handling.
 *
 * DR-4d: Updated to use project public ID (string) for consistency
 * with discovery API patterns.
 */

import { api } from '../client';
import type {
  InsightListFilters,
  InsightsListResponse,
  InsightDetailResponse,
  RevisionsListResponse,
  ReviewsListResponse,
  NeedsReviewCountResponse,
  CreateInsightRequest,
  CreateRevisionRequest,
  CreateReviewRequest,
} from '@qori/api-contracts';

// ─── Query Functions ─────────────────────────────────────────────────────────

/**
 * Fetch paginated insights list for a project.
 */
export async function fetchInsights(
  projectId: string,
  filters: InsightListFilters = {},
): Promise<InsightsListResponse> {
  const searchParams = new URLSearchParams();

  if (filters.status && filters.status !== 'all') {
    searchParams.set('status', filters.status);
  }
  if (filters.sourceId !== undefined) {
    searchParams.set('sourceId', String(filters.sourceId));
  }
  if (filters.limit !== undefined) {
    searchParams.set('limit', String(filters.limit));
  }
  if (filters.offset !== undefined) {
    searchParams.set('offset', String(filters.offset));
  }

  const url = searchParams.toString()
    ? `projects/${projectId}/insights?${searchParams}`
    : `projects/${projectId}/insights`;

  return api.get(url).json<InsightsListResponse>();
}

/**
 * Fetch a single insight detail by public ID.
 */
export async function fetchInsight(
  projectId: string,
  insightPublicId: string,
): Promise<InsightDetailResponse> {
  return api
    .get(`projects/${projectId}/insights/${insightPublicId}`)
    .json<InsightDetailResponse>();
}

/**
 * Fetch revision history for an insight.
 */
export async function fetchInsightRevisions(
  projectId: string,
  insightPublicId: string,
): Promise<RevisionsListResponse> {
  return api
    .get(`projects/${projectId}/insights/${insightPublicId}/revisions`)
    .json<RevisionsListResponse>();
}

/**
 * Fetch review history for an insight.
 */
export async function fetchInsightReviews(
  projectId: string,
  insightPublicId: string,
): Promise<ReviewsListResponse> {
  return api
    .get(`projects/${projectId}/insights/${insightPublicId}/reviews`)
    .json<ReviewsListResponse>();
}

/**
 * Fetch needs-review count for a project.
 */
export async function fetchNeedsReviewCount(
  projectId: string,
): Promise<NeedsReviewCountResponse> {
  return api
    .get(`projects/${projectId}/insights/needs-review-count`)
    .json<NeedsReviewCountResponse>();
}

// ─── Mutation Functions ──────────────────────────────────────────────────────

/**
 * Create a new insight with initial revision.
 */
export async function createInsight(
  projectId: string,
  request: CreateInsightRequest,
): Promise<InsightDetailResponse> {
  return api
    .post(`projects/${projectId}/insights`, { json: request })
    .json<InsightDetailResponse>();
}

/**
 * Create a new revision for an existing insight.
 */
export async function createRevision(
  projectId: string,
  insightPublicId: string,
  request: CreateRevisionRequest,
): Promise<InsightDetailResponse> {
  return api
    .post(`projects/${projectId}/insights/${insightPublicId}/revisions`, { json: request })
    .json<InsightDetailResponse>();
}

/**
 * Submit a review action (accept/reject/withdraw).
 */
export async function submitReview(
  projectId: string,
  insightPublicId: string,
  request: CreateReviewRequest,
): Promise<InsightDetailResponse> {
  return api
    .post(`projects/${projectId}/insights/${insightPublicId}/reviews`, { json: request })
    .json<InsightDetailResponse>();
}
