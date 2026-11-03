/**
 * Discovery Application Service — PLAT-3 + DISC-1 + DISC-2
 *
 * Orchestrates discovery research workflows with surface-independent execution.
 *
 * DISC-1 integration:
 * - DiscoveryRun created BEFORE long-running analysis (locked decision A)
 * - EvidenceSource created for each uploaded document
 * - DiscoveryArtifact created with canonical content (locked decision D)
 * - GitHub is projection, not canonical
 *
 * DISC-2 split:
 * - createPendingDiscoveryRun: Creates run + sources, returns immediately
 * - executeDiscoveryRun: Worker execution (claims run, executes, completes)
 * - executeDiscovery: Legacy sync path for Slack (combines both)
 *
 * Slack handler → createPendingDiscoveryRun (or executeDiscovery for sync)
 * REST API → createPendingDiscoveryRun → worker claims → executeDiscoveryRun
 */

import type { ApplicationContext } from '../types/application-context';
import type {
  DiscoveryTypeKey,
  PreparedDiscoverySource,
  CreateDiscoveryRunInput,
  DiscoveryRunSummary,
  DiscoveryRunDetail,
  DiscoveryArtifactSummary,
  DiscoveryArtifactDetail,
  DiscoveryExecutionResult,
  DiscoveryArtifactVariables,
  DiscoveryVariableItem,
  DiscoveryKnowledgeGap,
  DiscoveryKnowledgeGapsResponse,
} from '../types/discovery';
import { VARIABLE_LABELS } from '../types/discovery';
import { format } from 'date-fns';
import { assertProjectAccessByActor } from '../services/authorization.service';
import { getProjectById } from '../services/project.service';
import { loadDiscoveryArtifacts, type DiscoveryArtifact } from '../helpers/discoveryLoader';
import { getConfigRepo, YAML_TEMPLATE_PATH, fetchFileFromRepo, createOrUpdateFileOnGitHub, fetchFileFromRepoByPath } from '../helpers/github';
import { processYamlTemplate, extractAndPersistDiscoveryVariables, type ExtractionOutcome } from '../helpers/yamlProcessor';
import type { EmitSpec } from '../helpers/variableExtractor';
import { parseDocuments, validateDocuments } from '../helpers/documentParser';
import type { VariableContext } from '../helpers/studyVariables';
import yaml from 'js-yaml';
import { authorizeForModel, scanForPii } from '../services/content-governance.service';
import * as runService from '../services/discovery-run.service';
import * as artifactService from '../services/discovery-artifact.service';
import * as evidenceService from '../services/evidence-source.service';
import * as claimService from '../services/discovery-claim.service';
import * as insightExtractionService from '../services/insight-extraction.service';
import { formatMarker } from '../services/discovery-marker.service';
import type { DiscoveryType, DiscoveryRun } from '../database/models/discovery_run';
import type { EvidenceSource } from '../database/models/evidence_source';
import sequelize from '../database';
import { Op } from 'sequelize';
import {
  runInControlledContext,
  type ControlledExecutionContext,
} from '../context/controlledExecutionContext';
import { ApiErrorCode } from '../types/api-errors';

// Re-export types for external consumers
export type { DiscoveryTypeKey, PreparedDiscoverySource, CreateDiscoveryRunInput };

// ─── Legacy Types (preserved for backward compatibility) ─────────

export interface DiscoveryInput {
  /** Project context */
  projectId: number;
  projectSlug: string;

  /** Discovery type */
  discoveryType: DiscoveryTypeKey;

  /** Form fields */
  topic: string;
  description: string | null;

  /** Processed document content (already extracted from files) */
  documents: DocumentInput[];

  /** Actor info */
  createdByActorId: string;

  /** Survey-specific fields */
  surveyName?: string;
  questionFocus?: string;
}

export interface DocumentInput {
  name: string;
  content: string;
  type: string;
  size: number;
  [key: string]: unknown;
}

export interface DiscoveryResult {
  /** URL of the generated artifact on GitHub */
  url: string;
  /** Topic slug used */
  topicSlug: string;
  /** Discovery type label */
  typeLabel: string;
  /** Cascade extraction outcome */
  extractionSuccess: boolean;
  extractionVariableCount: number;
  /** DISC-1: DiscoveryRun public ID */
  runPublicId?: string;
  /** DISC-1: DiscoveryArtifact public ID */
  artifactPublicId?: string;
}

export interface DiscoveryArtifactInfo {
  slug: string;
  type: string;
  label: string;
  date: string;
  icon: string;
  variableCount: number;
}

export interface PrivacyViolation {
  label: string;
  snippet: string;
}

// ─── Constants ──────────────────────────────────────────────────

interface DiscoveryTypeConfig {
  yaml: string;
  type: string;
  fileSlug: string;
  label: string;
}

const DISCOVERY_TYPES: Record<DiscoveryTypeKey, DiscoveryTypeConfig> = {
  desk_research: {
    yaml: 'desk_research.yaml',
    type: 'desk-research',
    fileSlug: 'desk-research',
    label: 'Desk research',
  },
  stakeholder_synthesis: {
    yaml: 'stakeholder_synthesis.yaml',
    type: 'stakeholder-interviews',
    fileSlug: 'stakeholder-synthesis',
    label: 'Stakeholder synthesis',
  },
  survey_synthesis: {
    yaml: 'survey_synthesis.yaml',
    type: 'survey-synthesis',
    fileSlug: 'survey-synthesis',
    label: 'Survey synthesis',
  },
};

const DISCOVERY_README = `# Discovery Research

Pre-study discovery research that informs briefs and accumulates as organizational memory.

## Contents

Discovery artifacts are stored directly in this folder.

*Generated by Qori*
`;

// ─── Helpers ────────────────────────────────────────────────────

