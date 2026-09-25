/**
 * Comments API Module — CMT-5
 *
 * Frontend data layer for Workspace Comments.
 *
 * Exports:
 * - Query hooks: useCommentThreads, useCommentThread
 * - Mutation hooks: useCreateCommentThread, useReplyToCommentThread, etc.
 * - Query keys: commentsKeys
 * - Error types: CommentApiError, EditConflictError, isEditConflictError
 * - Utilities: deriveOpenThreadCount, deriveSectionOpenThreadCount, groupThreadsBySection
 */

// ─── Query Keys ────────────────────────────────────────────────────────────

export { commentsKeys, type CommentListFilters } from './keys';

// ─── Query Hooks ───────────────────────────────────────────────────────────

export {
  useCommentThreads,
  useCommentThread,
  deriveOpenThreadCount,
  deriveSectionOpenThreadCount,
  groupThreadsBySection,
  type UseCommentThreadsOptions,
  type UseCommentThreadOptions,
} from './queries';

// ─── Mutation Hooks ────────────────────────────────────────────────────────

export {
  useCreateCommentThread,
  useReplyToCommentThread,
  useEditCommentMessage,
  useResolveCommentThread,
  useReopenCommentThread,
  type CreateThreadHookInput,
  type ReplyToThreadInput,
  type EditMessageInput,
  type ResolveThreadInput,
  type ReopenThreadInput,
} from './mutations';

// ─── Error Types ───────────────────────────────────────────────────────────

export {
  parseCommentError,
  isEditConflictError,
  type CommentErrorCode,
  type CommentApiError,
  type EditConflictError,
} from './types';

// ─── API Client (for advanced use cases) ───────────────────────────────────

export {
  listCommentThreads,
  getCommentThread,
  createCommentThread,
  replyToCommentThread,
  editCommentMessage,
  resolveCommentThread,
  reopenCommentThread,
  type ListCommentsParams,
  type CreateThreadParams,
  type ReplyToThreadParams,
  type EditMessageParams,
} from './client';
