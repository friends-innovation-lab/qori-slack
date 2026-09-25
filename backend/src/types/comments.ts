/**
 * Comments Types — CMT-1
 *
 * This module re-exports the PUBLIC contract from @qori/api-contracts and
 * defines BACKEND-INTERNAL types for service layer operations.
 *
 * PUBLIC TYPES (from @qori/api-contracts):
 * - CommentThreadResource, CommentMessageResource, CommentThreadEventResource
 * - CommentThreadPermissions, CommentMessagePermissions, CommentAuthorSummary
 * - CommentThreadStatus, CommentEventType
 * - Request/Response types
 *
 * BACKEND-INTERNAL TYPES (this file):
 * - InternalCommentThreadDTO, InternalCommentMessageDTO (include raw integer IDs)
 * - Section key validation (VALID_SECTION_KEYS, isValidSectionKey)
 *
 * CMT-3 REST controllers will map internal DTOs → public Resources.
 */

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC CONTRACT — Re-export from @qori/api-contracts
// ═══════════════════════════════════════════════════════════════════════════

export type {
  // Enums
  CommentThreadStatus,
  CommentEventType,
  // Permissions
  CommentThreadPermissions,
  CommentMessagePermissions,
  // Identity
  CommentAuthorSummary,
  // Resources
  CommentMessageResource,
  CommentThreadEventResource,
  CommentThreadResource,
  CommentThreadDetailResource,
  // Query Inputs
  CommentThreadListQuery,
  // Request Inputs
  CreateCommentThreadInput,
  CreateCommentMessageInput,
  UpdateCommentMessageInput,
  // Response Envelopes
  CommentThreadListResponse,
  CommentThreadDetailResponse,
  CreateCommentThreadResponse,
  CreateCommentMessageResponse,
  UpdateCommentMessageResponse,
  UpdateCommentThreadStatusResponse,
} from '@qori/api-contracts';

// ═══════════════════════════════════════════════════════════════════════════
// BACKEND-INTERNAL TYPES — Service layer DTOs with raw integer IDs
// ═══════════════════════════════════════════════════════════════════════════

import type { CommentThreadStatus as ThreadStatus } from '@qori/api-contracts';
import type { CommentThreadEventType } from '../database/models/comment_thread_event';

// Re-export model enum for internal use
export type { CommentThreadEventType };

/**
 * Internal actor summary with both IDs.
 * Used by app service; CMT-3 controller maps to CommentAuthorSummary (public_id only).
 */
export interface InternalActorSummary {
  readonly id: number;
  readonly public_id: string;
  readonly display_name: string | null;
}

/**
 * Internal permission flags — identical to public contract.
 * Defined here to avoid import complexity in app service.
 */
export interface InternalThreadPermissions {
  readonly can_reply: boolean;
  readonly can_resolve: boolean;
  readonly can_reopen: boolean;
}

export interface InternalMessagePermissions {
  readonly can_edit: boolean;
}

/**
 * Internal message DTO with raw thread_id UUID.
 * CMT-3 controller maps to CommentMessageResource.
 */
export interface InternalCommentMessageDTO {
  readonly id: string;
  readonly thread_id: string;
  readonly author: InternalActorSummary;
  readonly body: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly permissions: InternalMessagePermissions;
}

/**
 * Internal thread event DTO.
 * CMT-3 controller maps to CommentThreadEventResource.
 */
export interface InternalCommentThreadEventDTO {
  readonly id: string;
  readonly thread_id: string;
  readonly event_type: CommentThreadEventType;
  readonly actor: InternalActorSummary;
  readonly created_at: string;
}

/**
 * Internal thread DTO with raw integer IDs.
 * CMT-3 controller maps to CommentThreadResource (public_ids).
 */
export interface InternalCommentThreadDTO {
  readonly id: string;
  readonly study_id: number;
  readonly artifact_id: number;
  readonly section_key: string;
  readonly status: ThreadStatus;
  readonly creator: InternalActorSummary;
  readonly created_at: string;
  readonly resolved_by: InternalActorSummary | null;
  readonly resolved_at: string | null;
  readonly permissions: InternalThreadPermissions;
  readonly message_count: number;
}

/**
 * Internal thread with messages expanded.
 */
export interface InternalCommentThreadWithMessagesDTO extends InternalCommentThreadDTO {
  readonly messages: InternalCommentMessageDTO[];
  readonly events: InternalCommentThreadEventDTO[];
}

// ═══════════════════════════════════════════════════════════════════════════
// BACKEND-INTERNAL — Section Key Validation
// ═══════════════════════════════════════════════════════════════════════════

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
  return validKeys.includes(sectionKey as BriefSectionKey | PlanSectionKey);
}

// ═══════════════════════════════════════════════════════════════════════════
// BACKEND-INTERNAL — Request/Response types with internal IDs
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Internal request to create a thread (uses artifact_id integer).
 * CMT-3 controller maps from public CreateCommentThreadInput.
 */
export interface InternalCreateThreadRequest {
  readonly artifact_id: number;
  readonly section_key: string;
  readonly body: string;
}

/**
 * Internal request to create a message.
 */
export interface InternalCreateMessageRequest {
  readonly thread_id: string;
  readonly body: string;
}

/**
 * Internal request to update a message.
 */
export interface InternalUpdateMessageRequest {
  readonly body: string;
  readonly expected_updated_at: string;
}

/**
 * Internal query parameters for listing threads.
 * CMT-3 controller maps from public CommentThreadListQuery.
 */
export interface InternalThreadListQuery {
  readonly status?: 'open' | 'resolved';
  readonly section_key?: string;
}

/**
 * Internal response for thread list (uses artifact_id integer).
 */
export interface InternalThreadListResponse {
  readonly artifact_id: number;
  readonly threads: InternalCommentThreadDTO[];
  readonly total_count: number;
}
