/**
 * Comments API Client — CMT-5
 *
 * Typed API client functions for Workspace Comments.
 * Uses public contract types from @qori/api-contracts.
 */

import { api } from '@/api/client';
import type {
  CommentThreadStatus,
  CommentThreadListResponse,
  CommentThreadDetailResponse,
  CreateCommentThreadResponse,
  CreateCommentMessageResponse,
  UpdateCommentMessageResponse,
  UpdateCommentThreadStatusResponse,
} from '@qori/api-contracts';

// ─── List Comments ─────────────────────────────────────────────────────────

export interface ListCommentsParams {
  artifactPublicId: string;
  status?: CommentThreadStatus;
  sectionKey?: string;
}

/**
 * GET /api/v1/artifacts/:artifactPublicId/comments
 *
 * Lists comment threads for an artifact with optional filtering.
 * Defaults to status=open when status is not specified.
 */
export async function listCommentThreads(
  params: ListCommentsParams,
): Promise<CommentThreadListResponse> {
  const searchParams = new URLSearchParams();

  if (params.status) {
    searchParams.set('status', params.status);
  }
  if (params.sectionKey) {
    searchParams.set('section_key', params.sectionKey);
  }

  const queryString = searchParams.toString();
  const url = `artifacts/${params.artifactPublicId}/comments${queryString ? `?${queryString}` : ''}`;

  const res = await api.get(url).json<{ data: CommentThreadListResponse }>();
  return res.data;
}

// ─── Thread Detail ─────────────────────────────────────────────────────────

/**
 * GET /api/v1/comments/threads/:threadId
 *
 * Retrieves a single thread with all messages and events.
 */
export async function getCommentThread(
  threadId: string,
): Promise<CommentThreadDetailResponse> {
  const res = await api
    .get(`comments/threads/${threadId}`)
    .json<{ data: CommentThreadDetailResponse }>();
  return res.data;
}

// ─── Create Thread ─────────────────────────────────────────────────────────

export interface CreateThreadParams {
  artifactPublicId: string;
  sectionKey: string;
  body: string;
}

/**
 * POST /api/v1/artifacts/:artifactPublicId/comments
 *
 * Creates a new comment thread with its initial message.
 */
export async function createCommentThread(
  params: CreateThreadParams,
): Promise<CreateCommentThreadResponse> {
  const res = await api
    .post(`artifacts/${params.artifactPublicId}/comments`, {
      json: {
        section_key: params.sectionKey,
        body: params.body,
      },
    })
    .json<{ data: CreateCommentThreadResponse }>();
  return res.data;
}

// ─── Reply to Thread ───────────────────────────────────────────────────────

export interface ReplyToThreadParams {
  threadId: string;
  body: string;
}

/**
 * POST /api/v1/comments/threads/:threadId/messages
 *
 * Adds a reply to an existing thread.
 */
export async function replyToCommentThread(
  params: ReplyToThreadParams,
): Promise<CreateCommentMessageResponse> {
  const res = await api
    .post(`comments/threads/${params.threadId}/messages`, {
      json: { body: params.body },
    })
    .json<{ data: CreateCommentMessageResponse }>();
  return res.data;
}

// ─── Edit Message ──────────────────────────────────────────────────────────

export interface EditMessageParams {
  messageId: string;
  body: string;
  expectedUpdatedAt: string;
}

/**
 * PATCH /api/v1/comments/messages/:messageId
 *
 * Edits an existing message with optimistic concurrency control.
 * Returns 409 COMMENT_EDIT_CONFLICT if the message was modified.
 */
export async function editCommentMessage(
  params: EditMessageParams,
): Promise<UpdateCommentMessageResponse> {
  const res = await api
    .patch(`comments/messages/${params.messageId}`, {
      json: {
        body: params.body,
        expected_updated_at: params.expectedUpdatedAt,
      },
    })
    .json<{ data: UpdateCommentMessageResponse }>();
  return res.data;
}

// ─── Resolve Thread ────────────────────────────────────────────────────────

/**
 * POST /api/v1/comments/threads/:threadId/resolve
 *
 * Resolves a comment thread (author or study owner only).
 */
export async function resolveCommentThread(
  threadId: string,
): Promise<UpdateCommentThreadStatusResponse> {
  const res = await api
    .post(`comments/threads/${threadId}/resolve`)
    .json<{ data: UpdateCommentThreadStatusResponse }>();
  return res.data;
}

// ─── Reopen Thread ─────────────────────────────────────────────────────────

/**
 * POST /api/v1/comments/threads/:threadId/reopen
 *
 * Reopens a resolved comment thread (author or study owner only).
 */
export async function reopenCommentThread(
  threadId: string,
): Promise<UpdateCommentThreadStatusResponse> {
  const res = await api
    .post(`comments/threads/${threadId}/reopen`)
    .json<{ data: UpdateCommentThreadStatusResponse }>();
  return res.data;
}
