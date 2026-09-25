/**
 * Comments Application Service — CMT-1 / CMT-2
 *
 * Orchestrates Workspace Comments: thread creation, replies, editing,
 * resolution, and reopening. Handles authorization based on project
 * membership, thread authorship, and study ownership.
 *
 * CANONICAL ISOLATION: Comments services MUST NOT call or modify:
 * - artifact_sections
 * - artifact_version
 * - Brief/Plan save service
 * - Markdown projector
 * - GitHub sync/projector
 * - approval state/events
 * - artifact canonical content
 */

import type { ApplicationContext } from '../types/application-context';
import type { Transaction } from 'sequelize';
import type { CommentThread } from '../database/models/comment_thread';
import type { CommentMessage } from '../database/models/comment_message';
import type { CommentThreadEvent } from '../database/models/comment_thread_event';
import type { Actor } from '../database/models/actor';
import type { ResearchArtifact } from '../database/models/research_artifact';
import type {
  InternalCommentThreadDTO,
  InternalCommentThreadWithMessagesDTO,
  InternalCommentMessageDTO,
  InternalCommentThreadEventDTO,
  InternalActorSummary,
  InternalThreadPermissions,
  InternalMessagePermissions,
  InternalThreadListResponse,
  InternalCreateThreadRequest,
  InternalCreateMessageRequest,
  InternalUpdateMessageRequest,
} from '../types/comments';
import { isValidSectionKey } from '../types/comments';
import {
  authorizationDenied,
  resourceNotFound,
  validationError,
  commentEditConflict,
  invalidState,
} from '../types/api-errors';
import { assertProjectAccessByActor, isProjectOwner } from '../services/authorization.service';
import sequelize from '../database';

// ─── Model References ──────────────────────────────────────────────────

const CommentThreadModel = sequelize.models.CommentThread as typeof CommentThread;
const CommentMessageModel = sequelize.models.CommentMessage as typeof CommentMessage;
const CommentThreadEventModel = sequelize.models.CommentThreadEvent as typeof CommentThreadEvent;
const ActorModel = sequelize.models.Actor as typeof Actor;
const ArtifactModel = sequelize.models.ResearchArtifact as typeof ResearchArtifact;

// ─── Helper Functions ──────────────────────────────────────────────────

/**
 * Build actor summary for internal response.
 */
function toActorSummary(actor: Actor): InternalActorSummary {
  return {
    id: actor.id,
    public_id: actor.public_id,
    display_name: actor.display_name,
  };
}

/**
 * Compute thread permissions for the current actor.
 */
async function computeThreadPermissions(
  thread: CommentThread,
  actorId: number,
  studyOwnerId: number | null,
): Promise<InternalThreadPermissions> {
  const isAuthor = thread.created_by === actorId;
  const isOwner = studyOwnerId === actorId;

  return {
    can_reply: true, // All project members can reply (checked at service boundary)
    can_resolve: thread.status === 'open' && (isAuthor || isOwner),
    can_reopen: thread.status === 'resolved' && (isAuthor || isOwner),
  };
}

/**
 * Compute message permissions for the current actor.
 */
function computeMessagePermissions(
  message: CommentMessage,
  actorId: number,
): InternalMessagePermissions {
  return {
    can_edit: message.author_id === actorId,
  };
}

/**
 * Get the study owner actor ID (for authorization checks).
 * Returns null if study has no owner or owner is not linked to an actor.
 */
async function getStudyOwnerActorId(studyId: number): Promise<number | null> {
  const StudyModel = sequelize.models.ResearchStudy;
  const study = await StudyModel.findByPk(studyId, {
    attributes: ['id', 'project_id', 'created_by'],
  }) as { project_id: number; created_by: string } | null;

  if (!study || !study.project_id) return null;

  // Check for project owner by Slack user ID (legacy path)
  const ProjectMemberModel = sequelize.models.ProjectMember;
  if (ProjectMemberModel) {
    const owner = await ProjectMemberModel.findOne({
      where: { project_id: study.project_id, role: 'owner' },
    }) as { user_id: string } | null;

    if (owner) {
      // Find actor by Slack identity
      const ActorIdentityModel = sequelize.models.ActorIdentity;
      if (ActorIdentityModel) {
        const identity = await ActorIdentityModel.findOne({
          where: { provider: 'slack', provider_subject: owner.user_id },
        }) as { actor_id: number } | null;

        if (identity) return identity.actor_id;
      }
    }
  }

  // Fallback: check ProjectMembership (actor-based)
  const ProjectMembershipModel = sequelize.models.ProjectMembership;
  if (ProjectMembershipModel) {
    const membership = await ProjectMembershipModel.findOne({
      where: { project_id: study.project_id, role: 'owner' },
    }) as { actor_id: number } | null;

    if (membership) return membership.actor_id;
  }

  return null;
}

