/**
 * Comments Routes — CMT-3
 *
 * REST API endpoints for Workspace Comments.
 *
 * PUBLIC ID BOUNDARY: Routes receive and return public UUIDs only.
 * Internal integer IDs never cross the API boundary. The mapping layer
 * translates artifact_public_id → artifact_id on input and
 * study_id → study_public_id on output.
 *
 * Routes:
 * - GET  /api/v1/artifacts/:artifactPublicId/comments     → List threads
 * - POST /api/v1/artifacts/:artifactPublicId/comments     → Create thread
 * - GET  /api/v1/comments/threads/:threadId               → Get thread detail
 * - POST /api/v1/comments/threads/:threadId/messages      → Reply to thread
 * - PATCH /api/v1/comments/messages/:messageId            → Edit message
 * - POST /api/v1/comments/threads/:threadId/resolve       → Resolve thread
 * - POST /api/v1/comments/threads/:threadId/reopen        → Reopen thread
 */

import { Router } from 'express';
import { requireAuth } from '../../../middleware/auth';
import * as commentsAppService from '../../../application/comments.app-service';
import type {
  CommentThreadResource,
  CommentThreadDetailResource,
  CommentMessageResource,
  CommentThreadEventResource,
  CommentAuthorSummary,
  CommentThreadListResponse,
  CommentThreadDetailResponse,
  CreateCommentThreadResponse,
  CreateCommentMessageResponse,
  UpdateCommentMessageResponse,
  UpdateCommentThreadStatusResponse,
  CommentThreadPermissions,
  CommentMessagePermissions,
  CreateCommentThreadInput,
  UpdateCommentMessageInput,
} from '../../../types/comments';
import type {
  InternalCommentThreadDTO,
  InternalCommentThreadWithMessagesDTO,
  InternalCommentMessageDTO,
  InternalCommentThreadEventDTO,
  InternalActorSummary,
  InternalThreadListResponse,
} from '../../../types/comments';
import { resourceNotFound, validationError } from '../../../types/api-errors';
import sequelize from '../../../database';
import type { ResearchArtifact } from '../../../database/models/research_artifact';
import type { ResearchStudy } from '../../../database/models/research_study';

const router = Router();

const ArtifactModel = sequelize.models.ResearchArtifact as typeof ResearchArtifact;
const StudyModel = sequelize.models.ResearchStudy as typeof ResearchStudy;

// ─── Public ID Lookup Helpers ──────────────────────────────────────────────

/**
 * Look up artifact by public ID, return internal ID.
 */
async function resolveArtifactId(publicId: string): Promise<number> {
  const artifact = await ArtifactModel.findOne({
    where: { public_id: publicId },
    attributes: ['id'],
  }) as { id: number } | null;

  if (!artifact) {
    throw resourceNotFound('Artifact');
  }

  return artifact.id;
}

/**
 * Look up study public ID by internal study ID.
 */
async function resolveStudyPublicId(studyId: number): Promise<string> {
  const study = await StudyModel.findByPk(studyId, {
    attributes: ['public_id'],
  }) as { public_id: string } | null;

  if (!study) {
    throw resourceNotFound('Study');
  }

  return study.public_id;
}

/**
 * Look up artifact public ID by internal artifact ID.
 */
async function resolveArtifactPublicId(artifactId: number): Promise<string> {
  const artifact = await ArtifactModel.findByPk(artifactId, {
    attributes: ['public_id'],
  }) as { public_id: string } | null;

  if (!artifact) {
    throw resourceNotFound('Artifact');
  }

  return artifact.public_id;
}

// ─── DTO → Resource Mappers ────────────────────────────────────────────────

/**
 * Map internal actor summary to public author summary.
 * Strips internal `id`, keeps only `public_id` and `display_name`.
 */
function toAuthorSummary(internal: InternalActorSummary): CommentAuthorSummary {
  return {
    public_id: internal.public_id,
    display_name: internal.display_name,
  };
}

/**
 * Map internal thread DTO to public resource.
 */
async function toThreadResource(
  internal: InternalCommentThreadDTO,
): Promise<CommentThreadResource> {
  const [studyPublicId, artifactPublicId] = await Promise.all([
    resolveStudyPublicId(internal.study_id),
    resolveArtifactPublicId(internal.artifact_id),
  ]);

  return {
    id: internal.id,
    study_public_id: studyPublicId,
    artifact_public_id: artifactPublicId,
    section_key: internal.section_key,
    status: internal.status,
    creator: toAuthorSummary(internal.creator),
    created_at: internal.created_at,
    resolved_by: internal.resolved_by ? toAuthorSummary(internal.resolved_by) : null,
    resolved_at: internal.resolved_at,
    permissions: internal.permissions as CommentThreadPermissions,
    message_count: internal.message_count,
  };
}

/**
 * Map internal message DTO to public resource.
 */
function toMessageResource(internal: InternalCommentMessageDTO): CommentMessageResource {
  return {
    id: internal.id,
    thread_id: internal.thread_id,
    author: toAuthorSummary(internal.author),
    body: internal.body,
    created_at: internal.created_at,
    updated_at: internal.updated_at,
    permissions: internal.permissions as CommentMessagePermissions,
  };
}

/**
 * Map internal event DTO to public resource.
 */
function toEventResource(internal: InternalCommentThreadEventDTO): CommentThreadEventResource {
  return {
    id: internal.id,
    thread_id: internal.thread_id,
    event_type: internal.event_type,
    actor: toAuthorSummary(internal.actor),
    created_at: internal.created_at,
  };
}

