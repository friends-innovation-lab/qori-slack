/**
 * Insights Mutation Hooks — DR-4b + DR-4d
 *
 * React Query mutation hooks for Desk Research Insights operations.
 *
 * DR-4d: Updated to use project public ID (string) for consistency
 * with discovery API patterns.
 *
 * DESIGN DECISIONS:
 * - NO optimistic updates for review actions (accept/reject/withdraw)
 *   per DR-4b requirement to wait for backend confirmation
 * - Invalidation after success ensures cache consistency
 * - Non-idempotent mutations do NOT auto-retry
 * - Typed errors preserve 403/409 for UI handling
 *
 * CACHE ISOLATION: Insights mutations ONLY affect Insights caches.
 * Discovery artifact queries are never invalidated by Insights mutations.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { insightsKeys } from './keys';
import { createInsight, createRevision, submitReview } from './client';
import { parseInsightError, type InsightApiError } from './types';
import type {
  CreateInsightRequest,
  CreateRevisionRequest,
  CreateReviewRequest,
  InsightDetail,
  ReviewAction,
  EvidenceReference,
} from '@qori/api-contracts';

// ─── Create Insight ─────────────────────────────────────────────────────────

export interface CreateInsightInput {
  projectId: string;
  wording: string;
  evidenceReferences: EvidenceReference[];
  origin?: 'ai' | 'researcher';
  discoveryRunId?: number;
}

/**
 * Create a new insight with initial revision.
 *
 * On success:
 * - Invalidates project insights list
 * - Invalidates project needs-review count
 *
 * No optimistic updates — waits for server confirmation.
 */
export function useCreateInsight() {
  const queryClient = useQueryClient();

  return useMutation<InsightDetail, InsightApiError, CreateInsightInput>({
    mutationFn: async (input) => {
      try {
        const request: CreateInsightRequest = {
          wording: input.wording,
          evidenceReferences: input.evidenceReferences,
          origin: input.origin,
          discoveryRunId: input.discoveryRunId,
        };
        const response = await createInsight(input.projectId, request);
        return response.data;
      } catch (error) {
        throw await parseInsightError(error);
      }
    },

    onSuccess: (_data, input) => {
      // Invalidate all project insights queries (all filter combinations)
      queryClient.invalidateQueries({
        queryKey: insightsKeys.project(input.projectId),
      });
    },

    // No automatic retry for non-idempotent mutations
    retry: false,
  });
}

// ─── Create Revision ────────────────────────────────────────────────────────

export interface CreateRevisionInput {
  projectId: string;
  insightPublicId: string;
  wording: string;
  evidenceReferences: EvidenceReference[];
  expectedVersion: number;
}

/**
 * Create a new revision for an existing insight.
 *
 * Requires expectedVersion for optimistic concurrency control.
 * Throws CONCURRENCY_ERROR (409) if version mismatch.
 *
 * On success:
 * - Invalidates project insights list (filters may change)
 * - Invalidates insight detail
 * - Invalidates revision history
 * - Invalidates project needs-review count
 *
 * No optimistic updates — waits for server confirmation.
 */
export function useCreateRevision() {
  const queryClient = useQueryClient();

  return useMutation<InsightDetail, InsightApiError, CreateRevisionInput>({
    mutationFn: async (input) => {
      try {
        const request: CreateRevisionRequest = {
          wording: input.wording,
          evidenceReferences: input.evidenceReferences,
          expectedVersion: input.expectedVersion,
        };
        const response = await createRevision(
          input.projectId,
          input.insightPublicId,
          request,
        );
        return response.data;
      } catch (error) {
        throw await parseInsightError(error);
      }
    },

    onSuccess: (_data, input) => {
      // Invalidate all project-scoped queries
      queryClient.invalidateQueries({
        queryKey: insightsKeys.project(input.projectId),
      });
    },

    // No automatic retry — concurrency errors require user decision
    retry: false,
  });
}

// ─── Review Insight ─────────────────────────────────────────────────────────

export interface ReviewInsightInput {
  projectId: string;
  insightPublicId: string;
  action: ReviewAction;
  revisionId?: number;
  comment?: string;
  expectedVersion: number;
}

/**
 * Submit a review action (accept/reject/withdraw).
 *
 * Requires expectedVersion for optimistic concurrency control.
 * Throws CONCURRENCY_ERROR (409) if version mismatch.
 *
 * Withdraw requires comment per SPEC-2 D6.
 *
 * On success:
 * - Invalidates project insights list
 * - Invalidates insight detail
 * - Invalidates revision history
 * - Invalidates review history
 * - Invalidates project needs-review count
 *
 * NO optimistic updates per DR-4b requirement:
 * "Do not optimistically mark an insight accepted before backend confirmation."
 */
export function useReviewInsight() {
  const queryClient = useQueryClient();

  return useMutation<InsightDetail, InsightApiError, ReviewInsightInput>({
    mutationFn: async (input) => {
      try {
        const request: CreateReviewRequest = {
          action: input.action,
          revisionId: input.revisionId,
          comment: input.comment,
          expectedVersion: input.expectedVersion,
        };
        const response = await submitReview(
          input.projectId,
          input.insightPublicId,
          request,
        );
        return response.data;
      } catch (error) {
        throw await parseInsightError(error);
      }
    },

    onSuccess: (_data, input) => {
      // Invalidate all project-scoped queries
      // This ensures:
      // - List reflects new status
      // - Detail shows updated accepted revision
      // - Review history includes new action
      // - Needs-review count is updated
      queryClient.invalidateQueries({
        queryKey: insightsKeys.project(input.projectId),
      });
    },

    // No automatic retry — concurrency errors require user decision
    retry: false,
  });
}
