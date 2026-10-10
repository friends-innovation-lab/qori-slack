/**
 * Insights Query Keys — DR-4b
 *
 * Stable query key factory for Desk Research Insights cache management.
 * Keys are project-scoped per SPEC-2 D1 decision.
 *
 * sourceId filtering reflects latest-revision evidence, not necessarily
 * accepted-revision evidence. See DR-4a verification for details.
 */

import type { InsightListFilters } from '@qori/api-contracts';

/**
 * Normalized filters for cache key consistency.
 * Undefined values are normalized to prevent duplicate cache entries.
 */
export interface NormalizedInsightFilters {
  status: 'proposed' | 'accepted' | 'rejected' | 'withdrawn' | 'all';
  sourceId?: number;
  limit: number;
  offset: number;
}

/**
 * Normalize filters for consistent cache keys.
 * Default values match backend defaults.
 */
function normalizeFilters(filters: InsightListFilters): NormalizedInsightFilters {
  return {
    status: filters.status ?? 'all',
    sourceId: filters.sourceId,
    limit: filters.limit ?? 50,
    offset: filters.offset ?? 0,
  };
}

/**
 * Query key factory for Insights.
 *
 * Structure:
 * - ['insights'] — root for all insights data
 * - ['insights', 'project', projectId] — all data for a project
 * - ['insights', 'project', projectId, 'list', { status, sourceId, limit, offset }] — filtered list
 * - ['insights', 'project', projectId, 'detail', insightPublicId] — single insight detail
 * - ['insights', 'project', projectId, 'detail', insightPublicId, 'revisions'] — revision history
 * - ['insights', 'project', projectId, 'detail', insightPublicId, 'reviews'] — review history
 * - ['insights', 'project', projectId, 'needs-review-count'] — count for badge display
 *
 * DR-4d: projectId is now a string (public ID) for consistency with discovery API.
 */
export const insightsKeys = {
  /** Root key for all insights queries */
  all: ['insights'] as const,

  /** All data for a specific project */
  project: (projectId: string) =>
    ['insights', 'project', projectId] as const,

  /** Filtered list for a project. Filters are normalized for cache consistency. */
  list: (projectId: string, filters: InsightListFilters = {}) =>
    [
      'insights',
      'project',
      projectId,
      'list',
      normalizeFilters(filters),
    ] as const,

  /** Single insight detail */
  detail: (projectId: string, insightPublicId: string) =>
    ['insights', 'project', projectId, 'detail', insightPublicId] as const,

  /** Revision history for an insight */
  revisions: (projectId: string, insightPublicId: string) =>
    ['insights', 'project', projectId, 'detail', insightPublicId, 'revisions'] as const,

  /** Review history for an insight */
  reviews: (projectId: string, insightPublicId: string) =>
    ['insights', 'project', projectId, 'detail', insightPublicId, 'reviews'] as const,

  /** Needs review count for project badge */
  needsReviewCount: (projectId: string) =>
    ['insights', 'project', projectId, 'needs-review-count'] as const,
};
