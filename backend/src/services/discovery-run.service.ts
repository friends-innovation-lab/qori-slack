/**
 * Discovery Run Service — DISC-1
 *
 * Lifecycle management for DiscoveryRun entities.
 * Per locked decision A: Run is created and persisted BEFORE long-running analysis.
 *
 * State transitions:
 *   pending → processing → completed | failed
 *   pending → cancelled
 *   failed → pending (retry)
 */

import sequelize from '../database';
import type { Transaction } from 'sequelize';
import type {
  DiscoveryRun,
  DiscoveryType,
  DiscoveryRunStatus,
  SurveyStage,
} from '../database/models/discovery_run';
import type { DiscoveryRunSource } from '../database/models/discovery_run_source';
import type { EvidenceSource } from '../database/models/evidence_source';
import type { CreationAttributes } from 'sequelize';

const DiscoveryRunModel = sequelize.models.DiscoveryRun as typeof DiscoveryRun;
const DiscoveryRunSourceModel = sequelize.models.DiscoveryRunSource as typeof DiscoveryRunSource;

// ─── Input Types ─────────────────────────────────────────────────────────────

export interface CreateDiscoveryRunInput {
  projectId: number;
  discoveryType: DiscoveryType;
  topic: string;
  topicSlug: string;
  sourceIntent: string | null;
  actorId: number | null;
  createdByIdentity: string;
  /** Survey-specific: initial stage */
  stage?: SurveyStage | null;
}

export interface AssociateSourcesInput {
  runId: number;
  sourceIds: number[];
}

// ─── Error Types ─────────────────────────────────────────────────────────────

export class DiscoveryRunNotFoundError extends Error {
  constructor(runId: number | string) {
    super(`Discovery run not found: ${runId}`);
    this.name = 'DiscoveryRunNotFoundError';
  }
}

export class DiscoveryRunStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscoveryRunStateError';
  }
}

// ─── Create ──────────────────────────────────────────────────────────────────

/**
 * Create a new DiscoveryRun in pending state.
 * Per locked decision A: Run identity exists BEFORE execution begins.
 */
export async function createDiscoveryRun(
  input: CreateDiscoveryRunInput,
  transaction?: Transaction,
): Promise<DiscoveryRun> {
  const run = await DiscoveryRunModel.create(
    {
      project_id: input.projectId,
      discovery_type: input.discoveryType,
      topic: input.topic,
      topic_slug: input.topicSlug,
      source_intent: input.sourceIntent,
      actor_id: input.actorId,
      created_by_identity: input.createdByIdentity,
      status: 'pending',
      stage: input.stage ?? null,
      attempt_count: 1,
    } as CreationAttributes<DiscoveryRun>,
    { transaction },
  );

  return run;
}

/**
 * Associate EvidenceSource(s) with a DiscoveryRun.
 * Sources are ordered by the order of sourceIds array.
 */
export async function associateSources(
  input: AssociateSourcesInput,
  transaction?: Transaction,
): Promise<DiscoveryRunSource[]> {
  const associations: DiscoveryRunSource[] = [];

  for (let i = 0; i < input.sourceIds.length; i++) {
    const assoc = await DiscoveryRunSourceModel.create(
      {
        discovery_run_id: input.runId,
        evidence_source_id: input.sourceIds[i],
        source_order: i,
      } as CreationAttributes<DiscoveryRunSource>,
      { transaction },
    );
    associations.push(assoc);
  }

  return associations;
}

// ─── State Transitions ───────────────────────────────────────────────────────

/**
 * Transition run from pending → processing.
 * Sets started_at timestamp.
 */
export async function startDiscoveryRun(
  runId: number,
  transaction?: Transaction,
): Promise<DiscoveryRun> {
  const run = await DiscoveryRunModel.findByPk(runId, { transaction });
  if (!run) {
    throw new DiscoveryRunNotFoundError(runId);
  }

  if (run.status !== 'pending') {
    throw new DiscoveryRunStateError(
      `Cannot start run ${runId}: current status is '${run.status}', expected 'pending'`,
    );
  }

  await run.update(
    {
      status: 'processing',
      started_at: new Date(),
      updated_at: new Date(),
    },
    { transaction },
  );

  return run;
}

/**
 * Mark run as processing (alias for startDiscoveryRun).
 */
export const markDiscoveryRunProcessing = startDiscoveryRun;

/**
 * Transition run from processing → completed.
 * Sets completed_at timestamp.
 */
export async function completeDiscoveryRun(
  runId: number,
  transaction?: Transaction,
): Promise<DiscoveryRun> {
  const run = await DiscoveryRunModel.findByPk(runId, { transaction });
  if (!run) {
    throw new DiscoveryRunNotFoundError(runId);
  }

  if (run.status !== 'processing') {
    throw new DiscoveryRunStateError(
      `Cannot complete run ${runId}: current status is '${run.status}', expected 'processing'`,
    );
  }

  await run.update(
    {
      status: 'completed',
      completed_at: new Date(),
      updated_at: new Date(),
      // Clear any previous failure state
      failure_code: null,
      failure_message: null,
      failure_stage: null,
    },
    { transaction },
  );

  return run;
}

/**
 * Transition run from processing → failed.
 * Records failure details.
 */
