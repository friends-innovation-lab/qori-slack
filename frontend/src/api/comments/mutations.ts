/**
 * Comments Mutation Hooks — CMT-5
 *
 * React Query mutation hooks for Comments operations.
 * Implements optimistic updates with rollback on failure.
 *
 * CACHE ISOLATION: Comments mutations ONLY affect Comments caches.
 * Brief/Plan artifact queries, save state, approval state, and
 * GitHub sync state are never invalidated by Comments mutations.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { commentsKeys } from './keys';
import {
  createCommentThread,
  replyToCommentThread,
  editCommentMessage,
  resolveCommentThread,
  reopenCommentThread,
  type CreateThreadParams,
  type ReplyToThreadParams,
  type EditMessageParams,
} from './client';
import { parseCommentError, type CommentApiError } from './types';
import type {
  CommentThreadListResponse,
  CommentThreadDetailResponse,
  CommentThreadResource,
  CommentMessageResource,
} from '@qori/api-contracts';

// ─── Create Thread ─────────────────────────────────────────────────────────

/**
 * Hook input for creating a comment thread.
 * Uses camelCase (React convention) — mapped to snake_case wire format internally.
 */
export interface CreateThreadHookInput {
  artifactPublicId: string;
  sectionKey: string;
  body: string;
}

/**
 * Create a new comment thread with optimistic updates.
 *
 * Optimistic behavior:
 * - Adds temporary thread to open list caches
 * - Updates matching section-scoped open list if cached
 * - Reconciles with server response (replaces temp ID)
 * - Rollback on failure
 *
 * Does NOT invalidate Brief/Plan artifact caches.
 */
export function useCreateCommentThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateThreadHookInput) => {
      const params: CreateThreadParams = {
        artifactPublicId: input.artifactPublicId,
        sectionKey: input.sectionKey,
        body: input.body,
      };
      return createCommentThread(params);
    },

    onMutate: async (input) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: commentsKeys.artifact(input.artifactPublicId),
      });

      // Snapshot previous values for rollback
      const previousOpenList = queryClient.getQueryData<CommentThreadListResponse>(
        commentsKeys.list({ artifactPublicId: input.artifactPublicId, status: 'open' }),
      );
      const previousSectionList = queryClient.getQueryData<CommentThreadListResponse>(
        commentsKeys.list({
          artifactPublicId: input.artifactPublicId,
          status: 'open',
          sectionKey: input.sectionKey,
        }),
      );

      // Create optimistic thread (temporary ID will be replaced by server response)
      const tempId = `temp-${Date.now()}`;
      const now = new Date().toISOString();
      const optimisticThread: CommentThreadResource = {
        id: tempId,
        study_public_id: '', // Will be filled by server
        artifact_public_id: input.artifactPublicId,
        section_key: input.sectionKey,
        status: 'open',
        creator: { public_id: '', display_name: null }, // Will be filled by server
        created_at: now,
        resolved_by: null,
        resolved_at: null,
        permissions: { can_reply: true, can_resolve: true, can_reopen: false },
        message_count: 1,
      };

      // Update open list cache
      if (previousOpenList) {
        queryClient.setQueryData<CommentThreadListResponse>(
          commentsKeys.list({ artifactPublicId: input.artifactPublicId, status: 'open' }),
          {
            ...previousOpenList,
            threads: [...previousOpenList.threads, optimisticThread],
            total_count: previousOpenList.total_count + 1,
          },
        );
      }

      // Update section-scoped open list if cached
      if (previousSectionList) {
        queryClient.setQueryData<CommentThreadListResponse>(
          commentsKeys.list({
            artifactPublicId: input.artifactPublicId,
            status: 'open',
            sectionKey: input.sectionKey,
          }),
          {
            ...previousSectionList,
            threads: [...previousSectionList.threads, optimisticThread],
            total_count: previousSectionList.total_count + 1,
          },
        );
      }

      return { previousOpenList, previousSectionList, tempId };
    },

    onSuccess: (data, input, context) => {
      // Replace optimistic thread with server response
      const serverThread = data.thread;

      // Update open list — replace temp thread with real one
      queryClient.setQueryData<CommentThreadListResponse>(
        commentsKeys.list({ artifactPublicId: input.artifactPublicId, status: 'open' }),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            threads: old.threads.map((t) =>
              t.id === context?.tempId ? serverThread : t,
            ),
          };
        },
      );

      // Update section list — replace temp thread with real one
      queryClient.setQueryData<CommentThreadListResponse>(
        commentsKeys.list({
          artifactPublicId: input.artifactPublicId,
          status: 'open',
          sectionKey: input.sectionKey,
        }),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            threads: old.threads.map((t) =>
              t.id === context?.tempId ? serverThread : t,
            ),
          };
        },
      );

      // Set thread detail cache
      queryClient.setQueryData<CommentThreadDetailResponse>(
        commentsKeys.thread(serverThread.id),
        { thread: data.thread },
      );
    },

    onError: (_error, input, context) => {
      // Rollback to previous state
      if (context?.previousOpenList) {
        queryClient.setQueryData(
          commentsKeys.list({ artifactPublicId: input.artifactPublicId, status: 'open' }),
          context.previousOpenList,
        );
      }
      if (context?.previousSectionList) {
        queryClient.setQueryData(
          commentsKeys.list({
            artifactPublicId: input.artifactPublicId,
            status: 'open',
            sectionKey: input.sectionKey,
          }),
          context.previousSectionList,
        );
      }
    },
  });
}