/**
 * Map internal thread with messages to public detail resource.
 */
async function toThreadDetailResource(
  internal: InternalCommentThreadWithMessagesDTO,
): Promise<CommentThreadDetailResource> {
  const base = await toThreadResource(internal);
  return {
    ...base,
    messages: internal.messages.map(toMessageResource),
    events: internal.events.map(toEventResource),
  };
}

// ─── Route Handlers ────────────────────────────────────────────────────────

/**
 * GET /api/v1/artifacts/:artifactPublicId/comments
 * List all comment threads for an artifact.
 */
router.get('/artifacts/:artifactPublicId/comments', requireAuth, async (req, res, next) => {
  try {
    const artifactPublicId = req.params.artifactPublicId as string;
    const artifactId = await resolveArtifactId(artifactPublicId);

    const internalResult = await commentsAppService.listArtifactCommentThreads(
      req.ctx!,
      artifactId,
    );

    // Map all threads to public resources
    const threads = await Promise.all(
      internalResult.threads.map(toThreadResource),
    );

    const response: CommentThreadListResponse = {
      artifact_public_id: artifactPublicId,
      threads,
      total_count: internalResult.total_count,
    };

    res.json({ data: response });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/artifacts/:artifactPublicId/comments
 * Create a new comment thread with its initial message.
 */
router.post('/artifacts/:artifactPublicId/comments', requireAuth, async (req, res, next) => {
  try {
    const artifactPublicId = req.params.artifactPublicId as string;
    const input = req.body as CreateCommentThreadInput;

    // Validate input
    if (!input.section_key) {
      throw validationError('section_key is required');
    }
    if (!input.body || typeof input.body !== 'string') {
      throw validationError('body is required and must be a string');
    }

    // Verify artifact_public_id matches route param
    if (input.artifact_public_id && input.artifact_public_id !== artifactPublicId) {
      throw validationError(
        'artifact_public_id in body must match route parameter',
        { route: artifactPublicId, body: input.artifact_public_id },
      );
    }

    const artifactId = await resolveArtifactId(artifactPublicId);

    const internalResult = await commentsAppService.createCommentThreadWithInitialMessage(
      req.ctx!,
      {
        artifact_id: artifactId,
        section_key: input.section_key,
        body: input.body,
      },
    );

    const thread = await toThreadDetailResource(internalResult);

    const response: CreateCommentThreadResponse = { thread };
    res.status(201).json({ data: response });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/comments/threads/:threadId
 * Get a single thread with all messages and events.
 */
router.get('/comments/threads/:threadId', requireAuth, async (req, res, next) => {
  try {
    const threadId = req.params.threadId as string;

    const internalResult = await commentsAppService.getCommentThread(req.ctx!, threadId);
    const thread = await toThreadDetailResource(internalResult);

    const response: CommentThreadDetailResponse = { thread };
    res.json({ data: response });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/comments/threads/:threadId/messages
 * Add a reply to an existing thread.
 */
router.post('/comments/threads/:threadId/messages', requireAuth, async (req, res, next) => {
  try {
    const threadId = req.params.threadId as string;
    const { body } = req.body as { body?: string };

    if (!body || typeof body !== 'string') {
      throw validationError('body is required and must be a string');
    }

    const internalResult = await commentsAppService.replyToCommentThread(req.ctx!, {
      thread_id: threadId,
      body,
    });

    const message = toMessageResource(internalResult);

    const response: CreateCommentMessageResponse = { message };
    res.status(201).json({ data: response });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/v1/comments/messages/:messageId
 * Edit an existing message (author only, with optimistic concurrency).
 */
router.patch('/comments/messages/:messageId', requireAuth, async (req, res, next) => {
  try {
    const messageId = req.params.messageId as string;
    const input = req.body as UpdateCommentMessageInput;

    if (!input.body || typeof input.body !== 'string') {
      throw validationError('body is required and must be a string');
    }
    if (!input.expected_updated_at || typeof input.expected_updated_at !== 'string') {
      throw validationError('expected_updated_at is required for optimistic concurrency');
    }

    const internalResult = await commentsAppService.editCommentMessage(req.ctx!, messageId, {
      body: input.body,
      expected_updated_at: input.expected_updated_at,
    });

    const message = toMessageResource(internalResult);

    const response: UpdateCommentMessageResponse = { message };
    res.json({ data: response });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/comments/threads/:threadId/resolve
 * Resolve a comment thread (author or study owner only).
 */
router.post('/comments/threads/:threadId/resolve', requireAuth, async (req, res, next) => {
  try {
    const threadId = req.params.threadId as string;

    const internalResult = await commentsAppService.resolveCommentThread(req.ctx!, threadId);

    const thread = await toThreadResource(internalResult.thread);
    const event = toEventResource(internalResult.event);

    const response: UpdateCommentThreadStatusResponse = { thread, event };
    res.json({ data: response });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/comments/threads/:threadId/reopen
 * Reopen a resolved comment thread (author or study owner only).
 */
router.post('/comments/threads/:threadId/reopen', requireAuth, async (req, res, next) => {
  try {
    const threadId = req.params.threadId as string;

    const internalResult = await commentsAppService.reopenCommentThread(req.ctx!, threadId);

    const thread = await toThreadResource(internalResult.thread);
    const event = toEventResource(internalResult.event);

    const response: UpdateCommentThreadStatusResponse = { thread, event };
    res.json({ data: response });
  } catch (error) {
    next(error);
  }
});

export default router;
