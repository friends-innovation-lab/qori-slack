/**
 * Discovery Artifact Service — DISC-1
 *
 * Canonical artifact identity and lifecycle management.
 * Per locked decision C: Same run retry = v2, v3; same topic sibling = v1
 * Per locked decision D: GitHub is projection, not canonical
 *
 * Versioning invariant:
 *   - Exactly one current artifact per run/type
 *   - Previous current becomes superseded atomically when replacement succeeds
 *   - Failed retry does NOT supersede current artifact
 *   - Original artifact immutable after supersession
 *   - Version increments monotonically per run
 */

import sequelize from '../database';
import { Op, type Transaction } from 'sequelize';
import type {
  DiscoveryArtifact,
  DiscoveryArtifactType,
  DiscoveryArtifactStatus,
} from '../database/models/discovery_artifact';
import type { CreationAttributes } from 'sequelize';

const DiscoveryArtifactModel = sequelize.models.DiscoveryArtifact as typeof DiscoveryArtifact;

// ─── Input Types ─────────────────────────────────────────────────────────────

export interface CreateDiscoveryArtifactInput {
  projectId: number;
  discoveryRunId: number | null;
  artifactType: DiscoveryArtifactType;
  title: string;
  topicSlug: string;
  canonicalContent: string | null;
  templateName: string;
  templateVersion: string | null;
  derivationFingerprint: string | null;
  actorId: number | null;
  generatedByIdentity: string;
}

export interface ProjectionMetadata {
  githubPath: string;
  githubSha: string | null;
}

// ─── Error Types ─────────────────────────────────────────────────────────────

export class DiscoveryArtifactNotFoundError extends Error {
  constructor(artifactId: number | string) {
    super(`Discovery artifact not found: ${artifactId}`);
    this.name = 'DiscoveryArtifactNotFoundError';
  }
}

export class DiscoveryArtifactStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscoveryArtifactStateError';
  }
}

// ─── Create ──────────────────────────────────────────────────────────────────

/**
 * Create a new DiscoveryArtifact in 'generating' state.
 *
 * Per locked decision C:
 * - If this run already has a current artifact, the new one becomes v(N+1)
 * - The previous current artifact is NOT superseded yet (happens on success)
 *
 * Artifacts start in 'generating' state to allow concurrent generation.
 * Call markArtifactCurrent() after successful generation to finalize.
 */
export async function createDiscoveryArtifact(
  input: CreateDiscoveryArtifactInput,
  transaction?: Transaction,
): Promise<DiscoveryArtifact> {
  // Determine version: find highest version for this run and increment
  let version = 1;

  if (input.discoveryRunId) {
    const existingMax = await DiscoveryArtifactModel.max('version', {
      where: { discovery_run_id: input.discoveryRunId },
      transaction,
    });

    if (existingMax && typeof existingMax === 'number') {
      version = existingMax + 1;
    }
  }

  const artifact = await DiscoveryArtifactModel.create(
    {
      project_id: input.projectId,
      discovery_run_id: input.discoveryRunId,
      artifact_type: input.artifactType,
      title: input.title,
      topic_slug: input.topicSlug,
      version,
      status: 'generating',
      canonical_content: input.canonicalContent,
      template_name: input.templateName,
      template_version: input.templateVersion,
      derivation_fingerprint: input.derivationFingerprint,
      actor_id: input.actorId,
      generated_by_identity: input.generatedByIdentity,
    } as CreationAttributes<DiscoveryArtifact>,
    { transaction },
  );

  return artifact;
}

/**
 * Mark a generating artifact as current.
 *
 * Use this after canonical content is successfully persisted.
 * For artifacts without a run (historical import), this just sets status.
 * For artifacts with a run, use finalizeArtifactSupersession() instead.
 */