// ─── Reply to Thread ───────────────────────────────────────────────────────

export interface ReplyToThreadInput {
  threadId: string;
  body: string;
}

/**
 * Reply to an existing thread with optimistic updates.
 *
 * Optimistic behavior:
 * - Adds temporary message to thread detail cache
 * - Reconciles with server response
 * - Rollback on failure
 *
 * Does NOT increment unresolved count (counts are thread-based, not message-based).
 */
export function useReplyToCommentThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ReplyToThreadInput) => {
      const params: ReplyToThreadParams = {
        threadId: input.threadId,
        body: input.body,
      };
      return replyToCommentThread(params);
    },

    onMutate: async (input) => {
      // Cancel outgoing refetches for this thread
      await queryClient.cancelQueries({
        queryKey: commentsKeys.thread(input.threadId),
      });

      // Snapshot previous thread detail
      const previousThread = queryClient.getQueryData<CommentThreadDetailResponse>(
        commentsKeys.thread(input.threadId),
      );

      // Create optimistic message
      const tempId = `temp-msg-${Date.now()}`;
      const now = new Date().toISOString();
      const optimisticMessage: CommentMessageResource = {
        id: tempId,
        thread_id: input.threadId,
        author: { public_id: '', display_name: null }, // Will be filled by server
        body: input.body,
        created_at: now,
        updated_at: now,
        permissions: { can_edit: true },
      };

      // Update thread detail cache
      if (previousThread) {
        queryClient.setQueryData<CommentThreadDetailResponse>(
          commentsKeys.thread(input.threadId),
          {
            thread: {
              ...previousThread.thread,
              messages: [...previousThread.thread.messages, optimisticMessage],
              message_count: previousThread.thread.message_count + 1,
            },
          },
        );
      }

      return { previousThread, tempId };
    },

    onSuccess: (data, input, context) => {
      // Replace optimistic message with server response
      queryClient.setQueryData<CommentThreadDetailResponse>(
        commentsKeys.thread(input.threadId),
        (old) => {
          if (!old) return old;
          return {
            thread: {
              ...old.thread,
              messages: old.thread.messages.map((m) =>
                m.id === context?.tempId ? data.message : m,
              ),
            },
          };
        },
      );
    },

    onError: (_error, input, context) => {
      // Rollback to previous state
      if (context?.previousThread) {
        queryClient.setQueryData(
          commentsKeys.thread(input.threadId),
          context.previousThread,
        );
      }
    },
  });
}

// ─── Edit Message ──────────────────────────────────────────────────────────

export interface EditMessageInput {
  messageId: string;
  threadId: string;
  body: string;
  expectedUpdatedAt: string;
}

/**
 * Edit a message with conflict detection.
 *
 * NOT optimistic — waits for server response to prevent lost updates.
 *
 * On 409 COMMENT_EDIT_CONFLICT:
 * - Error contains the submitted body for conflict resolution
 * - Does NOT automatically retry
 * - UI should refetch and show conflict resolution
 */
