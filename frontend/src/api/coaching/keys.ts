/**
 * Coaching Query Keys — Coach M3A
 *
 * Stable query key factory for Coaching cache management.
 * Keys distinguish artifact and run for proper invalidation.
 */

import type { CoachRunStatus, CoachReviewScope } from '@qori/api-contracts';

export interface CoachHistoryFilters {
  artifactPublicId: string;
  status?: CoachRunStatus;
  reviewScope?: CoachReviewScope;
  sectionKey?: string;
}

/**
 * Query key factory for Coaching.
 *
 * Structure:
 * - ['coaching'] — root for all coaching data
 * - ['coaching', 'artifact', artifactPublicId] — all data for an artifact
 * - ['coaching', 'artifact', artifactPublicId, 'history', { filters }] — filtered history
 * - ['coaching', 'run', runId] — single run detail
 */
export const coachingKeys = {
  /** Root key for all coaching queries */
  all: ['coaching'] as const,

  /** All data for a specific artifact */
  artifact: (artifactPublicId: string) => ['coaching', 'artifact', artifactPublicId] as const,

  /** History list for an artifact with optional filters */
  history: (filters: CoachHistoryFilters) =>
    [
      'coaching',
      'artifact',
      filters.artifactPublicId,
      'history',
      {
        status: filters.status,
        reviewScope: filters.reviewScope,
        sectionKey: filters.sectionKey,
      },
    ] as const,

  /** Single run detail */
  run: (runId: string) => ['coaching', 'run', runId] as const,
};