export async function markArtifactCurrent(
  artifactId: number,
  transaction?: Transaction,
): Promise<DiscoveryArtifact> {
  const artifact = await DiscoveryArtifactModel.findByPk(artifactId, {
    transaction,
  });

  if (!artifact) {
    throw new DiscoveryArtifactNotFoundError(artifactId);
  }

  if (artifact.status !== 'generating') {
    throw new DiscoveryArtifactStateError(
      `Cannot mark artifact ${artifactId} as current: status is '${artifact.status}', expected 'generating'`,
    );
  }

  await artifact.update(
    {
      status: 'current',
      updated_at: new Date(),
    },
    { transaction },
  );

  return artifact;
}

/**
 * Finalize artifact creation: mark as current and supersede previous.
 *
 * Per locked decision C:
 * - Previous current becomes superseded atomically when replacement succeeds
 * - Failed retry does NOT supersede current artifact
 *
 * Call this AFTER canonical content is successfully persisted.
 * This atomically:
 * 1. Marks the new artifact as 'current'
 * 2. Supersedes any previous 'current' artifact(s) for this run
 */
export async function finalizeArtifactSupersession(
  newArtifactId: number,
  transaction?: Transaction,
): Promise<void> {
  const t = transaction ?? (await sequelize.transaction());
  const shouldCommit = !transaction;

  try {
    const newArtifact = await DiscoveryArtifactModel.findByPk(newArtifactId, {
      transaction: t,
    });

    if (!newArtifact) {
      throw new DiscoveryArtifactNotFoundError(newArtifactId);
    }

    if (newArtifact.status !== 'generating') {
      throw new DiscoveryArtifactStateError(
        `Cannot finalize artifact ${newArtifactId}: status is '${newArtifact.status}', expected 'generating'`,
      );
    }

    // Find and supersede previous current artifact(s) for this run
    if (newArtifact.discovery_run_id) {
      const previousArtifacts = await DiscoveryArtifactModel.findAll({
        where: {
          discovery_run_id: newArtifact.discovery_run_id,
          status: 'current',
        },
        transaction: t,
      });

      const now = new Date();
      for (const prev of previousArtifacts) {
        await prev.update(
          {
            status: 'superseded',
            superseded_by_id: newArtifactId,
            superseded_at: now,
            updated_at: now,
          },
          { transaction: t },
        );
      }
    }

    // Mark new artifact as current
    await newArtifact.update(
      {
        status: 'current',
        updated_at: new Date(),
      },
      { transaction: t },
    );

    if (shouldCommit) {
      await t.commit();
    }
  } catch (error) {
    if (shouldCommit) {
      await t.rollback();
    }
    throw error;
  }
}

/**
 * Mark artifact as failed.
 *
 * Per locked decision C:
 * - Failed retry does NOT supersede current artifact
 * - The artifact is marked failed, not deleted
 */
export async function markArtifactFailed(
  artifactId: number,
  transaction?: Transaction,
): Promise<DiscoveryArtifact> {
  const artifact = await DiscoveryArtifactModel.findByPk(artifactId, {
    transaction,
  });

  if (!artifact) {
    throw new DiscoveryArtifactNotFoundError(artifactId);
  }

  await artifact.update(
    {
      status: 'failed',
      updated_at: new Date(),
    },
    { transaction },
  );

  return artifact;
}

// ─── Projection ──────────────────────────────────────────────────────────────

/**
 * Record GitHub projection metadata.
 *
 * Per locked decision D: GitHub is projection, not canonical.
 * This records WHERE the artifact was projected, not the canonical content.
 */
export async function recordProjection(
  artifactId: number,
  metadata: ProjectionMetadata,
  transaction?: Transaction,
): Promise<DiscoveryArtifact> {
  const artifact = await DiscoveryArtifactModel.findByPk(artifactId, {
    transaction,
  });

  if (!artifact) {
    throw new DiscoveryArtifactNotFoundError(artifactId);
  }

  await artifact.update(
    {
      github_path: metadata.githubPath,
      github_sha: metadata.githubSha,
      projected_at: new Date(),
      projection_error: null,
      updated_at: new Date(),
    },
    { transaction },
  );

  return artifact;
}

/**
 * Record projection failure.
 *
 * Per locked decision D (failure semantics):
 * - Canonical artifact remains valid even if projection fails
 * - Projection failure does not affect artifact status
 */
