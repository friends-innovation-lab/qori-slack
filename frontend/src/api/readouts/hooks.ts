/**
 * Readouts Query Hooks — DR-6b-4b
 *
 * TanStack Query hooks for Desk Research Readouts.
 * Uses DR-6b-4a API client and key factory.
 *
 * Design decisions:
 * - HTTP 409/422 are thrown as typed errors for explicit UI handling
 * - All mutations have retry: false to prevent accidental duplicates
 * - No optimistic updates — cache updates only after server confirmation
 * - Query cancellation via AbortSignal where supported
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { readoutsKeys } from './keys';
import {
  listReadouts,
  getReadout,
  createReadout,
  saveDraft,
  checkEligibility,
  approveReadout,
  getApprovalHistory,
  getGenerationHistory,
  getEligibleEvidence,
} from './client';
import {
  parseReadoutError,
  isConcurrencyError,
  isApprovalIneligibleError,
} from './errors';
import type {
  PaginationParams,
  CreateReadoutRequest,
  SaveDraftRequest,
  ApproveReadoutRequest,
} from './types';

// ═══════════════════════════════════════════════════════════════════════════
// QUERY HOOKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch paginated list of readouts for a study.
 */
export function useReadoutsList(
  projectPublicId: string,
  studyPublicId: string,
  params?: PaginationParams,
) {
  return useQuery({
    queryKey: readoutsKeys.list(projectPublicId, studyPublicId, params),
    queryFn: () => listReadouts(projectPublicId, studyPublicId, params),
    enabled: !!projectPublicId && !!studyPublicId,
    staleTime: 30_000, // 30 seconds
  });
}

/**
 * Fetch single readout with draft content.
 */
export function useReadoutDetail(
  projectPublicId: string,
  studyPublicId: string,
  readoutPublicId: string,
) {
  return useQuery({
    queryKey: readoutsKeys.detail(projectPublicId, studyPublicId, readoutPublicId),
    queryFn: () => getReadout(projectPublicId, studyPublicId, readoutPublicId),
    enabled: !!projectPublicId && !!studyPublicId && !!readoutPublicId,
    staleTime: 60_000, // 1 minute
  });
}

/**
 * Check approval eligibility for a readout.
 *
 * Note: staleTime: 0 ensures fresh check, but this alone is NOT an approval
 * guarantee. UI should explicitly refetch before approval attempts.
 */
export function useApprovalEligibility(
  projectPublicId: string,
  studyPublicId: string,
  readoutPublicId: string,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: readoutsKeys.eligibility(projectPublicId, studyPublicId, readoutPublicId),
    queryFn: () => checkEligibility(projectPublicId, studyPublicId, readoutPublicId),
    enabled:
      (options?.enabled ?? true) &&
      !!projectPublicId &&
      !!studyPublicId &&
      !!readoutPublicId,
    staleTime: 0, // Always fresh — depends on current draft state
  });
}

/**
 * Fetch approval history for a readout.
 */
export function useApprovalHistory(
  projectPublicId: string,
  studyPublicId: string,
  readoutPublicId: string,
) {
  return useQuery({
    queryKey: readoutsKeys.approvals(projectPublicId, studyPublicId, readoutPublicId),
    queryFn: () => getApprovalHistory(projectPublicId, studyPublicId, readoutPublicId),
    enabled: !!projectPublicId && !!studyPublicId && !!readoutPublicId,
    staleTime: 60_000, // 1 minute — immutable once created
  });
}

/**
 * Fetch generation history for a readout.
 *
 * Returns only backend data. Never fabricates generation status.
 */
export function useGenerationHistory(
  projectPublicId: string,
  studyPublicId: string,
  readoutPublicId: string,
) {
  return useQuery({
    queryKey: readoutsKeys.versions(projectPublicId, studyPublicId, readoutPublicId),
    queryFn: () => getGenerationHistory(projectPublicId, studyPublicId, readoutPublicId),
    enabled: !!projectPublicId && !!studyPublicId && !!readoutPublicId,
    staleTime: 30_000, // 30 seconds — may update during generation
  });
}

/**
 * Fetch eligible evidence (accepted insights) for citation.
 */