function slugifyTopic(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function scaffoldDiscoveryFolders(projectSlug: string): Promise<void> {
  const readmePath = `${projectSlug}/00-discovery/README.md`;
  try {
    await fetchFileFromRepoByPath(process.env.GITHUB_REPO!, readmePath);
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = (error as Record<string, unknown>)?.status;
    if (status === 404 || message?.includes('Not Found') || message?.includes('Could not fetch file')) {
      await createOrUpdateFileOnGitHub(readmePath, DISCOVERY_README);
    }
  }
}

function computeContentHash(content: string): string {
  const { createHash } = require('crypto');
  return createHash('sha256').update(content).digest('hex').substring(0, 32);
}

// ═══════════════════════════════════════════════════════════════════════════
// DISC-WEB-1B: REST API HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * DISC-WEB-1B: Compute payload fingerprint for idempotency conflict detection.
 *
 * Normalizes request body to canonical JSON form and computes SHA-256 hash.
 * Used to detect payload changes on idempotent retry.
 */
export function computePayloadFingerprint(payload: {
  discoveryType: string;
  topic: string;
  sourceIntent: string | null;
  sourceRefs: string[];
}): string {
  const { createHash } = require('crypto');

  // Canonical form: sorted keys, trimmed strings, sorted arrays
  const canonical = {
    discoveryType: payload.discoveryType,
    sourceIntent: payload.sourceIntent?.trim() || null,
    sourceRefs: [...payload.sourceRefs].sort(),
    topic: payload.topic.trim(),
  };

  return createHash('sha256')
    .update(JSON.stringify(canonical))
    .digest('hex');
}

/**
 * DISC-WEB-1B: Resolve unique topic slug with collision handling.
 *
 * Reuses existing pattern from createPendingDiscoveryRun:
 * - Check if expected filename exists on GitHub
 * - If exists, append time suffix (HHmm)
 *
 * @param baseTopic - Raw topic string
 * @param projectSlug - Project slug for path construction
 * @param typeConfig - Discovery type configuration
 * @returns Unique topic slug
 */
export async function resolveUniqueTopicSlug(
  baseTopic: string,
  projectSlug: string,
  typeConfig: { fileSlug: string },
): Promise<string> {
  let topicSlug = slugifyTopic(baseTopic);

  // Check for duplicate filename
  const dateIso = format(new Date(), 'yyyy-MM-dd');
  const expectedFilename = `${topicSlug}-${typeConfig.fileSlug}-${dateIso}.md`;
  const expectedPath = `${projectSlug}/00-discovery/${expectedFilename}`;

  try {
    await fetchFileFromRepoByPath(process.env.GITHUB_REPO!, expectedPath);
    // File exists — append time suffix
    const timeSuffix = format(new Date(), 'HHmm');
    topicSlug = `${topicSlug}-${timeSuffix}`;
  } catch (error) {
    // Only treat HTTP 404 as "file doesn't exist"
    const status = (error as Record<string, unknown>)?.status;
    const message = error instanceof Error ? error.message : String(error);

    if (status === 404 || message?.includes('Not Found') || message?.includes('Could not fetch file')) {
      // File doesn't exist — proceed with original slug
    } else {
      // Unexpected error — propagate
      throw error;
    }
  }

  return topicSlug;
}

/**
 * DISC-WEB-1B: Export slugifyTopic for use in route handlers.
 */
export { slugifyTopic };

/**
 * DISC-WEB-1B: Get discovery type configuration.
 */
export function getDiscoveryTypeConfig(discoveryType: DiscoveryTypeKey): {
  yaml: string;
  type: string;
  fileSlug: string;
  label: string;
} | null {
  return DISCOVERY_TYPES[discoveryType] || null;
}

// ─── List Discovery Artifacts (Legacy GitHub-based) ─────────────

export async function listDiscoveryArtifacts(
  ctx: ApplicationContext,
  projectId: number,
): Promise<DiscoveryArtifactInfo[]> {
  await assertProjectAccessByActor(ctx.actor.id, projectId, ctx.organization.id);

  const artifacts = await loadDiscoveryArtifacts(projectId);
  return artifacts.map((a: DiscoveryArtifact) => ({
    slug: a.slug,
    type: a.type,
    label: a.label,
    date: a.date,
    icon: a.icon,
    variableCount: a.variableCount,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// DISC-WEB-1B-2b: SOURCE REF ORCHESTRATION
// ═══════════════════════════════════════════════════════════════════════════

import {
  validateRefsForConsumption,
  consumeValidatedRefs,
  type ValidatedStagingRefs,
} from '../services/extraction';
import {
  sourceRefUnavailable,
  idempotencyConflict,
  controlledSessionNotFound,
  controlledSessionNotActive,
  controlledSessionAlreadyBound,
  controlledSessionActorMismatch,
  controlledExecutionDisabled,
  featureDisabled,
} from '../types/api-errors';
import {
  getSessionByPublicId,
  bindRunToSession,
  getSessionByRunId,
  completeSession,
  cancelSession,
  SessionNotFoundError,
  SessionTerminalError,
  RunAlreadyBoundError,
} from '../services/controlled-test-budget.service';
import {
  isControlledExecutionEnabled,
  checkNewRunEligibility,
  checkReplayEligibility,
} from '../services/controlled-session-authorization.service';

/**
 * Hash string to 32-bit signed integer for pg_advisory_lock.
 */
function hashToInt32(str: string): number {
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(str).digest();
  return hash.readInt32LE(0);
}

/**
 * Result of createPendingDiscoveryRunFromRefs.
 */
export interface SourceRefsRunResult {
  /** Created or replayed run */
  run: DiscoveryRun;
  /** True if this was an idempotent replay (existing run returned) */
  isReplay: boolean;
  /** Number of sources created (0 if replay) */
  sourceCount: number;
}

/**
 * DISC-WEB-1B-2b: Create a pending Discovery run from extraction staging refs.
 *
 * Atomic orchestration:
 * 1. Preliminary idempotency check (read-only, before GitHub)
 * 2. Resolve unique topic slug (GitHub check)
 * 3. Transaction with advisory lock
 * 4. Authoritative idempotency check (under lock)
 * 5. Validate staging refs (FOR UPDATE)
 * 6. Create DiscoveryRun
 * 7. Create EvidenceSources from staging
 * 8. Associate sources with run
 * 9. Consume staging refs
 * 10. Commit
 *
 * Returns:
 * - 201: New run created (isReplay: false)
 * - 200: Existing run replayed (isReplay: true)
 * - 409: Idempotency conflict (different payload)
 * - 410: Source refs unavailable
 *
 * @throws AppError with SOURCE_REF_UNAVAILABLE if any ref is invalid
 * @throws AppError with IDEMPOTENCY_CONFLICT if key reused with different payload
 */
export async function createPendingDiscoveryRunFromRefs(params: {
  projectId: number;
  projectSlug: string;
  actorId: number;
  discoveryType: DiscoveryTypeKey;
  topic: string;
  sourceIntent: string | null;
  sourceRefs: string[];
  idempotencyKey: string;
  createdByIdentity: string;
}): Promise<SourceRefsRunResult> {
  const {
    projectId,
    projectSlug,
    actorId,
    discoveryType,
    topic,
    sourceIntent,
    sourceRefs,
    idempotencyKey,
    createdByIdentity,
  } = params;

  const typeConfig = DISCOVERY_TYPES[discoveryType];
  if (!typeConfig) {
    throw new Error(`Unknown discovery type: ${discoveryType}`);
  }

  if (!topic || !slugifyTopic(topic)) {
    throw new Error('Topic must contain alphanumeric characters');
  }

  if (sourceRefs.length === 0) {
    throw new Error('At least one source ref is required');
  }

  // Compute payload fingerprint for conflict detection
  const payloadFingerprint = computePayloadFingerprint({
    discoveryType,
    topic,
    sourceIntent,
    sourceRefs,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 1: Preliminary idempotency check (read-only, before GitHub)
  // ═══════════════════════════════════════════════════════════════════════════

  const existingRun = await runService.findByIdempotencyKey(projectId, idempotencyKey);

  if (existingRun) {
    // Check fingerprint match
    if (existingRun.payload_fingerprint !== payloadFingerprint) {
      throw idempotencyConflict(
        'Idempotency key was already used with a different request payload',
      );
    }

    // Idempotent replay — return existing run
    console.log(
      `[DISC-WEB-1B-2b] Idempotent replay: run ${existingRun.public_id} for key ${idempotencyKey}`,
    );

    return {
      run: existingRun,
      isReplay: true,
      sourceCount: 0,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 2: Resolve unique topic slug (GitHub check, before transaction)
  // ═══════════════════════════════════════════════════════════════════════════

  const topicSlug = await resolveUniqueTopicSlug(topic, projectSlug, typeConfig);

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 3: Transaction with advisory lock
  // ═══════════════════════════════════════════════════════════════════════════

  const lockId = hashToInt32(`discovery:idempotency:${projectId}:${idempotencyKey}`);
  const transaction = await sequelize.transaction();

  try {
    // Acquire advisory lock (blocking)
    await sequelize.query('SELECT pg_advisory_xact_lock($1)', {
      bind: [lockId],
      transaction,
    });

    // ═════════════════════════════════════════════════════════════════════════
    // Phase 4: Authoritative idempotency check (under lock)
    // ═════════════════════════════════════════════════════════════════════════

    const authoritativeRun = await runService.findByIdempotencyKey(
      projectId,
      idempotencyKey,
      transaction,
    );

    if (authoritativeRun) {
      // Race: another request created the run while we were in GitHub check
      if (authoritativeRun.payload_fingerprint !== payloadFingerprint) {
        await transaction.rollback();
        throw idempotencyConflict(
          'Idempotency key was already used with a different request payload',
        );
      }

      // Idempotent replay
      await transaction.rollback();
      console.log(
        `[DISC-WEB-1B-2b] Idempotent replay (authoritative): run ${authoritativeRun.public_id}`,
      );

      return {
        run: authoritativeRun,
        isReplay: true,
        sourceCount: 0,
      };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Phase 5: Validate staging refs (FOR UPDATE lock)
    // ═════════════════════════════════════════════════════════════════════════

    const validationResult = await validateRefsForConsumption(
      sourceRefs,
      projectId,
      actorId,
      transaction,
    );

    if (!validationResult.success) {
      await transaction.rollback();
      // Generic error — do not leak specific reasons (security)
      throw sourceRefUnavailable(validationResult.errors.length);
    }

    const validated = validationResult.validated as ValidatedStagingRefs;

    // ═════════════════════════════════════════════════════════════════════════
    // Phase 6: Create DiscoveryRun
    // ═════════════════════════════════════════════════════════════════════════

    const run = await runService.createDiscoveryRun(
      {
        projectId,
        discoveryType: discoveryType as import('../database/models/discovery_run').DiscoveryType,
        topic,
        topicSlug,
        sourceIntent,
        actorId,
        createdByIdentity,
        idempotencyKey,
        payloadFingerprint,
      },
      transaction,
    );

    // ═════════════════════════════════════════════════════════════════════════
    // Phase 7: Create EvidenceSources from staging rows
    // ═════════════════════════════════════════════════════════════════════════

    const evidenceSources = await evidenceService.createDiscoverySources(
      projectId,
      validated.stagingRows.map((staging) => ({
        filename: staging.filename,
        extractedText: staging.extracted_text,
        contentHash: staging.content_hash,
        mimeType: staging.mime_type,
        sizeBytes: staging.file_size_bytes,
        // DISC-WEB-1B-2b: Full file hash for provenance
        fileHash: staging.file_hash,
        metadata: {
          uploadSessionId: undefined,
          source: 'extraction' as const,
        },
      })),
      createdByIdentity,
      transaction,
    );

    // ═════════════════════════════════════════════════════════════════════════
    // Phase 8: Associate sources with run
    // ═════════════════════════════════════════════════════════════════════════

    await runService.associateSources(
      {
        runId: run.id,
        sourceIds: evidenceSources.map((s) => s.id),
      },
      transaction,
    );

    // ═════════════════════════════════════════════════════════════════════════
    // Phase 9: Consume staging refs (atomic with row count verification)
    // ═════════════════════════════════════════════════════════════════════════

    const consumedCount = await consumeValidatedRefs(validated, run.id, transaction);

    if (consumedCount !== sourceRefs.length) {
      // Should not happen — consumeValidatedRefs throws on mismatch
      await transaction.rollback();
      throw new Error(
        `Staging consumption verification failed: expected ${sourceRefs.length}, consumed ${consumedCount}`,
      );
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Phase 10: Commit
    // ═════════════════════════════════════════════════════════════════════════

    await transaction.commit();

    console.log(
      `[DISC-WEB-1B-2b] Created run ${run.public_id} from ${sourceRefs.length} refs ` +
      `(key: ${idempotencyKey})`,
    );

    return {
      run,
      isReplay: false,
      sourceCount: evidenceSources.length,
    };
  } catch (error) {
    // Ensure rollback on any error
    try {
      await transaction.rollback();
    } catch {
      // Ignore rollback error if transaction already rolled back
    }
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DISC-WEB-1D-2: CONTROLLED RUN CREATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * DISC-WEB-1D-2: Compute payload fingerprint for controlled run idempotency.
 *
 * Includes controlledSessionPublicId to ensure different sessions produce
 * different fingerprints even with same topic/sources.
 */
export function computeControlledPayloadFingerprint(payload: {
  discoveryType: string;
  topic: string;
  sourceIntent: string | null;
  sourceRefs: string[];
  controlledSessionPublicId: string;
}): string {
  const { createHash } = require('crypto');

  // Canonical form: sorted keys, trimmed strings, sorted arrays
  // Includes controlledSessionPublicId to distinguish from ordinary runs
  const canonical = {
    controlledSessionPublicId: payload.controlledSessionPublicId,
    discoveryType: payload.discoveryType,
    sourceIntent: payload.sourceIntent?.trim() || null,
    sourceRefs: [...payload.sourceRefs].sort(),
    topic: payload.topic.trim(),
  };

  return createHash('sha256')
    .update(JSON.stringify(canonical))
    .digest('hex');
}

/**
 * Result of createControlledDiscoveryRunFromRefs.
 */
export interface ControlledSourceRefsRunResult {
  /** Created or replayed run */
  run: DiscoveryRun;
  /** True if this was an idempotent replay (existing run returned) */
  isReplay: boolean;
  /** Number of sources created (0 if replay) */
  sourceCount: number;
  /** Session ID bound to the run */
  sessionId: number;
}

/**
 * DISC-WEB-1D-2 M5d: Create a controlled Discovery run from extraction staging refs.
 *
 * Atomic orchestration with session binding:
 * 1. Validate controlled execution gate
 * 2. Preliminary idempotency check (read-only)
 * 3. Resolve session by public ID
 * 4. Validate new-run eligibility (preflight)
 * 5. Resolve unique topic slug (GitHub check)
 * 6. Transaction with advisory lock
 * 7. Authoritative idempotency check (under lock)
 *    - If replay: validate replay eligibility with actor check
 * 8. Validate staging refs (FOR UPDATE)
 * 9. Create DiscoveryRun with is_controlled: true
 * 10. Bind session to run (atomic)
 * 11. Create EvidenceSources from staging
 * 12. Associate sources with run
 * 13. Consume staging refs
 * 14. Commit
 *
 * Returns:
 * - 201: New run created (isReplay: false)
 * - 200: Existing run replayed (isReplay: true)
 * - 400: Invalid session ID
 * - 403: Actor mismatch
 * - 404: Session not found
 * - 409: Session already bound, idempotency conflict, or session not active
 * - 410: Source refs unavailable
 * - 503: Controlled execution disabled
 *
 * @throws AppError with CONTROLLED_EXECUTION_DISABLED if gate is off
 * @throws AppError with CONTROLLED_SESSION_NOT_FOUND if session doesn't exist
 * @throws AppError with CONTROLLED_SESSION_ACTOR_MISMATCH if actor doesn't own session
 * @throws AppError with CONTROLLED_SESSION_NOT_ACTIVE if session is terminal
 * @throws AppError with CONTROLLED_SESSION_ALREADY_BOUND if session already bound
 * @throws AppError with SOURCE_REF_UNAVAILABLE if any ref is invalid
 * @throws AppError with IDEMPOTENCY_CONFLICT if key reused with different payload
 */
export async function createControlledDiscoveryRunFromRefs(params: {
  projectId: number;
  projectSlug: string;
  actorId: number;
  discoveryType: DiscoveryTypeKey;
  topic: string;
  sourceIntent: string | null;
  sourceRefs: string[];
  idempotencyKey: string;
  createdByIdentity: string;
  controlledSessionPublicId: string;
}): Promise<ControlledSourceRefsRunResult> {
  const {
    projectId,
    projectSlug,
    actorId,
    discoveryType,
    topic,
    sourceIntent,
    sourceRefs,
    idempotencyKey,
    createdByIdentity,
    controlledSessionPublicId,
  } = params;

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 1: Validate both feature gates (fail closed)
  // ═══════════════════════════════════════════════════════════════════════════

  // DISC_WEB1_ENABLED: sourceRefs path must be enabled
  if (process.env.DISC_WEB1_ENABLED !== 'true') {
    throw featureDisabled('Source reference consumption is not available');
  }

  // DISC_WEB1D_ENABLED: controlled execution must be enabled
  if (!isControlledExecutionEnabled()) {
    throw controlledExecutionDisabled();
  }

  // Validate actor identity is provided (required for controlled execution)
  if (!actorId || typeof actorId !== 'number' || !Number.isFinite(actorId) || actorId <= 0) {
    throw controlledSessionActorMismatch('Valid actor identity is required for controlled execution');
  }

  const typeConfig = DISCOVERY_TYPES[discoveryType];
  if (!typeConfig) {
    throw new Error(`Unknown discovery type: ${discoveryType}`);
  }

  if (!topic || !slugifyTopic(topic)) {
    throw new Error('Topic must contain alphanumeric characters');
  }

  if (sourceRefs.length === 0) {
    throw new Error('At least one source ref is required');
  }

  // Compute payload fingerprint including session ID
  const payloadFingerprint = computeControlledPayloadFingerprint({
    discoveryType,
    topic,
    sourceIntent,
    sourceRefs,
    controlledSessionPublicId,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 2: Preliminary idempotency check (read-only, before session validation)
  // ═══════════════════════════════════════════════════════════════════════════

  const existingRun = await runService.findByIdempotencyKey(projectId, idempotencyKey);

  if (existingRun) {
    // ─── Full replay validation (9-point checklist) ───────────────────────────

    // 1. Verify run belongs to the requested project
    if (existingRun.project_id !== projectId) {
      throw idempotencyConflict(
        'Idempotency key was used in a different project',
      );
    }

    // 2. Verify this is a controlled run (cross-type replay protection)
    if (!existingRun.is_controlled) {
      throw idempotencyConflict(
        'Idempotency key was already used for an ordinary (non-controlled) run',
      );
    }

    // 3. Verify exact idempotency key match (implicit via findByIdempotencyKey)

    // 4. Verify exact canonical payload fingerprint
    if (existingRun.payload_fingerprint !== payloadFingerprint) {
      throw idempotencyConflict(
        'Idempotency key was already used with a different request payload',
      );
    }

    // 5. Get bound session for replay authorization
    const boundSession = await getSessionByRunId(existingRun.id);
    if (!boundSession) {
      // Invariant violation: controlled run must have bound session
      throw controlledSessionNotFound('Run has no bound session');
    }

    // 6. Verify session's discovery_run_id exactly matches the existing run ID
    if (boundSession.discovery_run_id !== existingRun.id) {
      // This should not happen if binding is immutable, but check defensively
      throw idempotencyConflict('Session binding mismatch');
    }

    // 7. Validate actor owns the controlled session
    if (boundSession.created_by_actor_id !== actorId) {
      throw controlledSessionActorMismatch();
    }

    // 8. Validate replay eligibility (includes session status check)
    const replayResult = await checkReplayEligibility({
      actorId,
      sessionId: boundSession.id,
      runId: existingRun.id,
    });

    // 9. Terminal sessions can replay read-only but not create new runs
    // (Already handled by returning existing run below)

    if (!replayResult.authorized && replayResult.reason !== 'session_not_active') {
      // Authorization failure (not just terminal session)
      switch (replayResult.reason) {
        case 'actor_mismatch':
          throw controlledSessionActorMismatch();
        case 'session_not_found':
          throw controlledSessionNotFound();
        case 'run_mismatch':
          throw idempotencyConflict('Session is bound to a different run');
        case 'gate_disabled':
          throw controlledExecutionDisabled();
        default:
          throw controlledSessionNotActive();
      }
    }

    // Idempotent replay — return existing run (read-only for terminal sessions)
    console.log(
      `[DISC-WEB-1D-2] Idempotent replay: controlled run ${existingRun.public_id} ` +
      `for key ${idempotencyKey} (readOnly: ${replayResult.readOnly})`,
    );

    return {
      run: existingRun,
      isReplay: true,
      sourceCount: 0,
      sessionId: boundSession.id,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 3: Resolve session by public ID
  // ═══════════════════════════════════════════════════════════════════════════

  const session = await getSessionByPublicId(controlledSessionPublicId);
  if (!session) {
    throw controlledSessionNotFound();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 4: Validate new-run eligibility (preflight)
  // ═══════════════════════════════════════════════════════════════════════════

  const eligibility = await checkNewRunEligibility({
    actorId,
    sessionId: session.id,
  });

  if (!eligibility.authorized) {
    switch (eligibility.reason) {
      case 'actor_mismatch':
        throw controlledSessionActorMismatch();
      case 'session_not_active':
        throw controlledSessionNotActive();
      case 'session_already_bound':
        throw controlledSessionAlreadyBound();
      case 'session_not_found':
        throw controlledSessionNotFound();
      default:
        throw controlledExecutionDisabled();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 5: Resolve unique topic slug (GitHub check, before transaction)
  // ═══════════════════════════════════════════════════════════════════════════

  const topicSlug = await resolveUniqueTopicSlug(topic, projectSlug, typeConfig);

  // ═══════════════════════════════════════════════════════════════════════════
  // Phase 6: Transaction with advisory lock
  // ═══════════════════════════════════════════════════════════════════════════

  const lockId = hashToInt32(`discovery:idempotency:${projectId}:${idempotencyKey}`);
  const transaction = await sequelize.transaction();

  try {
    // Acquire advisory lock (blocking)
    await sequelize.query('SELECT pg_advisory_xact_lock($1)', {
      bind: [lockId],
      transaction,
    });

    // ═════════════════════════════════════════════════════════════════════════
    // Phase 7: Authoritative idempotency check (under lock)
    // ═════════════════════════════════════════════════════════════════════════

    const authoritativeRun = await runService.findByIdempotencyKey(
      projectId,
      idempotencyKey,
      transaction,
    );

    if (authoritativeRun) {
      // ─── Authoritative replay validation (9-point checklist under lock) ─────

      // 1. Verify run belongs to the requested project
      if (authoritativeRun.project_id !== projectId) {
        await transaction.rollback();
        throw idempotencyConflict(
          'Idempotency key was used in a different project',
        );
      }

      // 2. Verify this is a controlled run (cross-type replay protection)
      if (!authoritativeRun.is_controlled) {
        await transaction.rollback();
        throw idempotencyConflict(
          'Idempotency key was already used for an ordinary (non-controlled) run',
        );
      }

      // 3. Verify exact idempotency key match (implicit via findByIdempotencyKey)

      // 4. Verify exact canonical payload fingerprint
      if (authoritativeRun.payload_fingerprint !== payloadFingerprint) {
        await transaction.rollback();
        throw idempotencyConflict(
          'Idempotency key was already used with a different request payload',
        );
      }

      // 5. Get bound session for replay authorization
      const boundSession = await getSessionByRunId(authoritativeRun.id);
      if (!boundSession) {
        await transaction.rollback();
        throw controlledSessionNotFound('Run has no bound session');
      }

      // 6. Verify session's discovery_run_id exactly matches the existing run ID
      if (boundSession.discovery_run_id !== authoritativeRun.id) {
        await transaction.rollback();
        throw idempotencyConflict('Session binding mismatch');
      }

      // 7. Validate actor owns the controlled session
      if (boundSession.created_by_actor_id !== actorId) {
        await transaction.rollback();
        throw controlledSessionActorMismatch();
      }

      // 8-9. Recheck gates at transaction boundary (fail closed)
      if (process.env.DISC_WEB1_ENABLED !== 'true') {
        await transaction.rollback();
        throw featureDisabled('Source reference consumption is not available');
      }
      if (!isControlledExecutionEnabled()) {
        await transaction.rollback();
        throw controlledExecutionDisabled();
      }

      // Idempotent replay (read-only for terminal sessions, but we return the run regardless)
      await transaction.rollback();
      console.log(
        `[DISC-WEB-1D-2] Idempotent replay (authoritative): controlled run ${authoritativeRun.public_id}`,
      );

      return {
        run: authoritativeRun,
        isReplay: true,
        sourceCount: 0,
        sessionId: boundSession.id,
      };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Phase 8: Validate staging refs (FOR UPDATE lock)
    // ═════════════════════════════════════════════════════════════════════════

    const validationResult = await validateRefsForConsumption(
      sourceRefs,
      projectId,
      actorId,
      transaction,
    );

    if (!validationResult.success) {
      await transaction.rollback();
      throw sourceRefUnavailable(validationResult.errors.length);
    }

    const validated = validationResult.validated as ValidatedStagingRefs;

    // ═════════════════════════════════════════════════════════════════════════
    // Phase 9: Create DiscoveryRun with is_controlled: true
    // ═════════════════════════════════════════════════════════════════════════

    const run = await runService.createDiscoveryRun(
      {
        projectId,
        discoveryType: discoveryType as import('../database/models/discovery_run').DiscoveryType,
        topic,
        topicSlug,
        sourceIntent,
        actorId,
        createdByIdentity,
        idempotencyKey,
        payloadFingerprint,
        isControlled: true, // DISC-WEB-1D-2: Mark as controlled run
      },
      transaction,
    );

    // ═════════════════════════════════════════════════════════════════════════
    // Phase 10: Bind session to run (atomic, same transaction)
    // ═════════════════════════════════════════════════════════════════════════

    try {
      await bindRunToSession(session.id, run.id, transaction);
    } catch (error) {
      if (error instanceof SessionTerminalError) {
        await transaction.rollback();
        throw controlledSessionNotActive();
      }
      if (error instanceof RunAlreadyBoundError) {
        await transaction.rollback();
        throw controlledSessionAlreadyBound();
      }
      if (error instanceof SessionNotFoundError) {
        await transaction.rollback();
        throw controlledSessionNotFound();
      }
      throw error;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Phase 11: Create EvidenceSources from staging rows
    // ═════════════════════════════════════════════════════════════════════════

    const evidenceSources = await evidenceService.createDiscoverySources(
      projectId,
      validated.stagingRows.map((staging) => ({
        filename: staging.filename,
        extractedText: staging.extracted_text,
        contentHash: staging.content_hash,
        mimeType: staging.mime_type,
        sizeBytes: staging.file_size_bytes,
        fileHash: staging.file_hash,
        metadata: {
          uploadSessionId: undefined,
          source: 'extraction' as const,
          controlledSessionId: session.id,
        },
      })),
      createdByIdentity,
      transaction,
    );

    // ═════════════════════════════════════════════════════════════════════════
    // Phase 12: Associate sources with run
    // ═════════════════════════════════════════════════════════════════════════

    await runService.associateSources(
      {
        runId: run.id,
        sourceIds: evidenceSources.map((s) => s.id),
      },
      transaction,
    );

    // ═════════════════════════════════════════════════════════════════════════
    // Phase 13: Consume staging refs
    // ═════════════════════════════════════════════════════════════════════════

    const consumedCount = await consumeValidatedRefs(validated, run.id, transaction);

    if (consumedCount !== sourceRefs.length) {
      await transaction.rollback();
      throw new Error(
        `Staging consumption verification failed: expected ${sourceRefs.length}, consumed ${consumedCount}`,
      );
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Phase 14: Commit
    // ═════════════════════════════════════════════════════════════════════════

    await transaction.commit();

    console.log(
      `[DISC-WEB-1D-2] Created controlled run ${run.public_id} from ${sourceRefs.length} refs ` +
      `(key: ${idempotencyKey}, session: ${session.public_id})`,
    );

    return {
      run,
      isReplay: false,
      sourceCount: evidenceSources.length,
      sessionId: session.id,
    };
  } catch (error) {
    // Ensure rollback on any error
    try {
      await transaction.rollback();
    } catch {
      // Ignore rollback error if transaction already rolled back
    }
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DISC-2: SPLIT EXECUTION — CREATE PENDING RUN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a pending Discovery run with associated sources.
 *
 * This is the synchronous creation phase:
 * 1. Validate input
 * 2. Create DiscoveryRun (pending)
 * 3. Create EvidenceSources for each prepared source
 * 4. Associate sources with run
 * 5. Return immediately with pending run
 *
 * Worker will claim and execute asynchronously.
 */
export async function createPendingDiscoveryRun(
  input: CreateDiscoveryRunInput,
): Promise<DiscoveryRun> {
  const typeConfig = DISCOVERY_TYPES[input.discoveryType];
  if (!typeConfig) {
    throw new Error(`Unknown discovery type: ${input.discoveryType}`);
  }

  if (!input.topic || !slugifyTopic(input.topic)) {
    throw new Error('Topic must contain alphanumeric characters');
  }

  if (input.sources.length === 0) {
    throw new Error('At least one source is required');
  }

  let topicSlug = slugifyTopic(input.topic);

  // Check for duplicate filename
  const dateIso = format(new Date(), 'yyyy-MM-dd');
  const expectedFilename = `${topicSlug}-${typeConfig.fileSlug}-${dateIso}.md`;
  const expectedPath = `${input.projectSlug}/00-discovery/${expectedFilename}`;
  try {
    await fetchFileFromRepoByPath(process.env.GITHUB_REPO!, expectedPath);
    const timeSuffix = format(new Date(), 'HHmm');
    topicSlug = `${topicSlug}-${timeSuffix}`;
  } catch {
    // File doesn't exist — proceed
  }

  // Create DiscoveryRun (pending)
  const run = await runService.createDiscoveryRun({
    projectId: input.projectId,
    discoveryType: input.discoveryType as DiscoveryType,
    topic: input.topic,
    topicSlug,
    sourceIntent: input.sourceIntent || null,
    actorId: input.actorId || null,
    createdByIdentity: input.createdByIdentity,
  });

  // Create EvidenceSources with extracted text for worker access
  const sources = await evidenceService.createDiscoverySources(
    input.projectId,
    input.sources.map(s => ({
      filename: s.filename,
      extractedText: s.extractedText,
      contentHash: s.contentHash,
      mimeType: s.mimeType,
      sizeBytes: s.sizeBytes,
      metadata: s.metadata,
    })),
    input.createdByIdentity,
  );

  // Associate sources with run
  await runService.associateSources({
    runId: run.id,
    sourceIds: sources.map(s => s.id),
  });

  console.log(
    `[DISC-2] Created pending run ${run.public_id} with ${sources.length} sources`,
  );

  return run;
}

// ═══════════════════════════════════════════════════════════════════════════
// DISC-2: SPLIT EXECUTION — EXECUTE CLAIMED RUN
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Execute a claimed Discovery run.
 *
 * Called by worker after claiming a pending run.
 * Assumes run is already in 'processing' status with worker ownership.
 *
 * Steps:
 * 1. Load run and sources
 * 2. Privacy gate
 * 3. YAML processing
 * 4. Create DiscoveryArtifact
 * 5. GitHub projection
 * 6. Variable extraction with FK
 * 7. Finalize and complete
 */
export async function executeDiscoveryRun(
  runId: number,
  workerId: string,
): Promise<DiscoveryExecutionResult> {
  // Load run with associations
  const run = await runService.getDiscoveryRunById(runId);
  if (!run) {
    throw new Error(`Discovery run ${runId} not found`);
  }

  // Validate worker ownership
  if (run.worker_id !== workerId) {
    throw new claimService.NotOwnerError(runId, workerId);
  }

  if (run.status !== 'processing') {
    throw new Error(`Run ${runId} is not in processing status (is ${run.status})`);
  }

  // DISC-WEB-1D-2 M5d: Guard against controlled runs until controlled execution routing is implemented
  // Controlled runs must go through dedicated execution path with budget enforcement
  if (run.is_controlled) {
    throw new Error(
      `Run ${runId} is a controlled run — direct execution not authorized. ` +
      `Controlled runs require budget enforcement via controlled execution path.`,
    );
  }

  const typeConfig = DISCOVERY_TYPES[run.discovery_type as DiscoveryTypeKey];
  if (!typeConfig) {
    throw new Error(`Unknown discovery type: ${run.discovery_type}`);
  }

  // Load associated sources
  const DiscoveryRunSourceModel = sequelize.models.DiscoveryRunSource;
  const EvidenceSourceModel = sequelize.models.EvidenceSource;

  const runSources = await DiscoveryRunSourceModel.findAll({
    where: { discovery_run_id: run.id },
    order: [['source_order', 'ASC']],
  });

  const sourceIds = runSources.map((rs: any) => rs.evidence_source_id);
  const evidenceSources = await EvidenceSourceModel.findAll({
    where: { id: { [Op.in]: sourceIds } },
  }) as EvidenceSource[];

  // Order sources by run source order
  const sourceMap = new Map(evidenceSources.map(s => [s.id, s]));
  const orderedSources = sourceIds.map(id => sourceMap.get(id)).filter(Boolean) as EvidenceSource[];

  if (orderedSources.length === 0) {
    throw new Error(`Run ${runId} has no associated sources`);
  }

  // Load project for context
  const project = await getProjectById(run.project_id);
  if (!project) {
    throw new Error(`Project ${run.project_id} not found`);
  }

  const projectSlug = project.slug;
  const projectProblemStatement = project.problem_statement || null;

  // Scaffold discovery folders
  await scaffoldDiscoveryFolders(projectSlug);

  // Build document content from sources
  // Note: For DISC-2, sources store content hash but not raw content
  // We need to re-extract or have content stored somewhere accessible
  // For now, we'll need the content to be stored in a way the worker can access

  // BLOCKER CHECK: Do sources have accessible content?
  // Current EvidenceSource stores metadata only, not raw content.
  // For initial DISC-2, we'll store extracted_text in metadata.content_preview or similar.
  // This is a limitation documented in DISC-2 spec.

  // For this implementation, we'll read content from a temporary field or require
  // sources to include content. Let me check the EvidenceSource model...

  // Build documents from sources
  // We need to retrieve the extracted text - checking artifact_ref for content info
  const documents: DocumentInput[] = [];
  for (const source of orderedSources) {
    const artifactRef = source.artifact_ref as {
      filename?: string;
      content_hash?: string;
      mime_type?: string;
      size_bytes?: number;
      extracted_text?: string; // DISC-2: Store during creation
    } | null;

    const metadata = source.metadata as {
      content_length?: number;
      extracted_text?: string; // DISC-2: Store during creation
    } | null;

    // Try to get extracted text from metadata or artifact_ref
    const extractedText = metadata?.extracted_text || artifactRef?.extracted_text;

    if (!extractedText) {
      throw new Error(
        `Source ${source.id} has no extracted text available. ` +
        `This indicates a content storage issue - worker cannot access source content.`
      );
    }

    documents.push({
      name: source.label,
      content: extractedText,
      type: artifactRef?.mime_type || 'application/octet-stream',
      size: artifactRef?.size_bytes || 0,
    });
  }

  // Parse documents
  const parsedDocuments = parseDocuments(documents);
  const formattedDocumentContent: string = parsedDocuments.structured_format;

  const MIME_LABELS: Record<string, string> = {
    'application/pdf': 'PDF',
    'text/plain': 'Text',
    'text/markdown': 'Markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
    'application/msword': 'Word',
  };

  const documentNames = documents.map(d => d.name);
  const documentTypes = documents.map(d => MIME_LABELS[d.type] || d.type);

  // Privacy gate
  const privacyResult = authorizeForModel(
    formattedDocumentContent,
    'DISCOVERY_UPLOAD',
    { projectId: run.project_id, sourceId: `discovery:${run.discovery_type}:${run.topic_slug}` },
  );

  if (privacyResult.status === 'pending_review') {
    const piiFindings = scanForPii(formattedDocumentContent);
    await claimService.failRun(run.id, workerId, 'PRIVACY_VIOLATION', 'PII detected in documents', 'privacy_scan');
    throw new PrivacyError(
      'Privacy scan detected potential PII in uploaded files',
      piiFindings.map((f: { label: string; snippet: string }) => ({ label: f.label, snippet: f.snippet })),
    );
  }

  if (privacyResult.status === 'denied') {
    await claimService.failRun(run.id, workerId, 'CONTENT_DENIED', privacyResult.reason || 'Unknown', 'content_auth');
    throw new Error(`Content authorization failed: ${privacyResult.reason}`);
  }

  // Build template data
  const contentFingerprint = computeContentHash(privacyResult.modelSafeContent!).substring(0, 16);

  const data: Record<string, unknown> = {
    topic: run.topic,
    effective_topic: run.topic,
    topic_slug: run.topic_slug,
    project_slug: projectSlug,
    project_problem_statement: projectProblemStatement,
    source_intent: run.source_intent,
    description: run.source_intent || run.topic,
    document_content: privacyResult.modelSafeContent!,
    combined_file_content: privacyResult.modelSafeContent!,
    _discovery_type: typeConfig.type,
    selected_study: `discovery-${run.topic_slug}`,
    study_name: run.topic,
    document_count: documents.length,
    document_names: documentNames,
    document_types: documentTypes,
  };

  // Stakeholder-specific fields
  if (run.discovery_type === 'stakeholder_synthesis') {
    data.researcher_contact = run.created_by_identity;
    data.detected_files = documents.map(d => d.name).join('\n- ');
    data.file_list = documents.map(d => d.name);
  }

  // Artifact identity context
  data.__artifactContext = {
    projectId: run.project_id,
    studyId: null,
    artifactType: 'discovery',
    title: `${run.discovery_type.replace(/_/g, ' ')} — ${run.topic}`,
    canonicalUpstreamInputs: [`content:${contentFingerprint}`],
    createdBy: run.created_by_identity,
  };

  // Execute YAML template processing
  let artifact;
  try {
    // Fetch and parse YAML template
    const file = await fetchFileFromRepo(getConfigRepo(), YAML_TEMPLATE_PATH, typeConfig.yaml);
    const yamlConfig = yaml.load(file.content) as {
      id?: string;
      version?: string;
      emits?: EmitSpec[];
    } | null;

    if (!yamlConfig) {
      throw new Error(`Failed to parse YAML template: ${typeConfig.yaml}`);
    }

    const templateVersion = yamlConfig.version || null;
    const emitsSpec: EmitSpec[] = yamlConfig.emits || [];

    // Process YAML with dryRun=true
    const variableContext: VariableContext = {
      projectId: run.project_id,
    };

    // Update heartbeat before long-running AI call
    await claimService.updateHeartbeat(run.id, workerId);

    const dryRunResult = await processYamlTemplate(
      file.content, data, '', '', false, variableContext, undefined, true,
    );

    // Update heartbeat after AI call
    await claimService.updateHeartbeat(run.id, workerId);

    // Create DiscoveryArtifact
    artifact = await artifactService.createDiscoveryArtifact({
      projectId: run.project_id,
      discoveryRunId: run.id,
      artifactType: run.discovery_type as 'desk_research' | 'stakeholder_synthesis' | 'survey_synthesis' | 'cross_source_synthesis',
      title: `${typeConfig.label}: ${run.topic}`,
      topicSlug: run.topic_slug,
      canonicalContent: dryRunResult.outputTemplate || null,
      templateName: typeConfig.yaml.replace('.yaml', ''),
      templateVersion,
      derivationFingerprint: contentFingerprint,
      actorId: run.actor_id,
      generatedByIdentity: run.created_by_identity,
    });

    // GitHub projection
    let githubResult: { path: string; sha: string; url: string };
    try {
      githubResult = await createOrUpdateFileOnGitHub(dryRunResult.path, dryRunResult.content);
      await artifactService.recordProjection(artifact.id, {
        githubPath: githubResult.path,
        githubSha: githubResult.sha,
      });
    } catch (githubError) {
      const githubMsg = githubError instanceof Error ? githubError.message : String(githubError);
      console.warn(`⚠️ GitHub projection failed (non-blocking): ${githubMsg}`);
      await artifactService.recordProjectionError(artifact.id, githubMsg);
      githubResult = {
        path: dryRunResult.path,
        sha: 'projection-failed',
        url: `https://github.com/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/blob/main/${dryRunResult.path}`,
      };
    }

    // Variable extraction with artifact FK
    let extractionSuccess = true;
    let extractionVariableCount = 0;

    if (emitsSpec.length > 0) {
      const extractResult = await extractAndPersistDiscoveryVariables({
        templateId: yamlConfig.id || typeConfig.yaml.replace('.yaml', ''),
        templateVersion: templateVersion || '',
        emitsSpec,
        outputTemplate: dryRunResult.outputTemplate,
        inputValues: data,
        variableContext,
        discoveryArtifactFkId: artifact.id,
      });

      extractionSuccess = extractResult.success;
      extractionVariableCount = extractResult.variableCount || 0;

      if (!extractResult.success) {
        console.warn(`⚠️ Cascade variable extraction failed: ${extractResult.error}`);
      }
    }

    // DR-2: Extract candidate insights from emitted variables
    // Only for desk_research runs — others do not produce insight-worthy variables
    let insightExtractionResult: Awaited<ReturnType<typeof insightExtractionService.extractInsightsFromDiscoveryRun>> | null = null;

    if (run.discovery_type === 'desk_research' && extractionSuccess && extractionVariableCount > 0) {
      try {
        // Update heartbeat before insight extraction
        await claimService.updateHeartbeat(run.id, workerId);

        insightExtractionResult = await insightExtractionService.extractInsightsFromDiscoveryRun(
          run.id,
          artifact.id,
          { verbose: true },
        );

        if (insightExtractionResult.success) {
          console.log(
            `[DR-2] Insight extraction: ${insightExtractionResult.createdCount} created, ` +
            `${insightExtractionResult.skippedCount} skipped, ${insightExtractionResult.failedCount} failed`,
          );
        } else {
          // Extraction failed but we don't fail the run (per DR-2 spec)
          console.warn(`⚠️ [DR-2] Insight extraction failed (non-blocking): ${insightExtractionResult.error}`);
        }
      } catch (insightError) {
        // Catch any unexpected errors — extraction failure must not fail the run
        const errMsg = insightError instanceof Error ? insightError.message : String(insightError);
        console.error(`⚠️ [DR-2] Insight extraction error (non-blocking): ${errMsg}`);
      }
    }

    // Finalize artifact
    await artifactService.finalizeArtifactSupersession(artifact.id);

    // Complete run
    await claimService.completeRun(run.id, workerId);

    console.log(`[DISC-2] Completed run ${run.public_id} → artifact ${artifact.public_id}`);

    return {
      runPublicId: run.public_id,
      artifactPublicId: artifact.public_id,
      topicSlug: run.topic_slug,
      typeLabel: typeConfig.label,
      githubUrl: githubResult.url,
      extractionSuccess,
      extractionVariableCount,
      // DR-2: Insight extraction results
      insightExtractionSuccess: insightExtractionResult?.success,
      insightsCreated: insightExtractionResult?.createdCount,
      insightsSkipped: insightExtractionResult?.skippedCount,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Mark artifact as failed if it was created
    if (artifact) {
      await artifactService.markArtifactFailed(artifact.id);
    }

    // Fail the run
    await claimService.failRun(
      run.id,
      workerId,
      'GENERATION_ERROR',
      errorMessage.substring(0, 500),
      'yaml_processing',
    );

    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DISC-WEB-1D-2 M5e: CONTROLLED AI EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result of controlled execution finalization.
 */
export interface ControlledFinalizationResult {
  success: boolean;
  runId: number;
  sessionId: number;
  outcome: 'completed' | 'failed';
  runStatus: string;
  sessionStatus: string;
  error?: string;
}

/**
 * Atomic finalization of controlled execution.
 *
 * Single authoritative finalization path for both success and failure outcomes.
 * Uses database transaction to ensure run and session are finalized atomically.
 *
 * Key invariants:
 * - Run and session finalize together or not at all
 * - Idempotent: re-finalization with same outcome is safe
 * - Fail-closed: any error preserves pre-finalization state
 *
 * @param runId - Discovery run ID
 * @param sessionId - Controlled test session ID
 * @param outcome - 'completed' or 'failed'
 * @param failureReason - Required if outcome is 'failed'
 */
export async function finalizeControlledExecution(
  runId: number,
  sessionId: number,
  outcome: 'completed' | 'failed',
  failureReason?: string,
): Promise<ControlledFinalizationResult> {
  const t = await sequelize.transaction();

  try {
    // Load run for status check
    const run = await runService.getDiscoveryRunById(runId);
    if (!run) {
      await t.rollback();
      return {
        success: false,
        runId,
        sessionId,
        outcome,
        runStatus: 'not_found',
        sessionStatus: 'unknown',
        error: `Run ${runId} not found`,
      };
    }

    // Idempotency: if already in terminal state, verify consistency
    if (run.status === 'completed' || run.status === 'failed') {
      // Already finalized — verify session is also terminal
      const session = await getSessionByRunId(runId);
      const sessionStatus = session?.status ?? 'not_found';

      await t.commit(); // No changes, commit read
      return {
        success: true,
        runId,
        sessionId,
        outcome,
        runStatus: run.status,
        sessionStatus,
      };
    }

    // Finalize based on outcome
    // IMPORTANT: Session update FIRST to enforce fail-closed contract.
    // If session is terminal (cancelled), we throw before touching the run.
    // Both operations use the same transaction for atomicity.
    if (outcome === 'completed') {
      // Complete session first (throws SessionTerminalError if cancelled)
      await completeSession(sessionId, t);

      // Complete run within transaction
      const workerId = run.worker_id || 'controlled-finalization';
      const now = new Date();
      const [, metadata] = await sequelize.query(
        `
        UPDATE discovery_runs
        SET status = 'completed', completed_at = :now, updated_at = :now
        WHERE id = :runId AND worker_id = :workerId AND status = 'processing'
        `,
        { replacements: { runId, workerId, now }, transaction: t },
      );
      if ((metadata as { rowCount?: number })?.rowCount === 0) {
        throw new Error(`Run ${runId} not in expected state for completion`);
      }
    } else {
      // Cancel session first (preserves budget audit trail)
      await cancelSession(sessionId, failureReason, t);

      // Fail run within transaction
      const workerId = run.worker_id || 'controlled-finalization';
      const now = new Date();
      const sanitizedReason = (failureReason || 'Controlled execution failed').slice(0, 1000);
      await sequelize.query(
        `
        UPDATE discovery_runs
        SET status = 'failed', failure_code = 'CONTROLLED_EXECUTION_FAILURE',
            failure_message = :failureMessage, failure_stage = 'controlled_execution',
            completed_at = :now, updated_at = :now
        WHERE id = :runId AND worker_id = :workerId AND status = 'processing'
        `,
        { replacements: { runId, workerId, failureMessage: sanitizedReason, now }, transaction: t },
      );
    }

    await t.commit();

    // Reload for final status
    const finalRun = await runService.getDiscoveryRunById(runId);
    const finalSession = await getSessionByRunId(runId);

    return {
      success: true,
      runId,
      sessionId,
      outcome,
      runStatus: finalRun?.status ?? 'unknown',
      sessionStatus: finalSession?.status ?? 'unknown',
    };

  } catch (error) {
    await t.rollback();
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[M5e] Controlled finalization failed: ${errMsg}`);

    return {
      success: false,
      runId,
      sessionId,
      outcome,
      runStatus: 'rollback',
      sessionStatus: 'rollback',
      error: errMsg,
    };
  }
}

/**
 * Execute a controlled Discovery run with budget enforcement.
 *
 * DISC-WEB-1D-2 M5e entry point. Wraps execution in AsyncLocalStorage context
 * so all downstream AI calls route through budgetedInvoke().
 *
 * Key invariants:
 * - Run must be bound to session before execution
 * - All AI calls go through budgetedInvoke (context-based routing)
 * - Single finalization transaction for both success and failure
 * - Fail-closed: any error triggers failure finalization
 *
 * @param runId - Discovery run ID (must be controlled)
 * @param sessionId - Controlled test session ID (bound to run)
 * @param workerId - Worker ID claiming the run
 */
export async function executeControlledDiscoveryRun(
  runId: number,
  sessionId: number,
  workerId: string,
): Promise<DiscoveryExecutionResult> {
  // Load run to verify it's controlled and session binding
  const run = await runService.getDiscoveryRunById(runId);
  if (!run) {
    throw new Error(`Discovery run ${runId} not found`);
  }

  if (!run.is_controlled) {
    throw new Error(
      `Run ${runId} is not a controlled run — use executeDiscoveryRun() instead`,
    );
  }

  // Verify session binding (defense in depth — budget reservation will also check)
  const session = await getSessionByRunId(runId);
  if (!session) {
    throw new Error(
      `No session bound to run ${runId} — controlled runs require budget enforcement`,
    );
  }

  if (session.id !== sessionId) {
    throw new Error(
      `Session mismatch: expected ${sessionId}, found ${session.id} bound to run ${runId}`,
    );
  }

  if (session.status !== 'active') {
    throw new Error(
      `Session ${sessionId} is ${session.status} — cannot execute controlled run`,
    );
  }

  console.log(
    `[M5e] Starting controlled execution: run=${runId}, session=${sessionId}, worker=${workerId}`,
  );

  try {
    // Execute within controlled context
    // All downstream AI calls will route through budgetedInvoke()
    const result = await runInControlledContext(
      {
        sessionId,
        discoveryRunId: runId,
        purpose: `controlled-discovery-${run.topic_slug}`,
      },
      async () => {
        // Remove the M5d guard — we ARE the controlled execution path
        // Update run to remove the is_controlled flag check in executeDiscoveryRun
        // Actually, we need to use a modified execution path that doesn't check is_controlled

        // For M5e, we inline the execution logic without the M5d guard
        // This is intentional — controlled execution IS authorized here
        return await executeControlledDiscoveryRunInner(runId, workerId);
      },
    );

    // Success — finalize atomically
    const finalization = await finalizeControlledExecution(
      runId,
      sessionId,
      'completed',
    );

    if (!finalization.success) {
      console.error(
        `[M5e] Finalization failed after successful execution: ${finalization.error}`,
      );
      // Execution succeeded but finalization failed — log but return result
      // The run will be in an inconsistent state that requires manual intervention
    }

    console.log(
      `[M5e] Controlled execution completed: run=${runId}, session=${sessionId}`,
    );

    return result;

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[M5e] Controlled execution failed: ${errMsg}`);

    // Failure — finalize atomically
    const finalization = await finalizeControlledExecution(
      runId,
      sessionId,
      'failed',
      errMsg.substring(0, 500),
    );

    if (!finalization.success) {
      console.error(
        `[M5e] Finalization also failed: ${finalization.error}`,
      );
    }

    throw error;
  }
}

/**
 * Inner execution logic for controlled runs.
 * Mirrors executeDiscoveryRun but without the M5d guard.
 *
 * This is separated to allow controlled context to wrap the execution
 * while reusing the core execution logic.
 */
async function executeControlledDiscoveryRunInner(
  runId: number,
  workerId: string,
): Promise<DiscoveryExecutionResult> {
  // Load run with associations
  const run = await runService.getDiscoveryRunById(runId);
  if (!run) {
    throw new Error(`Discovery run ${runId} not found`);
  }

  // Validate worker ownership
  if (run.worker_id !== workerId) {
    throw new claimService.NotOwnerError(runId, workerId);
  }

  if (run.status !== 'processing') {
    throw new Error(`Run ${runId} is not in processing status (is ${run.status})`);
  }

  // NOTE: No M5d guard here — this IS the controlled execution path

  const typeConfig = DISCOVERY_TYPES[run.discovery_type as DiscoveryTypeKey];
  if (!typeConfig) {
    throw new Error(`Unknown discovery type: ${run.discovery_type}`);
  }

  // Load associated sources
  const DiscoveryRunSourceModelInner = sequelize.models.DiscoveryRunSource;
  const EvidenceSourceModelInner = sequelize.models.EvidenceSource;

  const runSources = await DiscoveryRunSourceModelInner.findAll({
    where: { discovery_run_id: run.id },
    order: [['source_order', 'ASC']],
  });

  const sourceIds = runSources.map((rs: any) => rs.evidence_source_id);
  const evidenceSources = await EvidenceSourceModelInner.findAll({
    where: { id: { [Op.in]: sourceIds } },
  }) as EvidenceSource[];

  // Order sources by run source order
  const sourceMap = new Map(evidenceSources.map(s => [s.id, s]));
  const orderedSources = sourceIds.map(id => sourceMap.get(id)).filter(Boolean) as EvidenceSource[];

  if (orderedSources.length === 0) {
    throw new Error(`Run ${runId} has no associated sources`);
  }

  // Load project for context
  const project = await getProjectById(run.project_id);
  if (!project) {
    throw new Error(`Project ${run.project_id} not found`);
  }

  const projectSlug = project.slug;
  const projectProblemStatement = project.problem_statement || null;

  // Scaffold discovery folders
  await scaffoldDiscoveryFolders(projectSlug);

  // Build documents from sources
  const documents: DocumentInput[] = [];
  for (const source of orderedSources) {
    const artifactRef = source.artifact_ref as {
      filename?: string;
      content_hash?: string;
      mime_type?: string;
      size_bytes?: number;
      extracted_text?: string;
    } | null;

    const metadata = source.metadata as {
      content_length?: number;
      extracted_text?: string;
    } | null;

    const extractedText = metadata?.extracted_text || artifactRef?.extracted_text;

    if (!extractedText) {
      throw new Error(
        `Source ${source.id} has no extracted text available. ` +
        `This indicates a content storage issue.`
      );
    }

    documents.push({
      name: source.label,
      content: extractedText,
      type: artifactRef?.mime_type || 'application/octet-stream',
      size: artifactRef?.size_bytes || 0,
    });
  }

  // Parse documents
  const parsedDocuments = parseDocuments(documents);
  const formattedDocumentContent: string = parsedDocuments.structured_format;

  const MIME_LABELS: Record<string, string> = {
    'application/pdf': 'PDF',
    'text/plain': 'Text',
    'text/markdown': 'Markdown',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
    'application/msword': 'Word',
  };

  const documentNames = documents.map(d => d.name);
  const documentTypes = documents.map(d => MIME_LABELS[d.type] || d.type);

  // Privacy gate
  const privacyResult = authorizeForModel(
    formattedDocumentContent,
    'DISCOVERY_UPLOAD',
    { projectId: run.project_id, sourceId: `discovery:${run.discovery_type}:${run.topic_slug}` },
  );

  if (privacyResult.status === 'pending_review') {
    const piiFindings = scanForPii(formattedDocumentContent);
    await claimService.failRun(run.id, workerId, 'PRIVACY_VIOLATION', 'PII detected in documents', 'privacy_scan');
    throw new PrivacyError(
      'Privacy scan detected potential PII in uploaded files',
      piiFindings.map((f: { label: string; snippet: string }) => ({ label: f.label, snippet: f.snippet })),
    );
  }

  if (privacyResult.status === 'denied') {
    await claimService.failRun(run.id, workerId, 'CONTENT_DENIED', privacyResult.reason || 'Unknown', 'content_auth');
    throw new Error(`Content authorization failed: ${privacyResult.reason}`);
  }

  // Build template data
  const contentFingerprint = computeContentHash(privacyResult.modelSafeContent!).substring(0, 16);

  const data: Record<string, unknown> = {
    topic: run.topic,
    effective_topic: run.topic,
    topic_slug: run.topic_slug,
    project_slug: projectSlug,
    project_problem_statement: projectProblemStatement,
    source_intent: run.source_intent,
    description: run.source_intent || run.topic,
    document_content: privacyResult.modelSafeContent!,
    combined_file_content: privacyResult.modelSafeContent!,
    _discovery_type: typeConfig.type,
    selected_study: `discovery-${run.topic_slug}`,
    study_name: run.topic,
    document_count: documents.length,
    document_names: documentNames,
    document_types: documentTypes,
  };

  // Stakeholder-specific fields
  if (run.discovery_type === 'stakeholder_synthesis') {
    data.researcher_contact = run.created_by_identity;
    data.detected_files = documents.map(d => d.name).join('\n- ');
    data.file_list = documents.map(d => d.name);
  }

  // Artifact identity context
  data.__artifactContext = {
    projectId: run.project_id,
    studyId: null,
    artifactType: 'discovery',
    title: `${run.discovery_type.replace(/_/g, ' ')} — ${run.topic}`,
    canonicalUpstreamInputs: [`content:${contentFingerprint}`],
    createdBy: run.created_by_identity,
  };

  // Execute YAML template processing
  let artifact;
  try {
    // Fetch and parse YAML template
    const file = await fetchFileFromRepo(getConfigRepo(), YAML_TEMPLATE_PATH, typeConfig.yaml);
    const yamlConfig = yaml.load(file.content) as {
      id?: string;
      version?: string;
      emits?: EmitSpec[];
    } | null;

    if (!yamlConfig) {
      throw new Error(`Failed to parse YAML template: ${typeConfig.yaml}`);
    }

    const templateVersion = yamlConfig.version || null;
    const emitsSpec: EmitSpec[] = yamlConfig.emits || [];

    // Process YAML with dryRun=true
    const variableContext: VariableContext = {
      projectId: run.project_id,
    };

    // Update heartbeat before long-running AI call
    await claimService.updateHeartbeat(run.id, workerId);

    // AI calls within this block route through budgetedInvoke via controlled context
    const dryRunResult = await processYamlTemplate(
      file.content, data, '', '', false, variableContext, undefined, true,
    );

    // Update heartbeat after AI call
    await claimService.updateHeartbeat(run.id, workerId);

    // Create DiscoveryArtifact (no AI call)
    artifact = await artifactService.createDiscoveryArtifact({
      projectId: run.project_id,
      discoveryRunId: run.id,
      artifactType: run.discovery_type as 'desk_research' | 'stakeholder_synthesis' | 'survey_synthesis' | 'cross_source_synthesis',
      title: `${typeConfig.label}: ${run.topic}`,
      topicSlug: run.topic_slug,
      canonicalContent: dryRunResult.outputTemplate || null,
      templateName: typeConfig.yaml.replace('.yaml', ''),
      templateVersion,
      derivationFingerprint: contentFingerprint,
      actorId: run.actor_id,
      generatedByIdentity: run.created_by_identity,
    });

    // GitHub projection (no AI call)
    let githubResult: { path: string; sha: string; url: string };
    try {
      githubResult = await createOrUpdateFileOnGitHub(dryRunResult.path, dryRunResult.content);
      await artifactService.recordProjection(artifact.id, {
        githubPath: githubResult.path,
        githubSha: githubResult.sha,
      });
    } catch (githubError) {
      const githubMsg = githubError instanceof Error ? githubError.message : String(githubError);
      console.warn(`⚠️ GitHub projection failed (non-blocking): ${githubMsg}`);
      await artifactService.recordProjectionError(artifact.id, githubMsg);
      githubResult = {
        path: dryRunResult.path,
        sha: 'projection-failed',
        url: `https://github.com/${process.env.GITHUB_OWNER}/${process.env.GITHUB_REPO}/blob/main/${dryRunResult.path}`,
      };
    }

    // Variable extraction with artifact FK (has AI calls)
    let extractionSuccess = true;
    let extractionVariableCount = 0;

    if (emitsSpec.length > 0) {
      // Update heartbeat before extraction AI calls
      await claimService.updateHeartbeat(run.id, workerId);

      const extractResult = await extractAndPersistDiscoveryVariables({
        templateId: yamlConfig.id || typeConfig.yaml.replace('.yaml', ''),
        templateVersion: templateVersion || '',
        emitsSpec,
        outputTemplate: dryRunResult.outputTemplate,
        inputValues: data,
        variableContext,
        discoveryArtifactFkId: artifact.id,
      });

      extractionSuccess = extractResult.success;
      extractionVariableCount = extractResult.variableCount || 0;

      // M5e: Controlled runs FAIL on extraction failure (not best-effort like ordinary runs)
      if (!extractResult.success) {
        throw new Error(`Controlled extraction failed: ${extractResult.error}`);
      }
    }

    // DR-2: Insight extraction (has AI calls) — skip for controlled runs
    // Insight extraction is not part of controlled test scope
    console.log(`[M5e] Skipping insight extraction for controlled run ${runId}`);

    // Finalize artifact
    await artifactService.finalizeArtifactSupersession(artifact.id);

    // NOTE: Run completion happens in finalizeControlledExecution, not here

    console.log(`[M5e] Controlled run ${run.public_id} execution completed (pending finalization)`);

    return {
      runPublicId: run.public_id,
      artifactPublicId: artifact.public_id,
      topicSlug: run.topic_slug,
      typeLabel: typeConfig.label,
      githubUrl: githubResult.url,
      extractionSuccess,
      extractionVariableCount,
      // Controlled runs don't do insight extraction
      insightExtractionSuccess: undefined,
      insightsCreated: undefined,
      insightsSkipped: undefined,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Mark artifact as failed if it was created
    if (artifact) {
      await artifactService.markArtifactFailed(artifact.id);
    }

    // NOTE: Run failure happens in finalizeControlledExecution, not here
    // We just rethrow — the outer handler will finalize

    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DISC-WEB-1D-2 M5e: API-DRIVEN CONTROLLED EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Result of API-driven controlled execution.
 */
export interface ControlledExecutionApiResult {
  success: boolean;
  run?: DiscoveryRun;
  artifactPublicId?: string;
  githubUrl?: string;
  extractionSuccess?: boolean;
  extractionVariableCount?: number;
  statusCode?: number;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Execute a controlled Discovery run from API request.
 *
 * DISC-WEB-1D-2 M5e: API entry point for controlled execution.
 *
 * Orchestrates:
 * 1. Resolve run by public ID
 * 2. Validate run is controlled and pending
 * 3. Lookup bound session and verify actor ownership
 * 4. Verify session is active
 * 5. Atomically claim the run
 * 6. Execute within controlled context
 * 7. Return result with final run status
 *
 * @param input - API execution input
 * @returns Execution result with final status
 */
export async function executeControlledDiscoveryRunFromApi(input: {
  projectId: number;
  runPublicId: string;
  actorId: number;
  actorPublicId: string;
}): Promise<ControlledExecutionApiResult> {
  const { projectId, runPublicId, actorId, actorPublicId } = input;

  // Step 1: Resolve run by public ID
  const run = await runService.getDiscoveryRunByPublicId(runPublicId);
  if (!run) {
    return {
      success: false,
      statusCode: 404,
      errorCode: 'NOT_FOUND',
      errorMessage: `Discovery run ${runPublicId} not found`,
    };
  }

  // Verify project match
  if (run.project_id !== projectId) {
    return {
      success: false,
      statusCode: 404,
      errorCode: 'NOT_FOUND',
      errorMessage: `Discovery run ${runPublicId} not found in this project`,
    };
  }

  // Step 2: Lookup bound session (to get session ID for atomic claim)
  // Note: Actual authorization happens atomically in authorizeAndClaimControlledRun
  const session = await getSessionByRunId(run.id);
  if (!session) {
    return {
      success: false,
      run,
      statusCode: 409,
      errorCode: 'SESSION_NOT_BOUND',
      errorMessage: 'No session is bound to this controlled run',
    };
  }

  // Generate unique worker ID for this API execution
  const workerId = `api:${actorPublicId}:${Date.now()}`;

  // Step 3: Atomically authorize and claim the run
  // This single transaction verifies:
  // - Actor owns session (created_by_actor_id === actorId)
  // - Session is active
  // - Session is bound to this run
  // - Run is controlled
  // - Run is pending
  // - Then transitions run to processing
  let claimedRun: DiscoveryRun;
  let claimSessionId: number;
  try {
    const claimResult = await claimService.authorizeAndClaimControlledRun(
      session.id,
      run.id,
      actorId,
      workerId,
    );
    claimedRun = claimResult.run;
    claimSessionId = claimResult.sessionId;
  } catch (error) {
    if (error instanceof claimService.SessionNotFoundError) {
      return {
        success: false,
        run,
        statusCode: 409,
        errorCode: 'SESSION_NOT_BOUND',
        errorMessage: error.message,
      };
    }
    if (error instanceof claimService.SessionActorMismatchError) {
      return {
        success: false,
        run,
        statusCode: 403,
        errorCode: ApiErrorCode.CONTROLLED_SESSION_ACTOR_MISMATCH,
        errorMessage: 'Actor does not own the session bound to this run',
      };
    }
    if (error instanceof claimService.SessionNotActiveError) {
      return {
        success: false,
        run,
        statusCode: 409,
        errorCode: ApiErrorCode.CONTROLLED_SESSION_NOT_ACTIVE,
        errorMessage: error.message,
      };
    }
    if (error instanceof claimService.SessionRunBindingMismatchError) {
      return {
        success: false,
        run,
        statusCode: 409,
        errorCode: 'SESSION_RUN_BINDING_MISMATCH',
        errorMessage: error.message,
      };
    }
    if (error instanceof claimService.RunNotControlledError) {
      return {
        success: false,
        run,
        statusCode: 400,
        errorCode: 'RUN_NOT_CONTROLLED',
        errorMessage: 'Run is not a controlled run — cannot execute via this endpoint',
      };
    }
    if (error instanceof claimService.RunAlreadyClaimedError) {
      return {
        success: false,
        run,
        statusCode: 409,
        errorCode: 'RUN_ALREADY_CLAIMED',
        errorMessage: error.message,
      };
    }
    if (error instanceof claimService.RunNotPendingError) {
      return {
        success: false,
        run,
        statusCode: 409,
        errorCode: 'RUN_NOT_PENDING',
        errorMessage: error.message,
      };
    }
    throw error;
  }

  // Step 4: Execute within controlled context
  console.log(
    `[M5e-API] Starting controlled execution: run=${run.id}, session=${claimSessionId}, worker=${workerId}`,
  );

  try {
    const result = await executeControlledDiscoveryRun(
      claimedRun.id,
      claimSessionId,
      workerId,
    );

    // Reload run for final status
    const finalRun = await runService.getDiscoveryRunById(run.id);
    if (!finalRun) {
      return {
        success: false,
        statusCode: 500,
        errorCode: 'RUN_DISAPPEARED',
        errorMessage: 'Run no longer exists after execution',
      };
    }

    // Verify final status is completed (not failed due to finalization race)
    if (finalRun.status !== 'completed') {
      return {
        success: false,
        run: finalRun,
        statusCode: 500,
        errorCode: 'FINALIZATION_FAILED',
        errorMessage: `Run ended with status ${finalRun.status} instead of completed`,
      };
    }

    return {
      success: true,
      run: finalRun,
      artifactPublicId: result.artifactPublicId,
      githubUrl: result.githubUrl,
      extractionSuccess: result.extractionSuccess,
      extractionVariableCount: result.extractionVariableCount,
    };

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[M5e-API] Controlled execution failed: ${errMsg}`);

    // Reload run for final status
    const finalRun = await runService.getDiscoveryRunById(run.id);

    return {
      success: false,
      run: finalRun ?? run,
      statusCode: 500,
      errorCode: 'EXECUTION_FAILED',
      errorMessage: errMsg,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY: SYNCHRONOUS EXECUTION (for Slack backward compatibility)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Execute Discovery synchronously (legacy Slack path).
 *
 * Creates run + sources, then executes immediately in same request.
 * Used by Slack handler for backward compatibility.
 *
 * For REST API, use createPendingDiscoveryRun + worker execution instead.
 */
export async function executeDiscovery(
  ctx: ApplicationContext,
  input: DiscoveryInput,
): Promise<DiscoveryResult> {
  // Authorization
  await assertProjectAccessByActor(ctx.actor.id, input.projectId, ctx.organization.id);

  const typeConfig = DISCOVERY_TYPES[input.discoveryType];
  if (!typeConfig) {
    throw new Error(`Unknown discovery type: ${input.discoveryType}`);
  }

  if (!input.topic || !slugifyTopic(input.topic)) {
    throw new Error('Topic must contain alphanumeric characters');
  }

  if (input.documents.length === 0) {
    throw new Error('At least one document is required');
  }

  // Validate documents
  const validation = validateDocuments(input.documents);
  if (!validation.isValid) {
    throw new Error(validation.message);
  }

  // Convert legacy DocumentInput to PreparedDiscoverySource
  const sources: PreparedDiscoverySource[] = input.documents.map(d => ({
    filename: d.name,
    extractedText: d.content,
    contentHash: computeContentHash(d.content),
    mimeType: d.type,
    sizeBytes: d.size,
    metadata: {
      slackFileId: (d as Record<string, unknown>).slackFileId as string | undefined,
      source: 'slack' as const,
    },
  }));

  // Create pending run
  const run = await createPendingDiscoveryRun({
    projectId: input.projectId,
    projectSlug: input.projectSlug,
    discoveryType: input.discoveryType,
    topic: input.topic,
    sourceIntent: input.description,
    sources,
    createdByIdentity: `slack:${input.createdByActorId}`,
    actorId: ctx.actor.id,
  });

  // NOTE: createPendingDiscoveryRun → createDiscoverySources already stores
  // extracted_text in EvidenceSource metadata. No manual update needed.

  // Claim the run for sync execution
  const syncWorkerId = `sync-${run.public_id}`;
  await sequelize.query(
    `
    UPDATE discovery_runs
    SET
      status = 'processing',
      worker_id = :workerId,
      claimed_at = NOW(),
      heartbeat_at = NOW(),
      started_at = COALESCE(started_at, NOW()),
      updated_at = NOW()
    WHERE id = :runId
    `,
    {
      replacements: { workerId: syncWorkerId, runId: run.id },
    },
  );

  // Execute
  try {
    const result = await executeDiscoveryRun(run.id, syncWorkerId);

    return {
      url: result.githubUrl,
      topicSlug: result.topicSlug,
      typeLabel: result.typeLabel,
      extractionSuccess: result.extractionSuccess,
      extractionVariableCount: result.extractionVariableCount,
      runPublicId: result.runPublicId,
      artifactPublicId: result.artifactPublicId,
    };
  } catch (error) {
    // Run is already marked failed by executeDiscoveryRun
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// API QUERY METHODS
// ═══════════════════════════════════════════════════════════════════════════

const DiscoveryRunModel = sequelize.models.DiscoveryRun as typeof DiscoveryRun;
const DiscoveryArtifactModel = sequelize.models.DiscoveryArtifact;
const DiscoveryRunSourceModel = sequelize.models.DiscoveryRunSource;
const EvidenceSourceModel = sequelize.models.EvidenceSource;

/**
 * List Discovery runs for a project.
 */
export async function listDiscoveryRuns(
  ctx: ApplicationContext,
  projectId: number,
  options?: {
    discoveryType?: DiscoveryTypeKey;
    status?: string;
    limit?: number;
    offset?: number;
  },
): Promise<DiscoveryRunSummary[]> {
  await assertProjectAccessByActor(ctx.actor.id, projectId, ctx.organization.id);

  const where: Record<string, unknown> = { project_id: projectId };

  if (options?.discoveryType) {
    where.discovery_type = options.discoveryType;
  }

  if (options?.status) {
    where.status = options.status;
  }

  const runs = await DiscoveryRunModel.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit: options?.limit || 50,
    offset: options?.offset || 0,
  });

  // Get source counts
  const runIds = runs.map(r => r.id);
  const sourceCounts = await DiscoveryRunSourceModel.findAll({
    where: { discovery_run_id: { [Op.in]: runIds } },
    attributes: ['discovery_run_id', [sequelize.fn('COUNT', '*'), 'count']],
    group: ['discovery_run_id'],
  }) as unknown as Array<{ discovery_run_id: number; count: string }>;

  const sourceCountMap = new Map(sourceCounts.map(sc => [sc.discovery_run_id, parseInt(sc.count, 10)]));

  // Get current artifacts
  const artifacts = await DiscoveryArtifactModel.findAll({
    where: {
      discovery_run_id: { [Op.in]: runIds },
      status: 'current',
    },
    attributes: ['discovery_run_id', 'public_id'],
  }) as unknown as Array<{ discovery_run_id: number; public_id: string }>;

  const artifactMap = new Map(artifacts.map(a => [a.discovery_run_id, a.public_id]));

  return runs.map(run => ({
    publicId: run.public_id,
    discoveryType: run.discovery_type as DiscoveryTypeKey,
    topic: run.topic,
    topicSlug: run.topic_slug,
    sourceIntent: run.source_intent,
    status: run.status,
    stage: run.stage,
    sourceCount: sourceCountMap.get(run.id) || 0,
    attemptCount: run.attempt_count,
    createdAt: run.created_at.toISOString(),
    startedAt: run.started_at?.toISOString() || null,
    completedAt: run.completed_at?.toISOString() || null,
    createdBy: run.created_by_identity,
    currentArtifactPublicId: artifactMap.get(run.id) || null,
    failureCode: run.failure_code,
    failureMessage: run.failure_message,
    marker: formatMarker(run.discovery_type, run.marker_index),
  }));
}

/**
 * Get Discovery run detail by public ID.
 */
export async function getDiscoveryRunByPublicId(
  ctx: ApplicationContext,
  projectId: number,
  runPublicId: string,
): Promise<DiscoveryRunDetail | null> {
  await assertProjectAccessByActor(ctx.actor.id, projectId, ctx.organization.id);

  const run = await DiscoveryRunModel.findOne({
    where: {
      project_id: projectId,
      public_id: runPublicId,
    },
  });

  if (!run) {
    return null;
  }

  // Get sources
  const runSources = await DiscoveryRunSourceModel.findAll({
    where: { discovery_run_id: run.id },
    order: [['source_order', 'ASC']],
  }) as unknown as Array<{ evidence_source_id: number; source_order: number }>;

  const sourceIds = runSources.map(rs => rs.evidence_source_id);
  const sources = await EvidenceSourceModel.findAll({
    where: { id: { [Op.in]: sourceIds } },
  }) as EvidenceSource[];

  const sourceMap = new Map(sources.map(s => [s.id, s]));
  const orderedSources = runSources.map(rs => {
    const source = sourceMap.get(rs.evidence_source_id);
    return source ? {
      publicId: source.public_id,
      label: source.label,
      sourceType: source.source_type,
      order: rs.source_order,
    } : null;
  }).filter(Boolean) as Array<{ publicId: string; label: string; sourceType: string; order: number }>;

  // Get current artifact
  const artifact = await DiscoveryArtifactModel.findOne({
    where: {
      discovery_run_id: run.id,
      status: 'current',
    },
  }) as any;

  const runMarker = formatMarker(run.discovery_type, run.marker_index);

  const currentArtifact: DiscoveryArtifactSummary | null = artifact ? {
    publicId: artifact.public_id,
    runPublicId: run.public_id,
    artifactType: artifact.artifact_type,
    title: artifact.title,
    topicSlug: artifact.topic_slug,
    version: artifact.version,
    status: artifact.status,
    templateName: artifact.template_name,
    templateVersion: artifact.template_version,
    createdAt: artifact.created_at.toISOString(),
    githubPath: artifact.github_path,
    projectedAt: artifact.projected_at?.toISOString() || null,
    marker: runMarker,
    // DR-4d: Extraction status fields
    extractionStatus: artifact.extraction_status || null,
    extractionAttemptedAt: artifact.extraction_attempted_at?.toISOString() || null,
    extractionInsightCount: artifact.extraction_insight_count ?? null,
    extractionFailureReason: artifact.extraction_failure_reason || null,
    extractionPermanentFailure: artifact.extraction_permanent_failure ?? null,
    extractionNextRetryAt: artifact.extraction_next_retry_at?.toISOString() || null,
  } : null;

  return {
    publicId: run.public_id,
    discoveryType: run.discovery_type as DiscoveryTypeKey,
    topic: run.topic,
    topicSlug: run.topic_slug,
    sourceIntent: run.source_intent,
    status: run.status,
    stage: run.stage,
    sourceCount: orderedSources.length,
    attemptCount: run.attempt_count,
    createdAt: run.created_at.toISOString(),
    startedAt: run.started_at?.toISOString() || null,
    completedAt: run.completed_at?.toISOString() || null,
    createdBy: run.created_by_identity,
    currentArtifactPublicId: currentArtifact?.publicId || null,
    failureCode: run.failure_code,
    failureMessage: run.failure_message,
    marker: runMarker,
    sources: orderedSources,
    currentArtifact,
  };
}

/**
 * List Discovery artifacts for a project.
 */
export async function listCanonicalDiscoveryArtifacts(
  ctx: ApplicationContext,
  projectId: number,
  options?: {
    artifactType?: string;
    status?: string;
    limit?: number;
    offset?: number;
  },
): Promise<DiscoveryArtifactSummary[]> {
  await assertProjectAccessByActor(ctx.actor.id, projectId, ctx.organization.id);

  const where: Record<string, unknown> = { project_id: projectId };

  if (options?.artifactType) {
    where.artifact_type = options.artifactType;
  }

  if (options?.status) {
    where.status = options.status;
  } else {
    // Default to current artifacts only
    where.status = 'current';
  }

  const artifacts = await DiscoveryArtifactModel.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit: options?.limit || 50,
    offset: options?.offset || 0,
    include: [{
      model: DiscoveryRunModel,
      as: 'discoveryRun',
      attributes: ['public_id', 'discovery_type', 'marker_index'],
    }],
  }) as any[];

  return artifacts.map(a => ({
    publicId: a.public_id,
    runPublicId: a.discoveryRun?.public_id || '',
    artifactType: a.artifact_type,
    title: a.title,
    topicSlug: a.topic_slug,
    version: a.version,
    status: a.status,
    templateName: a.template_name,
    templateVersion: a.template_version,
    createdAt: a.created_at.toISOString(),
    githubPath: a.github_path,
    projectedAt: a.projected_at?.toISOString() || null,
    marker: a.discoveryRun
      ? formatMarker(a.discoveryRun.discovery_type, a.discoveryRun.marker_index)
      : null,
    // DR-4d: Extraction status fields (promoted from Detail)
    extractionStatus: a.extraction_status || null,
    extractionAttemptedAt: a.extraction_attempted_at?.toISOString() || null,
    extractionInsightCount: a.extraction_insight_count ?? null,
    extractionFailureReason: a.extraction_failure_reason || null,
    extractionPermanentFailure: a.extraction_permanent_failure ?? null,
    extractionNextRetryAt: a.extraction_next_retry_at?.toISOString() || null,
  }));
}

/**
 * Get Discovery artifact detail by public ID.
 */
export async function getDiscoveryArtifactByPublicId(
  ctx: ApplicationContext,
  projectId: number,
  artifactPublicId: string,
): Promise<DiscoveryArtifactDetail | null> {
  await assertProjectAccessByActor(ctx.actor.id, projectId, ctx.organization.id);

  const artifact = await DiscoveryArtifactModel.findOne({
    where: {
      project_id: projectId,
      public_id: artifactPublicId,
    },
    include: [{
      model: DiscoveryRunModel,
      as: 'discoveryRun',
      attributes: ['public_id', 'discovery_type', 'marker_index'],
    }],
  }) as any;

  if (!artifact) {
    return null;
  }

  // Get source count
  const sourceCount = await DiscoveryRunSourceModel.count({
    where: { discovery_run_id: artifact.discovery_run_id },
  });

  // Get supersession info
  let supersededById: string | null = null;
  if (artifact.superseded_by_id) {
    const superseding = await DiscoveryArtifactModel.findByPk(artifact.superseded_by_id, {
      attributes: ['public_id'],
    }) as any;
    supersededById = superseding?.public_id || null;
  }

  const marker = artifact.discoveryRun
    ? formatMarker(artifact.discoveryRun.discovery_type, artifact.discoveryRun.marker_index)
    : null;

  return {
    publicId: artifact.public_id,
    runPublicId: artifact.discoveryRun?.public_id || '',
    artifactType: artifact.artifact_type,
    title: artifact.title,
    topicSlug: artifact.topic_slug,
    version: artifact.version,
    status: artifact.status,
    templateName: artifact.template_name,
    templateVersion: artifact.template_version,
    createdAt: artifact.created_at.toISOString(),
    githubPath: artifact.github_path,
    projectedAt: artifact.projected_at?.toISOString() || null,
    canonicalContent: artifact.canonical_content,
    derivationFingerprint: artifact.derivation_fingerprint,
    githubSha: artifact.github_sha,
    projectionError: artifact.projection_error,
    supersededById,
    supersededAt: artifact.superseded_at?.toISOString() || null,
    sourceCount,
    marker,
    // DR-4a: Extraction status fields
    extractionStatus: artifact.extraction_status || null,
    extractionAttemptedAt: artifact.extraction_attempted_at?.toISOString() || null,
    extractionInsightCount: artifact.extraction_insight_count ?? null,
    extractionFailureReason: artifact.extraction_failure_reason || null,
    extractionPermanentFailure: artifact.extraction_permanent_failure ?? null,
    extractionNextRetryAt: artifact.extraction_next_retry_at?.toISOString() || null,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DISC-3B: ARTIFACT VARIABLES
// ═══════════════════════════════════════════════════════════════════════════

const StudyVariableModel = sequelize.models.StudyVariable;

const DISCOVERY_TYPE_LABELS: Record<string, string> = {
  desk_research: 'Desk Research',
  stakeholder_synthesis: 'Stakeholder Synthesis',
  survey_synthesis: 'Survey Synthesis',
  cross_source_synthesis: 'Cross-Source Synthesis',
};

/**
 * Get extracted variables for a Discovery artifact.
 *
 * DISC-3B: Queries canonical study_variables via discovery_artifact_fk_id lineage.
 * Does NOT query GitHub or regenerate variables.
 */
export async function getArtifactVariables(
  ctx: ApplicationContext,
  projectId: number,
  artifactPublicId: string,
): Promise<DiscoveryArtifactVariables | null> {
  await assertProjectAccessByActor(ctx.actor.id, projectId, ctx.organization.id);

  // Get artifact with run for marker
  const artifact = await DiscoveryArtifactModel.findOne({
    where: {
      project_id: projectId,
      public_id: artifactPublicId,
    },
    include: [{
      model: DiscoveryRunModel,
      as: 'discoveryRun',
      attributes: ['discovery_type', 'marker_index'],
    }],
  }) as any;

  if (!artifact) {
    return null;
  }

  // Query variables linked to this artifact
  const variables = await StudyVariableModel.findAll({
    where: {
      discovery_artifact_fk_id: artifact.id,
    },
    order: [['variable_key', 'ASC'], ['item_key', 'ASC']],
  }) as any[];

  // Transform to response format
  const variableItems: DiscoveryVariableItem[] = variables.map(v => ({
    key: v.variable_key,
    label: VARIABLE_LABELS[v.variable_key] || formatVariableLabel(v.variable_key),
    value: v.value,
    variableType: v.variable_type,
    itemId: v.item_key,
    isPool: v.is_pool || false,
    confidence: v.confidence,
  }));

  const marker = artifact.discoveryRun
    ? formatMarker(artifact.discoveryRun.discovery_type, artifact.discoveryRun.marker_index)
    : null;

  // Get latest extraction date
  const latestExtractedAt = variables.length > 0
    ? variables.reduce((latest, v) =>
        v.extracted_at > latest ? v.extracted_at : latest,
        variables[0].extracted_at,
      )
    : null;

  return {
    artifactPublicId: artifact.public_id,
    marker,
    artifactType: artifact.artifact_type,
    typeLabel: DISCOVERY_TYPE_LABELS[artifact.artifact_type] || artifact.artifact_type,
    variables: variableItems,
    variableCount: variableItems.length,
    extractedAt: latestExtractedAt?.toISOString() || null,
  };
}

/**
 * Format a variable key as a human-readable label.
 * Fallback when no explicit mapping exists.
 */
function formatVariableLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ═══════════════════════════════════════════════════════════════════════════
// DISC-3B: KNOWLEDGE GAPS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get aggregated knowledge gaps across all current Discovery artifacts for a project.
 *
 * DISC-3B: Queries canonical study_variables with variable_key='knowledge_gaps'
 * linked to CURRENT DiscoveryArtifacts. Preserves provenance for each gap.
 */
export async function getKnowledgeGaps(
  ctx: ApplicationContext,
  projectId: number,
): Promise<DiscoveryKnowledgeGapsResponse> {
  await assertProjectAccessByActor(ctx.actor.id, projectId, ctx.organization.id);

  // Get all current artifacts for the project
  const currentArtifacts = await DiscoveryArtifactModel.findAll({
    where: {
      project_id: projectId,
      status: 'current',
    },
    include: [{
      model: DiscoveryRunModel,
      as: 'discoveryRun',
      attributes: ['discovery_type', 'marker_index'],
    }],
  }) as any[];

  if (currentArtifacts.length === 0) {
    return {
      projectId,
      count: 0,
      gaps: [],
    };
  }

  const artifactIds = currentArtifacts.map(a => a.id);
  const artifactMap = new Map(currentArtifacts.map(a => [a.id, a]));

  // Query knowledge_gaps variables for current artifacts
  const variables = await StudyVariableModel.findAll({
    where: {
      discovery_artifact_fk_id: { [Op.in]: artifactIds },
      variable_key: 'knowledge_gaps',
    },
  }) as any[];

  // Transform to response format with provenance
  const gaps: DiscoveryKnowledgeGap[] = [];

  for (const v of variables) {
    const artifact = artifactMap.get(v.discovery_artifact_fk_id);
    if (!artifact) continue;

    const marker = artifact.discoveryRun
      ? formatMarker(artifact.discoveryRun.discovery_type, artifact.discoveryRun.marker_index)
      : null;

    // Handle both array and singleton values
    const gapValues = Array.isArray(v.value) ? v.value : [v.value];

    for (let i = 0; i < gapValues.length; i++) {
      const gapItem = gapValues[i];
      if (!gapItem) continue;

      // Extract gap text (handle both string and object shapes)
      const gapText = typeof gapItem === 'string'
        ? gapItem
        : (gapItem.gap || gapItem.description || gapItem.text || JSON.stringify(gapItem));

      // Extract item ID if present
      const itemId = typeof gapItem === 'object' && gapItem !== null
        ? (gapItem.id || gapItem.item_id || null)
        : (v.item_key ? `${v.item_key}-${i}` : null);

      gaps.push({
        gap: gapText,
        itemId,
        sourceArtifactPublicId: artifact.public_id,
        sourceMarker: marker,
        discoveryType: artifact.discoveryRun?.discovery_type as DiscoveryTypeKey || 'desk_research',
        sourceVariableKey: 'knowledge_gaps',
        extractedAt: v.extracted_at?.toISOString() || null,
      });
    }
  }

  return {
    projectId,
    count: gaps.length,
    gaps,
  };
}

// ─── Privacy Error ──────────────────────────────────────────────

export class PrivacyError extends Error {
  public readonly findings: PrivacyViolation[];

  constructor(message: string, findings: PrivacyViolation[]) {
    super(message);
    this.name = 'PrivacyError';
    this.findings = findings;
  }
}