export function useEditCommentMessage() {
  const queryClient = useQueryClient();

  return useMutation<
    Awaited<ReturnType<typeof editCommentMessage>>,
    CommentApiError,
    EditMessageInput
  >({
    mutationFn: async (input) => {
      try {
        const params: EditMessageParams = {
          messageId: input.messageId,
          body: input.body,
          expectedUpdatedAt: input.expectedUpdatedAt,
        };
        return await editCommentMessage(params);
      } catch (error) {
        // Parse error with context for conflict handling
        const parsed = await parseCommentError(error, {
          submittedBody: input.body,
          messageId: input.messageId,
        });
        throw parsed;
      }
    },

    onSuccess: (data, input) => {
      // Update message in thread detail cache
      queryClient.setQueryData<CommentThreadDetailResponse>(
        commentsKeys.thread(input.threadId),
        (old) => {
          if (!old) return old;
          return {
            thread: {
              ...old.thread,
              messages: old.thread.messages.map((m) =>
                m.id === input.messageId ? data.message : m,
              ),
            },
          };
        },
      );
    },

    // No automatic retry — conflict requires user decision
    retry: false,
  });
}

// ─── Resolve Thread ────────────────────────────────────────────────────────

export interface ResolveThreadInput {
  threadId: string;
  artifactPublicId: string;
  sectionKey: string;
}

/**
 * Resolve a thread with optimistic updates.
 *
 * Optimistic behavior:
 * - Removes thread from open list caches
 * - Adds to resolved list if cached
 * - Updates thread detail status
 * - Rollback on failure
 *
 * Artifact unresolved count decrements by exactly 1.
 */
