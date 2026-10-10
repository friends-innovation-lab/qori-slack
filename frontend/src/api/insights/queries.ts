/**
 * Insights Query Hooks — DR-4b
 *
 * React Query hooks for Desk Research Insights queries.
 * Project-scoped per SPEC-2 D1 decision.
 */

import { useQuery } from '@tanstack/react-query';
import { insightsKeys } from './keys';
import {
  fetchInsights,
  fetchInsight,
  fetchInsightRevisions,
  fetchInsightReviews,
  fetchNeedsReviewCount,
} from './client';
import type { InsightListFilters } from '@qori/api-contracts';

/**
 * Fetch paginated insights list for a project.
 *
 * Note: sourceId filtering reflects latest-revision evidence,
 * not necessarily accepted-revision evidence.
 *
 * @param projectId - Project ID
 * @param filters - Optional filters (status, sourceId, limit, offset)
 */
export function useInsights(projectId: number, filters: InsightListFilters = {}) {
  return useQuery({
    queryKey: insightsKeys.list(projectId, filters),
    queryFn: () => fetchInsights(projectId, filters),
    enabled: projectId > 0,
  });
}

/**
 * Fetch a single insight detail by public ID.
 *
 * @param projectId - Project ID
 * @param insightPublicId - Insight public UUID
 */
export function useInsight(projectId: number, insightPublicId: string) {
  return useQuery({
    queryKey: insightsKeys.detail(projectId, insightPublicId),
    queryFn: async () => {
      const response = await fetchInsight(projectId, insightPublicId);
      return response.data;
    },
    enabled: projectId > 0 && !!insightPublicId,
  });
}

/**
 * Fetch revision history for an insight.
 *
 * @param projectId - Project ID
 * @param insightPublicId - Insight public UUID
 */
export function useInsightRevisions(projectId: number, insightPublicId: string) {
  return useQuery({
    queryKey: insightsKeys.revisions(projectId, insightPublicId),
    queryFn: async () => {
      const response = await fetchInsightRevisions(projectId, insightPublicId);
      return response.data;
    },
    enabled: projectId > 0 && !!insightPublicId,
  });
}

/**
 * Fetch review history for an insight.
 *
 * @param projectId - Project ID
 * @param insightPublicId - Insight public UUID
 */
export function useInsightReviews(projectId: number, insightPublicId: string) {
  return useQuery({
    queryKey: insightsKeys.reviews(projectId, insightPublicId),
    queryFn: async () => {
      const response = await fetchInsightReviews(projectId, insightPublicId);
      return response.data;
    },
    enabled: projectId > 0 && !!insightPublicId,
  });
}

/**
 * Fetch needs-review count for a project.
 * Used for badge display in navigation.
 *
 * @param projectId - Project ID
 */
export function useNeedsReviewCount(projectId: number) {
  return useQuery({
    queryKey: insightsKeys.needsReviewCount(projectId),
    queryFn: async () => {
      const response = await fetchNeedsReviewCount(projectId);
      return response.data.count;
    },
    enabled: projectId > 0,
  });
}
