/**
 * Comment Contract Types — CMT-1
 *
 * Types for Workspace Comments. These contracts define:
 * - Thread and message shapes
 * - Permission flags computed by the backend
 * - Request/response schemas
 *
 * Comments anchor to artifact_id + section_key (stable identifiers from
 * @qori/artifact-contracts). Authorization is based on project membership,
 * thread authorship, and study ownership.
 */

import type { CommentThreadStatus } from '../database/models/comment_thread';
import type { CommentThreadEventType } from '../database/models/comment_thread_event';

// Re-export for convenience
export type { CommentThreadStatus, CommentThreadEventType };

// ─── Permission Flags ──────────────────────────────────────────────────

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

// ─── Actor Summary ─────────────────────────────────────────────────────

/**
 * Minimal actor info for display in comments.
 * Never include sensitive identity provider details.
 */
export interface CommentActorSummary {
  readonly id: number;
  readonly public_id: string;
  readonly display_name: string | null;
}

// ─── Message ───────────────────────────────────────────────────────────

/**
 * Comment message as returned by the API.
 */
export interface CommentMessageDTO {
  readonly id: string;
  readonly thread_id: string;
  readonly author: CommentActorSummary;
  readonly body: string;
  readonly created_at: string; // ISO 8601
  readonly updated_at: string; // ISO 8601 (for optimistic locking)
  readonly permissions: CommentMessagePermissions;
}

// ─── Thread Event ──────────────────────────────────────────────────────

/**
 * Thread event as returned by the API.
 */
export interface CommentThreadEventDTO {
  readonly id: string;
  readonly thread_id: string;
  readonly event_type: CommentThreadEventType;
  readonly actor: CommentActorSummary;
  readonly created_at: string; // ISO 8601
}

// ─── Thread ────────────────────────────────────────────────────────────

/**
 * Comment thread as returned by the API.
 * Includes computed permissions.
 */
export interface CommentThreadDTO {
  readonly id: string;
  readonly study_id: number;
  readonly artifact_id: number;
  readonly section_key: string;
  readonly status: CommentThreadStatus;
  readonly creator: CommentActorSummary;
  readonly created_at: string; // ISO 8601
  readonly resolved_by: CommentActorSummary | null;
  readonly resolved_at: string | null; // ISO 8601
  readonly permissions: CommentThreadPermissions;
  readonly message_count: number;
}

/**
 * Thread with messages and events expanded.
 */
export interface CommentThreadWithMessagesDTO extends CommentThreadDTO {
  readonly messages: CommentMessageDTO[];
  readonly events: CommentThreadEventDTO[];
}

// ─── Requests ──────────────────────────────────────────────────────────

/**
 * Create a new comment thread with its initial message.
 * Threads cannot exist without at least one message.
 */
export interface CreateCommentThreadRequest {
  readonly artifact_id: number;
  readonly section_key: string;
  readonly body: string; // Initial message body
}

/**
 * Add a reply to an existing thread.
 */
export interface CreateCommentMessageRequest {
  readonly thread_id: string;
  readonly body: string;
}

/**
 * Edit an existing message.
 * Requires expected_updated_at for optimistic concurrency.
 */
export interface UpdateCommentMessageRequest {
  readonly body: string;
  /**
   * The updated_at timestamp from the message when the user started editing.
   * If this doesn't match the current stored value, the edit is rejected
   * with COMMENT_EDIT_CONFLICT to prevent lost updates.
   */
  readonly expected_updated_at: string; // ISO 8601
}

// ─── Responses ─────────────────────────────────────────────────────────

/**
 * List threads for an artifact.
 */
export interface CommentThreadListResponse {
  readonly artifact_id: number;
  readonly threads: CommentThreadDTO[];
  readonly total_count: number;
}

/**
 * Thread detail with messages.
 */
export interface CommentThreadDetailResponse {
  readonly thread: CommentThreadWithMessagesDTO;
}

/**
 * Created thread response.
 */
export interface CreateCommentThreadResponse {
  readonly thread: CommentThreadWithMessagesDTO;
}

/**
 * Created message response.
 */
export interface CreateCommentMessageResponse {
  readonly message: CommentMessageDTO;
}

/**
 * Updated message response.
 */
export interface UpdateCommentMessageResponse {
  readonly message: CommentMessageDTO;
}

/**
 * Resolve/reopen thread response.
 */
export interface UpdateCommentThreadStatusResponse {
  readonly thread: CommentThreadDTO;
  readonly event: CommentThreadEventDTO;
}

// ─── Section Key Validation ────────────────────────────────────────────

/**
 * Valid section keys by artifact type.
 * Derived from @qori/artifact-contracts at build time.
 * This is the authoritative set for backend validation.
 */
export const VALID_SECTION_KEYS: Record<string, readonly string[]> = {
  brief: [
    'descriptive_title',
    'summary',
    'problem_narrative',
    'method_prose',
    'participants_prose',
    'out_of_scope',
    'risks',
    'approval_items',
  ] as const,
  plan: [
    'plan_summary',
    'plan_background',
    'plan_method_approach',
    'plan_session_format',
    'plan_data_collection',
    'plan_participant_glance',
    'plan_participants_prose',
    'plan_deliverables',
    'plan_risks',
    'plan_commitments',
  ] as const,
} as const;

export type BriefSectionKey = typeof VALID_SECTION_KEYS.brief[number];
export type PlanSectionKey = typeof VALID_SECTION_KEYS.plan[number];
export type CommentableSectionKey = BriefSectionKey | PlanSectionKey;

/**
 * Check if a section key is valid for an artifact type.
 */
export function isValidSectionKey(artifactType: string, sectionKey: string): boolean {
  const validKeys = VALID_SECTION_KEYS[artifactType];
  if (!validKeys) return false;
  return validKeys.includes(sectionKey as any);
}