export function useResolveCommentThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ResolveThreadInput) => {
      return resolveCommentThread(input.threadId);
    },

    onMutate: async (input) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: commentsKeys.artifact(input.artifactPublicId),
      });
      await queryClient.cancelQueries({
        queryKey: commentsKeys.thread(input.threadId),
      });

      // Snapshot previous values
      const previousOpenList = queryClient.getQueryData<CommentThreadListResponse>(
        commentsKeys.list({ artifactPublicId: input.artifactPublicId, status: 'open' }),
      );
      const previousResolvedList = queryClient.getQueryData<CommentThreadListResponse>(
        commentsKeys.list({ artifactPublicId: input.artifactPublicId, status: 'resolved' }),
      );
      const previousSectionOpenList = queryClient.getQueryData<CommentThreadListResponse>(
        commentsKeys.list({
          artifactPublicId: input.artifactPublicId,
          status: 'open',
          sectionKey: input.sectionKey,
        }),
      );
      const previousThread = queryClient.getQueryData<CommentThreadDetailResponse>(
        commentsKeys.thread(input.threadId),
      );

      // Find the thread being resolved
      const threadToResolve = previousOpenList?.threads.find((t) => t.id === input.threadId);

      // Remove from open list
      if (previousOpenList) {
        queryClient.setQueryData<CommentThreadListResponse>(
          commentsKeys.list({ artifactPublicId: input.artifactPublicId, status: 'open' }),
          {
            ...previousOpenList,
            threads: previousOpenList.threads.filter((t) => t.id !== input.threadId),
            total_count: Math.max(0, previousOpenList.total_count - 1),
          },
        );
      }

      // Remove from section open list
      if (previousSectionOpenList) {
        queryClient.setQueryData<CommentThreadListResponse>(
          commentsKeys.list({
            artifactPublicId: input.artifactPublicId,
            status: 'open',
            sectionKey: input.sectionKey,
          }),
          {
            ...previousSectionOpenList,
            threads: previousSectionOpenList.threads.filter((t) => t.id !== input.threadId),
            total_count: Math.max(0, previousSectionOpenList.total_count - 1),
          },
        );
      }

      // Add to resolved list if cached and we have the thread data
      if (previousResolvedList && threadToResolve) {
        const resolvedThread: CommentThreadResource = {
          ...threadToResolve,
          status: 'resolved',
          resolved_at: new Date().toISOString(),
          permissions: {
            ...threadToResolve.permissions,
            can_resolve: false,
            can_reopen: true,
          },
        };
        queryClient.setQueryData<CommentThreadListResponse>(
          commentsKeys.list({ artifactPublicId: input.artifactPublicId, status: 'resolved' }),
          {
            ...previousResolvedList,
            threads: [...previousResolvedList.threads, resolvedThread],
            total_count: previousResolvedList.total_count + 1,
          },
        );
      }

      // Update thread detail
      if (previousThread) {
        queryClient.setQueryData<CommentThreadDetailResponse>(
          commentsKeys.thread(input.threadId),
          {
            thread: {
              ...previousThread.thread,
              status: 'resolved',
              resolved_at: new Date().toISOString(),
              permissions: {
                ...previousThread.thread.permissions,
                can_resolve: false,
                can_reopen: true,
              },
            },
          },
        );
      }

      return { previousOpenList, previousResolvedList, previousSectionOpenList, previousThread };
    },

    onSuccess: (data, input) => {
      // Reconcile with server response
      const serverThread = data.thread;

      // Update thread detail with server data
      queryClient.setQueryData<CommentThreadDetailResponse>(
        commentsKeys.thread(input.threadId),
        (old) => {
          if (!old) return old;
          return {
            thread: {
              ...old.thread,
              ...serverThread,
              messages: old.thread.messages,
              events: [...old.thread.events, data.event],
            },
          };
        },
      );

      // Update resolved list with server data
      queryClient.setQueryData<CommentThreadListResponse>(
        commentsKeys.list({ artifactPublicId: input.artifactPublicId, status: 'resolved' }),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            threads: old.threads.map((t) => (t.id === input.threadId ? serverThread : t)),
          };
        },
      );
    },

    onError: (_error, input, context) => {
      // Rollback all affected caches
      if (context?.previousOpenList) {
        queryClient.setQueryData(
          commentsKeys.list({ artifactPublicId: input.artifactPublicId, status: 'open' }),
          context.previousOpenList,
        );
      }
      if (context?.previousResolvedList) {
        queryClient.setQueryData(
          commentsKeys.list({ artifactPublicId: input.artifactPublicId, status: 'resolved' }),
          context.previousResolvedList,
        );
      }
      if (context?.previousSectionOpenList) {
        queryClient.setQueryData(
          commentsKeys.list({
            artifactPublicId: input.artifactPublicId,
            status: 'open',
            sectionKey: input.sectionKey,
          }),
          context.previousSectionOpenList,
        );
      }
      if (context?.previousThread) {
        queryClient.setQueryData(
          commentsKeys.thread(input.threadId),
          context.previousThread,
        );
      }
    },
  });
}

// ─── Reopen Thread ─────────────────────────────────────────────────────────

export interface ReopenThreadInput {
  threadId: string;
  artifactPublicId: string;
  sectionKey: string;
}

/**
 * Reopen a resolved thread with optimistic updates.
 *
 * Optimistic behavior:
 * - Removes thread from resolved list
 * - Adds to open list caches
 * - Updates thread detail status
 * - Rollback on failure
 *
 * Artifact unresolved count increments by exactly 1.
 */
