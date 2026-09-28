/**
 * Coaching Query Hooks — Coach M3A
 *
 * React Query hooks for fetching Coaching data.
 * Includes polling support for active runs.
 */

import { useQuery } from '@tanstack/react-query';
import { coachingKeys } from './keys';
import { listCoachRuns, getCoachRun } from './client';
import type {
  CoachRunStatus,
  CoachReviewScope,
  CoachRunSummaryResource,
} from '@qori/api-contracts';

// ─── History Query ──────────────────────────────────────────────────────────

export interface UseCoachHistoryOptions {
  artifactPublicId: string;
  /** Filter by status */
  status?: CoachRunStatus;
  /** Filter by review scope */
  reviewScope?: CoachReviewScope;
  /** Filter by section key */
  sectionKey?: string;
  /** Max results to fetch */
  limit?: number;
  /** Enable/disable the query */
  enabled?: boolean;
}

/**
 * Fetch coaching run history for an artifact.
 *
 * Returns runs sorted newest-first. Includes both artifact-level
 * and section-level reviews for the shared history display.
 */
export function useCoachHistory(options: UseCoachHistoryOptions) {
  const { artifactPublicId, status, reviewScope, sectionKey, limit, enabled = true } = options;

  return useQuery({
    queryKey: coachingKeys.history({ artifactPublicId, status, reviewScope, sectionKey }),
    queryFn: () =>
      listCoachRuns({
        artifactPublicId,
        status,
        reviewScope,
        sectionKey,
        limit,
      }),
    enabled: enabled && !!artifactPublicId,
  });
}

// ─── Run Detail Query ───────────────────────────────────────────────────────

export interface UseCoachRunOptions {
  runId: string;
  /** Enable/disable the query */
  enabled?: boolean;
  /** Poll interval in ms for active runs (0 = no polling) */
  pollInterval?: number;
}

/**
 * Fetch a single coaching run with full details.
 *
 * Supports polling for active (pending/running) runs.
 * Polling stops automatically when run reaches completed/failed.
 */
export function useCoachRun(options: UseCoachRunOptions) {
  const { runId, enabled = true, pollInterval = 0 } = options;

  return useQuery({
    queryKey: coachingKeys.run(runId),
    queryFn: () => getCoachRun(runId),
    enabled: enabled && !!runId,
    refetchInterval: pollInterval > 0 ? pollInterval : false,
  });
}

// ─── Active Run Polling ─────────────────────────────────────────────────────

const DEFAULT_POLL_INTERVAL = 2000; // 2 seconds

/**
 * Hook for polling an active coaching run.
 * Automatically stops polling when run reaches terminal state.
 */
export function useActiveCoachRun(options: {
  runId: string | null;
  enabled?: boolean;
}) {
  const { runId, enabled = true } = options;

  const query = useQuery({
    queryKey: runId ? coachingKeys.run(runId) : ['coaching', 'inactive'],
    queryFn: () => (runId ? getCoachRun(runId) : Promise.resolve(null)),
    enabled: enabled && !!runId,
    refetchInterval: (query) => {
      // Stop polling when run reaches terminal state
      const run = query.state.data?.run;
      if (!run) return DEFAULT_POLL_INTERVAL;
      if (run.status === 'completed' || run.status === 'failed') {
        return false;
      }
      return DEFAULT_POLL_INTERVAL;
    },
  });

  return query;
}

// ─── Derived Utilities ──────────────────────────────────────────────────────

/**
 * Check if a run is in an active state (pending or running).
 */
export function isActiveRun(run: CoachRunSummaryResource): boolean {
  return run.status === 'pending' || run.status === 'running';
}

/**
 * Check if a run is in a terminal state (completed or failed).
 */
export function isTerminalRun(run: CoachRunSummaryResource): boolean {
  return run.status === 'completed' || run.status === 'failed';
}