export async function failDiscoveryRun(
  runId: number,
  failureCode: string,
  failureMessage: string,
  failureStage?: string,
  transaction?: Transaction,
): Promise<DiscoveryRun> {
  const run = await DiscoveryRunModel.findByPk(runId, { transaction });
  if (!run) {
    throw new DiscoveryRunNotFoundError(runId);
  }

  if (run.status !== 'processing') {
    throw new DiscoveryRunStateError(
      `Cannot fail run ${runId}: current status is '${run.status}', expected 'processing'`,
    );
  }

  // Sanitize failure message (remove potential PII)
  const sanitizedMessage = sanitizeFailureMessage(failureMessage);

  await run.update(
    {
      status: 'failed',
      completed_at: new Date(),
      updated_at: new Date(),
      failure_code: failureCode,
      failure_message: sanitizedMessage,
      failure_stage: failureStage ?? null,
    },
    { transaction },
  );

  return run;
}

/**
 * Retry a failed run.
 * Increments attempt_count and transitions back to pending.
 */
export async function retryDiscoveryRun(
  runId: number,
  transaction?: Transaction,
): Promise<DiscoveryRun> {
  const run = await DiscoveryRunModel.findByPk(runId, { transaction });
  if (!run) {
    throw new DiscoveryRunNotFoundError(runId);
  }

  if (run.status !== 'failed') {
    throw new DiscoveryRunStateError(
      `Cannot retry run ${runId}: current status is '${run.status}', expected 'failed'`,
    );
  }

  await run.update(
    {
      status: 'pending',
      updated_at: new Date(),
      started_at: null,
      completed_at: null,
      attempt_count: run.attempt_count + 1,
      // Keep failure details for history until next execution clears them
    },
    { transaction },
  );

  return run;
}

/**
 * Cancel a pending run.
 */
export async function cancelDiscoveryRun(
  runId: number,
  transaction?: Transaction,
): Promise<DiscoveryRun> {
  const run = await DiscoveryRunModel.findByPk(runId, { transaction });
  if (!run) {
    throw new DiscoveryRunNotFoundError(runId);
  }

  if (run.status !== 'pending') {
    throw new DiscoveryRunStateError(
      `Cannot cancel run ${runId}: current status is '${run.status}', expected 'pending'`,
    );
  }

  await run.update(
    {
      status: 'cancelled',
      updated_at: new Date(),
    },
    { transaction },
  );

  return run;
}

// ─── Survey Stage Updates ────────────────────────────────────────────────────

/**
 * Update survey workflow stage.
 * Only valid for survey_synthesis runs in processing state.
 */
export async function updateSurveyStage(
  runId: number,
  stage: SurveyStage,
  transaction?: Transaction,
): Promise<DiscoveryRun> {
  const run = await DiscoveryRunModel.findByPk(runId, { transaction });
  if (!run) {
    throw new DiscoveryRunNotFoundError(runId);
  }

  if (run.discovery_type !== 'survey_synthesis') {
    throw new DiscoveryRunStateError(
      `Cannot update stage for run ${runId}: not a survey_synthesis run`,
    );
  }

  await run.update(
    {
      stage,
      updated_at: new Date(),
    },
    { transaction },
  );

  return run;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Get run by ID (internal PK).
 */
export async function getDiscoveryRunById(
  runId: number,
  transaction?: Transaction,
): Promise<DiscoveryRun | null> {
  return DiscoveryRunModel.findByPk(runId, { transaction });
}

/**
 * Get run by public_id.
 */
export async function getDiscoveryRunByPublicId(
  publicId: string,
  transaction?: Transaction,
): Promise<DiscoveryRun | null> {
  return DiscoveryRunModel.findOne({
    where: { public_id: publicId },
    transaction,
  });
}

/**
 * Get run with associated sources.
 */
export async function getDiscoveryRunWithSources(
  runId: number,
  transaction?: Transaction,
): Promise<DiscoveryRun | null> {
  return DiscoveryRunModel.findByPk(runId, {
    include: [
      {
        model: sequelize.models.DiscoveryRunSource,
        as: 'sources',
        include: [
          {
            model: sequelize.models.EvidenceSource,
            as: 'evidenceSource',
          },
        ],
      },
    ],
    transaction,
  });
}

/**
 * List runs for a project.
 */
export async function listDiscoveryRunsByProject(
  projectId: number,
  options?: {
    status?: DiscoveryRunStatus;
    discoveryType?: DiscoveryType;
    limit?: number;
    offset?: number;
  },
  transaction?: Transaction,
): Promise<DiscoveryRun[]> {
  const where: Record<string, unknown> = { project_id: projectId };

  if (options?.status) {
    where.status = options.status;
  }
  if (options?.discoveryType) {
    where.discovery_type = options.discoveryType;
  }

  return DiscoveryRunModel.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit: options?.limit,
    offset: options?.offset,
    transaction,
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Sanitize failure message to remove potential PII.
 */
function sanitizeFailureMessage(message: string): string {
  // Remove email patterns
  let sanitized = message.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');

  // Remove phone patterns
  sanitized = sanitized.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');

  // Remove Slack user IDs (but keep for debugging)
  sanitized = sanitized.replace(/\bU[A-Z0-9]{8,}\b/g, '[USER_ID]');

  // Truncate to reasonable length
  if (sanitized.length > 2000) {
    sanitized = sanitized.substring(0, 2000) + '... [truncated]';
  }

  return sanitized;
}
