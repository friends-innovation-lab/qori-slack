/**
 * Comments Query Keys — CMT-5
 *
 * Stable query key factory for Comments cache management.
 * Keys distinguish artifact, status, and section for proper invalidation.
 */

import type { CommentThreadStatus } from '@qori/api-contracts';

export interface CommentListFilters {
  artifactPublicId: string;
  status?: CommentThreadStatus;
  sectionKey?: string;
}

/**
 * Query key factory for Comments.
 *
 * Structure:
 * - ['comments'] — root for all comments data
 * - ['comments', 'artifact', artifactPublicId] — all data for an artifact
 * - ['comments', 'artifact', artifactPublicId, 'list', { status, sectionKey }] — filtered list
 * - ['comments', 'thread', threadId] — single thread detail
 *
 * NORMALIZATION: status defaults to 'open' to match backend behavior.
 * This ensures useCommentThreads({ artifactPublicId }) and
 * useCommentThreads({ artifactPublicId, status: 'open' }) share the same cache.
 */
export const commentsKeys = {
  /** Root key for all comments queries */
  all: ['comments'] as const,

  /** All data for a specific artifact */
  artifact: (artifactPublicId: string) =>
    ['comments', 'artifact', artifactPublicId] as const,

  /** Filtered list for an artifact. Status normalized to 'open' when undefined. */
  list: (filters: CommentListFilters) =>
    [
      'comments',
      'artifact',
      filters.artifactPublicId,
      'list',
      { status: filters.status ?? 'open', sectionKey: filters.sectionKey },
    ] as const,

  /** Single thread detail */
  thread: (threadId: string) => ['comments', 'thread', threadId] as const,
};