/**
 * Transform thread to internal DTO with permissions.
 */
async function toThreadDTO(
  thread: CommentThread,
  actorId: number,
  studyOwnerId: number | null,
  messageCount: number,
): Promise<InternalCommentThreadDTO> {
  const creator = await ActorModel.findByPk(thread.created_by);
  if (!creator) throw resourceNotFound('Thread creator');

  let resolvedByActor: InternalActorSummary | null = null;
  if (thread.resolved_by) {
    const resolver = await ActorModel.findByPk(thread.resolved_by);
    if (resolver) resolvedByActor = toActorSummary(resolver);
  }

  const permissions = await computeThreadPermissions(thread, actorId, studyOwnerId);

  return {
    id: thread.id,
    study_id: thread.study_id,
    artifact_id: thread.artifact_id,
    section_key: thread.section_key,
    status: thread.status,
    creator: toActorSummary(creator),
    created_at: thread.created_at.toISOString(),
    resolved_by: resolvedByActor,
    resolved_at: thread.resolved_at ? thread.resolved_at.toISOString() : null,
    permissions,
    message_count: messageCount,
  };
}

/**
 * Transform message to internal DTO with permissions.
 */
async function toMessageDTO(
  message: CommentMessage,
  actorId: number,
): Promise<InternalCommentMessageDTO> {
  const author = await ActorModel.findByPk(message.author_id);
  if (!author) throw resourceNotFound('Message author');

  const permissions = computeMessagePermissions(message, actorId);

  return {
    id: message.id,
    thread_id: message.thread_id,
    author: toActorSummary(author),
    body: message.body,
    created_at: message.created_at.toISOString(),
    updated_at: message.updated_at.toISOString(),
    permissions,
  };
}

/**
 * Transform event to internal DTO.
 */
async function toEventDTO(event: CommentThreadEvent): Promise<InternalCommentThreadEventDTO> {
  const actor = await ActorModel.findByPk(event.actor_id);
  if (!actor) throw resourceNotFound('Event actor');

  return {
    id: event.id,
    thread_id: event.thread_id,
    event_type: event.event_type,
    actor: toActorSummary(actor),
    created_at: event.created_at.toISOString(),
  };
}

// ─── Service Functions ─────────────────────────────────────────────────

/**
 * List all comment threads for an artifact.
 * Returns threads with message count and computed permissions.
 */
export async function listArtifactCommentThreads(
  ctx: ApplicationContext,
  artifactId: number,
): Promise<InternalThreadListResponse> {
  // Load artifact and verify access
  const artifact = await ArtifactModel.findByPk(artifactId) as ResearchArtifact | null;
  if (!artifact) throw resourceNotFound('Artifact');

  if (!artifact.study_id) {
    throw validationError('Artifact has no associated study');
  }

  // Authorization: actor must have project access
  await assertProjectAccessByActor(ctx.actor.id, artifact.project_id, ctx.organization.id);

  // Get study owner for permission computation
  const studyOwnerId = await getStudyOwnerActorId(artifact.study_id);

  // Fetch all threads for the artifact
  const threads = await CommentThreadModel.findAll({
    where: { artifact_id: artifactId },
    order: [['created_at', 'ASC']],
  }) as CommentThread[];

  // Get message counts for all threads
  const threadDTOs: InternalCommentThreadDTO[] = [];
  for (const thread of threads) {
    const messageCount = await CommentMessageModel.count({
      where: { thread_id: thread.id },
    });
    const dto = await toThreadDTO(thread, ctx.actor.id, studyOwnerId, messageCount);
    threadDTOs.push(dto);
  }

  return {
    artifact_id: artifactId,
    threads: threadDTOs,
    total_count: threadDTOs.length,
  };
}

/**
 * Get a single thread with all messages and events.
 */
export async function getCommentThread(
  ctx: ApplicationContext,
  threadId: string,
): Promise<InternalCommentThreadWithMessagesDTO> {
  const thread = await CommentThreadModel.findByPk(threadId) as CommentThread | null;
  if (!thread) throw resourceNotFound('Thread');

  // Load artifact for authorization
  const artifact = await ArtifactModel.findByPk(thread.artifact_id) as ResearchArtifact | null;
  if (!artifact) throw resourceNotFound('Artifact');

  // Authorization
  await assertProjectAccessByActor(ctx.actor.id, artifact.project_id, ctx.organization.id);

  if (!artifact.study_id) {
    throw validationError('Artifact has no associated study');
  }

  const studyOwnerId = await getStudyOwnerActorId(artifact.study_id);

  // Fetch messages and events
  const messages = await CommentMessageModel.findAll({
    where: { thread_id: threadId },
    order: [['created_at', 'ASC']],
  }) as CommentMessage[];

  const events = await CommentThreadEventModel.findAll({
    where: { thread_id: threadId },
    order: [['created_at', 'ASC']],
  }) as CommentThreadEvent[];

  // Transform to DTOs
  const messageDTOs = await Promise.all(
    messages.map(m => toMessageDTO(m, ctx.actor.id))
  );
  const eventDTOs = await Promise.all(events.map(toEventDTO));

  const baseDTO = await toThreadDTO(thread, ctx.actor.id, studyOwnerId, messages.length);

  return {
    ...baseDTO,
    messages: messageDTOs,
    events: eventDTOs,
  };
}

