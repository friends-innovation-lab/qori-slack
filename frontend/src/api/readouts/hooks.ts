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
 * - Query cancellation: not currently wired through to the readouts API client
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
  initiateGeneration,
  getGenerationStatus,
} from './client';
import {
  parseReadoutError,
  isConcurrencyError,
  isApprovalIneligibleError,
  isIdempotencyConflictError,
  isEvidenceSelectionError,
} from './errors';
import type {
  PaginationParams,
  CreateReadoutRequest,
  SaveDraftRequest,
  ApproveReadoutRequest,
  InitiateGenerationRequest,
  GenerationStatus,
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

// ═══════════════════════════════════════════════════════════════════════════
// GENERATION HOOKS (DR-6b-5d-A)
// ═══════════════════════════════════════════════════════════════════════════

/** Terminal generation statuses — stop polling when reached */
const TERMINAL_STATUSES: GenerationStatus[] = ['completed', 'failed', 'superseded'];

/**
 * Check if a generation status is terminal (polling should stop).
 */
export function isTerminalGenerationStatus(status: GenerationStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Initiate async readout generation.
 *
 * On success: invalidates generation history and detail.
 * On HTTP 409: throws IdempotencyConflictError (same key, different payload).
 * On HTTP 422: throws EvidenceSelectionError (invalid revision IDs).
 *
 * CRITICAL: retry: false prevents accidental duplicate generation requests.
 */
export function useInitiateGeneration(context: ReadoutDetailMutationContext) {
  const queryClient = useQueryClient();
  const { projectPublicId, studyPublicId, readoutPublicId } = context;

  return useMutation({
    mutationFn: async (request: InitiateGenerationRequest) => {
      try {
        return await initiateGeneration(
          projectPublicId,
          studyPublicId,
          readoutPublicId,
          request,
        );
      } catch (err) {
        // Parse and rethrow typed error for UI handling
        const parsed = await parseReadoutError(err);
        if (isIdempotencyConflictError(parsed)) {
          throw parsed;
        }
        if (isEvidenceSelectionError(parsed)) {
          throw parsed;
        }
        throw parsed;
      }
    },
    retry: false, // CRITICAL: No automatic retries — idempotency key management
    onSuccess: () => {
      // Invalidate generation history — new version created
      queryClient.invalidateQueries({
        queryKey: readoutsKeys.versions(
          projectPublicId,
          studyPublicId,
          readoutPublicId,
        ),
      });
      // Invalidate detail — currentGenerationRequestId updated
      queryClient.invalidateQueries({
        queryKey: readoutsKeys.detail(
          projectPublicId,
          studyPublicId,
          readoutPublicId,
        ),
      });
    },
  });
}

/**
 * Poll generation status with automatic refetch.
 *
 * Polling stops automatically when status reaches terminal state.
 * Use refetchInterval option to customize poll interval (default: 2s).
 *
 * @param generationRequestId - The generation request ID to poll
 * @param options.enabled - Whether to enable the query (default: true when ID provided)
 * @param options.refetchInterval - Poll interval in ms (default: 2000)
 */
export function useGenerationStatus(
  projectPublicId: string,
  studyPublicId: string,
  readoutPublicId: string,
  generationRequestId: string | null,
  options?: {
    enabled?: boolean;
    refetchInterval?: number;
  },
) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: readoutsKeys.generationStatus(
      projectPublicId,
      studyPublicId,
      readoutPublicId,
      generationRequestId ?? '',
    ),
    queryFn: async () => {
      if (!generationRequestId) {
        throw new Error('generationRequestId is required');
      }
      const response = await getGenerationStatus(
        projectPublicId,
        studyPublicId,
        readoutPublicId,
        generationRequestId,
      );

      // When generation completes, invalidate related queries
      if (isTerminalGenerationStatus(response.data.status)) {
        // Invalidate generation history
        queryClient.invalidateQueries({
          queryKey: readoutsKeys.versions(
            projectPublicId,
            studyPublicId,
            readoutPublicId,
          ),
        });
        // Invalidate detail if generation completed (draft may have updated content)
        if (response.data.status === 'completed' && response.data.hasContent) {
          queryClient.invalidateQueries({
            queryKey: readoutsKeys.detail(
              projectPublicId,
              studyPublicId,
              readoutPublicId,
            ),
          });
        }
      }

      return response;
    },
    enabled:
      (options?.enabled ?? true) &&
      !!projectPublicId &&
      !!studyPublicId &&
      !!readoutPublicId &&
      !!generationRequestId,
    staleTime: 0, // Always fresh — status changes frequently
    refetchInterval: (query) => {
      // Stop polling on terminal status
      const status = query.state.data?.data.status;
      if (status && isTerminalGenerationStatus(status)) {
        return false;
      }
      // Continue polling at specified interval
      return options?.refetchInterval ?? 2000;
    },
  });
}
