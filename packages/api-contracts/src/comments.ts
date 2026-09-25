/**
 * Qori Comments API Contract — CMT-1
 *
 * Public contract for Workspace Comments.
 * Comments anchor to artifact + section_key (stable identifiers from
 * @qori/artifact-contracts). Authorization is based on project membership,
 * thread authorship, and study ownership.
 *
 * Conventions:
 * - Resource types use public_id (UUID), never internal integer IDs
 * - Author identity uses public_id + display_name (no sensitive details)
 * - Permissions are computed server-side, never raw authorization rules
 */

import type { CommentThreadStatus, CommentEventType } from './enums';

// Re-export for convenience
export type { CommentThreadStatus, CommentEventType };

// ─── Permissions ────────────────────────────────────────────────────

/**
 * Permission flags computed by the backend for a comment thread.
 * Never expose raw authorization logic to the frontend.
 */
export interface CommentThreadPermissions {
  /** Actor can add replies to this thread */
  readonly can_reply: boolean;
  /** Actor can resolve this thread (author or study owner) */
  readonly can_resolve: boolean;
  /** Actor can reopen this thread (author or study owner) */
  readonly can_reopen: boolean;
}

/**
 * Permission flags computed by the backend for a comment message.
 */
export interface CommentMessagePermissions {
  /** Actor can edit this message (message author only) */
  readonly can_edit: boolean;
}

// ─── Author Identity ────────────────────────────────────────────────

/**
 * Minimal actor info for display in comments.
 * Uses public_id only — never expose internal integer IDs.
 */
export interface CommentAuthorSummary {
  readonly public_id: string;
  readonly display_name: string | null;
}

// ─── Message Resource ───────────────────────────────────────────────

/**
 * Comment message as returned by the API.
 */
export interface CommentMessageResource {
  readonly id: string;
  readonly thread_id: string;
  readonly author: CommentAuthorSummary;
  readonly body: string;
  readonly created_at: string; // ISO 8601
  readonly updated_at: string; // ISO 8601 (for optimistic locking)
  readonly permissions: CommentMessagePermissions;
}

// ─── Thread Event Resource ──────────────────────────────────────────

/**
 * Thread event for audit timeline display.
 */
export interface CommentThreadEventResource {
  readonly id: string;
  readonly thread_id: string;
  readonly event_type: CommentEventType;
  readonly actor: CommentAuthorSummary;
  readonly created_at: string; // ISO 8601
}

// ─── Thread Resource ────────────────────────────────────────────────

/**
 * Comment thread as returned by the API.
 * Includes computed permissions.
 */
export interface CommentThreadResource {
  readonly id: string;
  readonly study_public_id: string;
  readonly artifact_public_id: string;
  readonly section_key: string;
  readonly status: CommentThreadStatus;
  readonly creator: CommentAuthorSummary;
  readonly created_at: string; // ISO 8601
  readonly resolved_by: CommentAuthorSummary | null;
  readonly resolved_at: string | null; // ISO 8601
  readonly permissions: CommentThreadPermissions;
  readonly message_count: number;
}

/**
 * Thread with messages and events expanded.
 */
export interface CommentThreadDetailResource extends CommentThreadResource {
  readonly messages: CommentMessageResource[];
  readonly events: CommentThreadEventResource[];
}

// ─── Query Inputs ───────────────────────────────────────────────────

/**
 * Query parameters for listing comment threads.
 * Used by GET /api/v1/artifacts/:id/comments
 */
export interface CommentThreadListQuery {
  /**
   * Filter by thread status. Defaults to 'open' if not specified.
   */
  readonly status?: CommentThreadStatus;
  /**
   * Filter by section key (must be valid for the artifact type).
   */
  readonly section_key?: string;
}

// ─── Request Inputs ─────────────────────────────────────────────────

/**
 * Create a new comment thread with its initial message.
 * Threads cannot exist without at least one message.
 */
export interface CreateCommentThreadInput {
  readonly artifact_public_id: string;
  readonly section_key: string;
  readonly body: string; // Initial message body
}

/**
 * Add a reply to an existing thread.
 */
export interface CreateCommentMessageInput {
  readonly thread_id: string;
  readonly body: string;
}

/**
 * Edit an existing message.
 * Requires expected_updated_at for optimistic concurrency.
 */
export interface UpdateCommentMessageInput {
  readonly body: string;
  /**
   * The updated_at timestamp from the message when the user started editing.
   * If this doesn't match the current stored value, the edit is rejected
   * with COMMENT_EDIT_CONFLICT to prevent lost updates.
   */
  readonly expected_updated_at: string; // ISO 8601
}

// ─── Response Envelopes ─────────────────────────────────────────────

/**
 * List threads for an artifact.
 */
export interface CommentThreadListResponse {
  readonly artifact_public_id: string;
  readonly threads: CommentThreadResource[];
  readonly total_count: number;
}

/**
 * Thread detail with messages.
 */
export interface CommentThreadDetailResponse {
  readonly thread: CommentThreadDetailResource;
}

/**
 * Created thread response.
 */
export interface CreateCommentThreadResponse {
  readonly thread: CommentThreadDetailResource;
}

/**
 * Created message response.
 */
export interface CreateCommentMessageResponse {
  readonly message: CommentMessageResource;
}

/**
 * Updated message response.
 */
export interface UpdateCommentMessageResponse {
  readonly message: CommentMessageResource;
}

/**
 * Resolve/reopen thread response.
 */
export interface UpdateCommentThreadStatusResponse {
  readonly thread: CommentThreadResource;
  readonly event: CommentThreadEventResource;
}
