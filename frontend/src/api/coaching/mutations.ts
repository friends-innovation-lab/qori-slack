/**
 * Coaching Mutation Hooks — Coach M3A
 *
 * React Query mutations for Coaching operations.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { coachingKeys } from './keys';
import { createCoachRun } from './client';
import type { CoachReviewScope, CoachRunSummaryResource } from '@qori/api-contracts';

// ─── Create Coaching Run ────────────────────────────────────────────────────

export interface UseCreateCoachRunOptions {
  artifactPublicId: string;
  /** Called when run is successfully created */
  onSuccess?: (run: CoachRunSummaryResource) => void;
  /** Called when creation fails */
  onError?: (error: Error) => void;
}

/**
 * Create a new coaching run.
 *
 * Returns immediately with pending run (does NOT wait for AI generation).
 * Invalidates the history cache so the new run appears.
 */
export function useCreateCoachRun(options: UseCreateCoachRunOptions) {
  const { artifactPublicId, onSuccess, onError } = options;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reviewScope: CoachReviewScope) =>
      createCoachRun({ artifactPublicId, reviewScope }),
    onSuccess: (data) => {
      // Invalidate history so new run appears
      queryClient.invalidateQueries({
        queryKey: coachingKeys.artifact(artifactPublicId),
      });
      onSuccess?.(data.run);
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });
}

// ─── Error Code Detection ───────────────────────────────────────────────────

/**
 * Check if an error is a "run already active" conflict.
 */
export function isCoachRunAlreadyActiveError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'response' in error) {
    const httpError = error as { response: Response };
    // 409 status with COACH_RUN_ALREADY_ACTIVE code
    return httpError.response.status === 409;
  }
  return false;
}