export function useEligibleEvidence(
  projectPublicId: string,
  studyPublicId: string,
  readoutPublicId: string,
  params?: PaginationParams,
) {
  return useQuery({
    queryKey: readoutsKeys.eligibleEvidence(
      projectPublicId,
      studyPublicId,
      readoutPublicId,
      params,
    ),
    queryFn: () =>
      getEligibleEvidence(projectPublicId, studyPublicId, readoutPublicId, params),
    enabled: !!projectPublicId && !!studyPublicId && !!readoutPublicId,
    staleTime: 60_000, // 1 minute
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// MUTATION HOOKS
// ═══════════════════════════════════════════════════════════════════════════

interface ReadoutMutationContext {
  projectPublicId: string;
  studyPublicId: string;
}

interface ReadoutDetailMutationContext extends ReadoutMutationContext {
  readoutPublicId: string;
}

/**
 * Create a new readout.
 *
 * On success: invalidates study readout lists.
 */
export function useCreateReadout(context: ReadoutMutationContext) {
  const queryClient = useQueryClient();
  const { projectPublicId, studyPublicId } = context;

  return useMutation({
    mutationFn: (request: CreateReadoutRequest) =>
      createReadout(projectPublicId, studyPublicId, request),
    retry: false,
    onSuccess: () => {
      // Invalidate all list queries for this study
      queryClient.invalidateQueries({
        queryKey: readoutsKeys.scope(projectPublicId, studyPublicId),
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.includes('list');
        },
      });
    },
  });
}

/**
 * Save draft content with optimistic concurrency.
 *
 * On success: invalidates readout detail and eligibility.
 * On HTTP 409: throws ConcurrencyConflictError with currentVersion and submittedContent.
 *
 * IMPORTANT: Never optimistically overwrites draft content.
 * UI is responsible for recovery using error.submittedContent.
 */
export function useSaveDraft(context: ReadoutDetailMutationContext) {
  const queryClient = useQueryClient();
  const { projectPublicId, studyPublicId, readoutPublicId } = context;

  return useMutation({
    mutationFn: async (request: SaveDraftRequest) => {
      try {
        return await saveDraft(projectPublicId, studyPublicId, readoutPublicId, request);
      } catch (err) {
        // Parse and rethrow typed error for UI handling
        const parsed = await parseReadoutError(err);
        if (isConcurrencyError(parsed)) {
          // Throw typed error — UI can access currentVersion and submittedContent
          throw parsed;
        }
        // Rethrow other errors with parsed details
        throw parsed;
      }
    },
    retry: false, // No automatic retries — user controls recovery
    onSuccess: () => {
      // Invalidate detail to refresh contentVersion
      queryClient.invalidateQueries({
        queryKey: readoutsKeys.detail(projectPublicId, studyPublicId, readoutPublicId),
      });
      // Invalidate eligibility — draft changes may affect approval status
      queryClient.invalidateQueries({
        queryKey: readoutsKeys.eligibility(
          projectPublicId,
          studyPublicId,
          readoutPublicId,
        ),
      });
    },
    // onError: intentionally omitted — do NOT invalidate on failure
  });
}

/**
 * Approve a readout with optimistic concurrency.
 *
 * On success: invalidates detail, eligibility, approvals, and study lists.
 * On HTTP 422: throws ApprovalIneligibleError with errors[] array.
 *
 * CRITICAL: retry: false prevents accidental duplicate approvals.
 */
export function useApproveReadout(context: ReadoutDetailMutationContext) {
  const queryClient = useQueryClient();
  const { projectPublicId, studyPublicId, readoutPublicId } = context;

  return useMutation({
    mutationFn: async (request: ApproveReadoutRequest) => {
      try {
        return await approveReadout(
          projectPublicId,
          studyPublicId,
          readoutPublicId,
          request,
        );
      } catch (err) {
        // Parse and rethrow typed error for UI handling
        const parsed = await parseReadoutError(err);
        if (isApprovalIneligibleError(parsed)) {
          // Throw typed error — UI can access errors[] array
          throw parsed;
        }
        // Rethrow other errors with parsed details
        throw parsed;
      }
    },
    retry: false, // CRITICAL: No automatic approval retries
    onSuccess: () => {
      // Invalidate detail — approvedAt, approvedVersion updated
      queryClient.invalidateQueries({
        queryKey: readoutsKeys.detail(projectPublicId, studyPublicId, readoutPublicId),
      });
      // Invalidate eligibility — approval changes eligibility state
      queryClient.invalidateQueries({
        queryKey: readoutsKeys.eligibility(
          projectPublicId,
          studyPublicId,
          readoutPublicId,
        ),
      });
      // Invalidate approval history — new approval added
      queryClient.invalidateQueries({
        queryKey: readoutsKeys.approvals(
          projectPublicId,
          studyPublicId,
          readoutPublicId,
        ),
      });
      // Invalidate study lists — approvedAt/approvedVersion visible in list
      queryClient.invalidateQueries({
        queryKey: readoutsKeys.scope(projectPublicId, studyPublicId),
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.includes('list');
        },
      });
    },
    // onError: intentionally omitted — do NOT invalidate on failure
  });
}
