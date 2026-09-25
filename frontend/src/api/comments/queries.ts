/**
 * Comments Query Hooks — CMT-5
 *
 * React Query hooks for fetching Comments data.
 * Uses server-side filtering — no frontend filtering logic.
 */

import { useQuery } from '@tanstack/react-query';
import { commentsKeys } from './keys';
import { listCommentThreads, getCommentThread } from './client';
import type { CommentThreadStatus, CommentThreadResource } from '@qori/api-contracts';

// ─── List Comments Query ───────────────────────────────────────────────────

export interface UseCommentThreadsOptions {
  artifactPublicId: string;
  /** Filter by status. Defaults to 'open' (server-side default). */
  status?: CommentThreadStatus;
  /** Filter by section key (stable identifier, not visible heading). */
  sectionKey?: string;
  /** Enable/disable the query. */
  enabled?: boolean;
}

/**
 * Fetch comment threads for an artifact with optional filtering.
 *
 * Filtering is performed server-side:
 * - status defaults to 'open' when omitted
 * - sectionKey filters to a specific section
 *
 * Returns only threads matching the filters — no client-side filtering.
 */
export function useCommentThreads(options: UseCommentThreadsOptions) {
  const { artifactPublicId, status, sectionKey, enabled = true } = options;

  return useQuery({
    queryKey: commentsKeys.list({ artifactPublicId, status, sectionKey }),
    queryFn: () =>
      listCommentThreads({
        artifactPublicId,
        status,
        sectionKey,
      }),
    enabled: enabled && !!artifactPublicId,
  });
}

// ─── Thread Detail Query ───────────────────────────────────────────────────

export interface UseCommentThreadOptions {
  threadId: string;
  enabled?: boolean;
}

/**
 * Fetch a single thread with all messages and events.
 */
export function useCommentThread(options: UseCommentThreadOptions) {
  const { threadId, enabled = true } = options;

  return useQuery({
    queryKey: commentsKeys.thread(threadId),
    queryFn: () => getCommentThread(threadId),
    enabled: enabled && !!threadId,
  });
}

// ─── Derived Count Utilities ───────────────────────────────────────────────

/**
 * Derive open thread count from a list query result.
 * Only counts THREADS, not messages.
 *
 * @param threads - Array of threads from useCommentThreads (status=open)
 * @returns Total count of open threads
 */
export function deriveOpenThreadCount(threads: CommentThreadResource[] | undefined): number {
  if (!threads) return 0;
  return threads.length;
}

/**
 * Derive open thread count for a specific section.
 * Use with useCommentThreads({ sectionKey, status: 'open' }) result.
 *
 * @param threads - Filtered thread array
 * @param sectionKey - Section key to count (for validation)
 * @returns Count of open threads in the section
 */
export function deriveSectionOpenThreadCount(
  threads: CommentThreadResource[] | undefined,
  sectionKey: string,
): number {
  if (!threads) return 0;
  // Threads should already be filtered by server, but verify section_key matches
  return threads.filter((t) => t.section_key === sectionKey).length;
}

/**
 * Group threads by section_key for section-level counts.
 * Preserves unknown section_key values (orphan readiness).
 *
 * @param threads - Array of threads from useCommentThreads
 * @returns Map of section_key to thread count
 */
export function groupThreadsBySection(
  threads: CommentThreadResource[] | undefined,
): Map<string, number> {
  const counts = new Map<string, number>();
  if (!threads) return counts;

  for (const thread of threads) {
    const current = counts.get(thread.section_key) ?? 0;
    counts.set(thread.section_key, current + 1);
  }

  return counts;
}