export async function recordProjectionError(
  artifactId: number,
  error: string,
  transaction?: Transaction,
): Promise<DiscoveryArtifact> {
  const artifact = await DiscoveryArtifactModel.findByPk(artifactId, {
    transaction,
  });

  if (!artifact) {
    throw new DiscoveryArtifactNotFoundError(artifactId);
  }

  await artifact.update(
    {
      projection_error: error,
      updated_at: new Date(),
    },
    { transaction },
  );

  return artifact;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Get artifact by ID.
 */
export async function getDiscoveryArtifactById(
  artifactId: number,
  transaction?: Transaction,
): Promise<DiscoveryArtifact | null> {
  return DiscoveryArtifactModel.findByPk(artifactId, { transaction });
}

/**
 * Get artifact by public_id.
 */
export async function getDiscoveryArtifactByPublicId(
  publicId: string,
  transaction?: Transaction,
): Promise<DiscoveryArtifact | null> {
  return DiscoveryArtifactModel.findOne({
    where: { public_id: publicId },
    transaction,
  });
}

/**
 * Get current artifact for a run.
 */
export async function getCurrentArtifactForRun(
  runId: number,
  transaction?: Transaction,
): Promise<DiscoveryArtifact | null> {
  return DiscoveryArtifactModel.findOne({
    where: {
      discovery_run_id: runId,
      status: 'current',
    },
    transaction,
  });
}

/**
 * List current artifacts for a project.
 */
export async function listCurrentArtifactsByProject(
  projectId: number,
  options?: {
    artifactType?: DiscoveryArtifactType;
    limit?: number;
    offset?: number;
  },
  transaction?: Transaction,
): Promise<DiscoveryArtifact[]> {
  const where: Record<string, unknown> = {
    project_id: projectId,
    status: 'current',
  };

  if (options?.artifactType) {
    where.artifact_type = options.artifactType;
  }

  return DiscoveryArtifactModel.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit: options?.limit,
    offset: options?.offset,
    transaction,
  });
}

/**
 * List all artifacts for a project (including superseded).
 */
export async function listAllArtifactsByProject(
  projectId: number,
  options?: {
    status?: DiscoveryArtifactStatus;
    artifactType?: DiscoveryArtifactType;
    limit?: number;
    offset?: number;
  },
  transaction?: Transaction,
): Promise<DiscoveryArtifact[]> {
  const where: Record<string, unknown> = { project_id: projectId };

  if (options?.status) {
    where.status = options.status;
  }
  if (options?.artifactType) {
    where.artifact_type = options.artifactType;
  }

  return DiscoveryArtifactModel.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit: options?.limit,
    offset: options?.offset,
    transaction,
  });
}

/**
 * Get artifact history for a run (all versions).
 */
export async function getArtifactHistoryForRun(
  runId: number,
  transaction?: Transaction,
): Promise<DiscoveryArtifact[]> {
  return DiscoveryArtifactModel.findAll({
    where: { discovery_run_id: runId },
    order: [['version', 'DESC']],
    transaction,
  });
}

// ─── Historical Backfill ─────────────────────────────────────────────────────

/**
 * Create artifact for historical import (no run lineage).
 *
 * Per locked decision on backfill:
 * - discovery_run_id = NULL for imported artifacts
 * - version = 1
 * - status = 'current'
 */
export async function createHistoricalArtifact(
  input: Omit<CreateDiscoveryArtifactInput, 'discoveryRunId'>,
  transaction?: Transaction,
): Promise<DiscoveryArtifact> {
  const artifact = await DiscoveryArtifactModel.create(
    {
      project_id: input.projectId,
      discovery_run_id: null,
      artifact_type: input.artifactType,
      title: input.title,
      topic_slug: input.topicSlug,
      version: 1,
      status: 'current',
      canonical_content: input.canonicalContent,
      template_name: input.templateName,
      template_version: input.templateVersion,
      derivation_fingerprint: input.derivationFingerprint,
      actor_id: input.actorId,
      generated_by_identity: input.generatedByIdentity,
    } as CreationAttributes<DiscoveryArtifact>,
    { transaction },
  );

  return artifact;
}