export function useReopenCommentThread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ReopenThreadInput) => {
      return reopenCommentThread(input.threadId);
    },

    onMutate: async (input) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: commentsKeys.artifact(input.artifactPublicId),
      });
      await queryClient.cancelQueries({
        queryKey: commentsKeys.thread(input.threadId),
      });

      // Snapshot previous values
      const previousOpenList = queryClient.getQueryData<CommentThreadListResponse>(
        commentsKeys.list({ artifactPublicId: input.artifactPublicId, status: 'open' }),
      );
      const previousResolvedList = queryClient.getQueryData<CommentThreadListResponse>(
        commentsKeys.list({ artifactPublicId: input.artifactPublicId, status: 'resolved' }),
      );
      const previousSectionOpenList = queryClient.getQueryData<CommentThreadListResponse>(
        commentsKeys.list({
          artifactPublicId: input.artifactPublicId,
          status: 'open',
          sectionKey: input.sectionKey,
        }),
      );
      const previousThread = queryClient.getQueryData<CommentThreadDetailResponse>(
        commentsKeys.thread(input.threadId),
      );

      // Find the thread being reopened
      const threadToReopen = previousResolvedList?.threads.find((t) => t.id === input.threadId);

      // Remove from resolved list
      if (previousResolvedList) {
        queryClient.setQueryData<CommentThreadListResponse>(
          commentsKeys.list({ artifactPublicId: input.artifactPublicId, status: 'resolved' }),
          {
            ...previousResolvedList,
            threads: previousResolvedList.threads.filter((t) => t.id !== input.threadId),
            total_count: Math.max(0, previousResolvedList.total_count - 1),
          },
        );
      }

      // Add to open list if cached and we have the thread data
      if (threadToReopen) {
        const openThread: CommentThreadResource = {
          ...threadToReopen,
          status: 'open',
          resolved_by: null,
          resolved_at: null,
          permissions: {
            ...threadToReopen.permissions,
            can_resolve: true,
            can_reopen: false,
          },
        };

        if (previousOpenList) {
          queryClient.setQueryData<CommentThreadListResponse>(
            commentsKeys.list({ artifactPublicId: input.artifactPublicId, status: 'open' }),
            {
              ...previousOpenList,
              threads: [...previousOpenList.threads, openThread],
              total_count: previousOpenList.total_count + 1,
            },
          );
        }

        // Add to section open list if section matches
        if (previousSectionOpenList && threadToReopen.section_key === input.sectionKey) {
          queryClient.setQueryData<CommentThreadListResponse>(
            commentsKeys.list({
              artifactPublicId: input.artifactPublicId,
              status: 'open',
              sectionKey: input.sectionKey,
            }),
            {
              ...previousSectionOpenList,
              threads: [...previousSectionOpenList.threads, openThread],
              total_count: previousSectionOpenList.total_count + 1,
            },
          );
        }
      }

      // Update thread detail
      if (previousThread) {
        queryClient.setQueryData<CommentThreadDetailResponse>(
          commentsKeys.thread(input.threadId),
          {
            thread: {
              ...previousThread.thread,
              status: 'open',
              resolved_by: null,
              resolved_at: null,
              permissions: {
                ...previousThread.thread.permissions,
                can_resolve: true,
                can_reopen: false,
              },
            },
          },
        );
      }

      return { previousOpenList, previousResolvedList, previousSectionOpenList, previousThread };
    },

    onSuccess: (data, input) => {
      // Reconcile with server response
      const serverThread = data.thread;

      // Update thread detail with server data
      queryClient.setQueryData<CommentThreadDetailResponse>(
        commentsKeys.thread(input.threadId),
        (old) => {
          if (!old) return old;
          return {
            thread: {
              ...old.thread,
              ...serverThread,
              messages: old.thread.messages,
              events: [...old.thread.events, data.event],
            },
          };
        },
      );

      // Update open list with server data
      queryClient.setQueryData<CommentThreadListResponse>(
        commentsKeys.list({ artifactPublicId: input.artifactPublicId, status: 'open' }),
        (old) => {
          if (!old) return old;
          return {
            ...old,
            threads: old.threads.map((t) => (t.id === input.threadId ? serverThread : t)),
          };
        },
      );
    },

    onError: (_error, input, context) => {
      // Rollback all affected caches
      if (context?.previousOpenList) {
        queryClient.setQueryData(
          commentsKeys.list({ artifactPublicId: input.artifactPublicId, status: 'open' }),
          context.previousOpenList,
        );
      }
      if (context?.previousResolvedList) {
        queryClient.setQueryData(
          commentsKeys.list({ artifactPublicId: input.artifactPublicId, status: 'resolved' }),
          context.previousResolvedList,
        );
      }
      if (context?.previousSectionOpenList) {
        queryClient.setQueryData(
          commentsKeys.list({
            artifactPublicId: input.artifactPublicId,
            status: 'open',
            sectionKey: input.sectionKey,
          }),
          context.previousSectionOpenList,
        );
      }
      if (context?.previousThread) {
        queryClient.setQueryData(
          commentsKeys.thread(input.threadId),
          context.previousThread,
        );
      }
    },
  });
}