/**
 * Create a new comment thread with its initial message.
 * Thread and message are created atomically — no empty threads.
 */
export async function createCommentThreadWithInitialMessage(
  ctx: ApplicationContext,
  input: InternalCreateThreadRequest,
): Promise<InternalCommentThreadWithMessagesDTO> {
  // Validate input
  if (!input.body || input.body.trim().length === 0) {
    throw validationError('Message body is required');
  }

  // Load artifact
  const artifact = await ArtifactModel.findByPk(input.artifact_id) as ResearchArtifact | null;
  if (!artifact) throw resourceNotFound('Artifact');

  if (!artifact.study_id) {
    throw validationError('Artifact has no associated study');
  }

  // Authorization: actor must have project access
  await assertProjectAccessByActor(ctx.actor.id, artifact.project_id, ctx.organization.id);

  // Validate section key against artifact type
  if (!isValidSectionKey(artifact.artifact_type, input.section_key)) {
    throw validationError(
      `Invalid section key '${input.section_key}' for artifact type '${artifact.artifact_type}'`,
      { artifact_type: artifact.artifact_type, section_key: input.section_key }
    );
  }

  // Atomic transaction: create thread + message + event
  const t = await sequelize.transaction();
  try {
    // Create thread
    const thread = await CommentThreadModel.create(
      {
        study_id: artifact.study_id,
        artifact_id: input.artifact_id,
        section_key: input.section_key,
        status: 'open',
        created_by: ctx.actor.id,
      },
      { transaction: t }
    ) as CommentThread;

    // Create initial message
    const message = await CommentMessageModel.create(
      {
        thread_id: thread.id,
        author_id: ctx.actor.id,
        body: input.body.trim(),
      },
      { transaction: t }
    ) as CommentMessage;

    // Create 'created' event
    const event = await CommentThreadEventModel.create(
      {
        thread_id: thread.id,
        event_type: 'created',
        actor_id: ctx.actor.id,
      },
      { transaction: t }
    ) as CommentThreadEvent;

    await t.commit();

    // Build response
    const studyOwnerId = await getStudyOwnerActorId(artifact.study_id);
    const threadDTO = await toThreadDTO(thread, ctx.actor.id, studyOwnerId, 1);
    const messageDTO = await toMessageDTO(message, ctx.actor.id);
    const eventDTO = await toEventDTO(event);

    return {
      ...threadDTO,
      messages: [messageDTO],
      events: [eventDTO],
    };
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

/**
 * Add a reply to an existing thread.
 */
export async function replyToCommentThread(
  ctx: ApplicationContext,
  input: InternalCreateMessageRequest,
): Promise<InternalCommentMessageDTO> {
  // Validate input
  if (!input.body || input.body.trim().length === 0) {
    throw validationError('Message body is required');
  }

  // Load thread
  const thread = await CommentThreadModel.findByPk(input.thread_id) as CommentThread | null;
  if (!thread) throw resourceNotFound('Thread');

  // Load artifact for authorization
  const artifact = await ArtifactModel.findByPk(thread.artifact_id) as ResearchArtifact | null;
  if (!artifact) throw resourceNotFound('Artifact');

  // Authorization: actor must have project access
  await assertProjectAccessByActor(ctx.actor.id, artifact.project_id, ctx.organization.id);

  // Create message
  const message = await CommentMessageModel.create({
    thread_id: input.thread_id,
    author_id: ctx.actor.id,
    body: input.body.trim(),
  }) as CommentMessage;

  return toMessageDTO(message, ctx.actor.id);
}

/**
 * Edit an existing message.
 * Uses optimistic concurrency control via expected_updated_at.
 */
export async function editCommentMessage(
  ctx: ApplicationContext,
  messageId: string,
  input: InternalUpdateMessageRequest,
): Promise<InternalCommentMessageDTO> {
  // Validate input
  if (!input.body || input.body.trim().length === 0) {
    throw validationError('Message body is required');
  }

  // Load message
  const message = await CommentMessageModel.findByPk(messageId) as CommentMessage | null;
  if (!message) throw resourceNotFound('Message');

  // Authorization: only the message author can edit
  if (message.author_id !== ctx.actor.id) {
    throw authorizationDenied('Only the message author can edit');
  }

  // Optimistic concurrency check
  const expectedTimestamp = new Date(input.expected_updated_at);
  const storedTimestamp = message.updated_at;

  // Compare timestamps (millisecond precision)
  if (expectedTimestamp.getTime() !== storedTimestamp.getTime()) {
    throw commentEditConflict(
      'Message was modified since you started editing. Please refresh and try again.'
    );
  }

  // Update the message
  await message.update({
    body: input.body.trim(),
    updated_at: new Date(),
  });

  return toMessageDTO(message, ctx.actor.id);
}

/**
 * Resolve a comment thread.
 * Only the thread author or study owner can resolve.
 */
export async function resolveCommentThread(
  ctx: ApplicationContext,
  threadId: string,
): Promise<{ thread: InternalCommentThreadDTO; event: InternalCommentThreadEventDTO }> {
  const thread = await CommentThreadModel.findByPk(threadId) as CommentThread | null;
  if (!thread) throw resourceNotFound('Thread');

  // Load artifact for authorization
  const artifact = await ArtifactModel.findByPk(thread.artifact_id) as ResearchArtifact | null;
  if (!artifact) throw resourceNotFound('Artifact');

  await assertProjectAccessByActor(ctx.actor.id, artifact.project_id, ctx.organization.id);

  if (!artifact.study_id) {
    throw validationError('Artifact has no associated study');
  }

  // Check thread status
  if (thread.status === 'resolved') {
    throw invalidState('Thread is already resolved');
  }

  // Authorization: only thread author or study owner can resolve
  const studyOwnerId = await getStudyOwnerActorId(artifact.study_id);
  const isAuthor = thread.created_by === ctx.actor.id;
  const isOwner = studyOwnerId === ctx.actor.id;

  if (!isAuthor && !isOwner) {
    throw authorizationDenied('Only the thread author or study owner can resolve');
  }

  // Atomic transaction: update thread + insert event
  const t = await sequelize.transaction();
  try {
    await thread.update(
      {
        status: 'resolved',
        resolved_by: ctx.actor.id,
        resolved_at: new Date(),
      },
      { transaction: t }
    );

    const event = await CommentThreadEventModel.create(
      {
        thread_id: threadId,
        event_type: 'resolved',
        actor_id: ctx.actor.id,
      },
      { transaction: t }
    ) as CommentThreadEvent;

    await t.commit();

    const messageCount = await CommentMessageModel.count({ where: { thread_id: threadId } });
    const threadDTO = await toThreadDTO(thread, ctx.actor.id, studyOwnerId, messageCount);
    const eventDTO = await toEventDTO(event);

    return { thread: threadDTO, event: eventDTO };
  } catch (err) {
    await t.rollback();
    throw err;
  }
}

/**
 * Reopen a resolved comment thread.
 * Only the thread author or study owner can reopen.
 */
export async function reopenCommentThread(
  ctx: ApplicationContext,
  threadId: string,
): Promise<{ thread: InternalCommentThreadDTO; event: InternalCommentThreadEventDTO }> {
  const thread = await CommentThreadModel.findByPk(threadId) as CommentThread | null;
  if (!thread) throw resourceNotFound('Thread');

  // Load artifact for authorization
  const artifact = await ArtifactModel.findByPk(thread.artifact_id) as ResearchArtifact | null;
  if (!artifact) throw resourceNotFound('Artifact');

  await assertProjectAccessByActor(ctx.actor.id, artifact.project_id, ctx.organization.id);

  if (!artifact.study_id) {
    throw validationError('Artifact has no associated study');
  }

  // Check thread status
  if (thread.status === 'open') {
    throw invalidState('Thread is already open');
  }

  // Authorization: only thread author or study owner can reopen
  const studyOwnerId = await getStudyOwnerActorId(artifact.study_id);
  const isAuthor = thread.created_by === ctx.actor.id;
  const isOwner = studyOwnerId === ctx.actor.id;

  if (!isAuthor && !isOwner) {
    throw authorizationDenied('Only the thread author or study owner can reopen');
  }

  // Atomic transaction: update thread + insert event
  const t = await sequelize.transaction();
  try {
    // Clear resolution snapshot (historical events remain)
    await thread.update(
      {
        status: 'open',
        resolved_by: null,
        resolved_at: null,
      },
      { transaction: t }
    );

    const event = await CommentThreadEventModel.create(
      {
        thread_id: threadId,
        event_type: 'reopened',
        actor_id: ctx.actor.id,
      },
      { transaction: t }
    ) as CommentThreadEvent;

    await t.commit();

    const messageCount = await CommentMessageModel.count({ where: { thread_id: threadId } });
    const threadDTO = await toThreadDTO(thread, ctx.actor.id, studyOwnerId, messageCount);
    const eventDTO = await toEventDTO(event);

    return { thread: threadDTO, event: eventDTO };
  } catch (err) {
    await t.rollback();
    throw err;
  }
}
