/**
 * Coaching Application Service — Coach M1
 *
 * Foundation service for AI Coach advisory runs. Handles creation, lifecycle
 * transitions, and persistence. Does NOT invoke AI providers or build context.
 *
 * CANONICAL ISOLATION: Coaching services MUST NOT call or modify:
 * - artifact_sections content
 * - artifact_version
 * - Brief/Plan save service
 * - Markdown projector
 * - GitHub sync/projector
 * - approval state/events
 * - Comments
 * - artifact canonical content
 *
 * Key invariants:
 * - Only one active run (pending/running) per requester+artifact+version+scope+section
 * - Historical runs (completed/failed) are immutable
 * - content_version is captured at creation and never changes
 * - Provenance fields are immutable after creation
 */

import type { ApplicationContext } from '../types/application-context';
import type { Transaction } from 'sequelize';
import type { CoachingRun, CoachingRunStatus, CoachingReviewScope, CoachingFailureCode } from '../database/models/coaching_run';
import type { CoachingRunItem, CoachingItemCategory } from '../database/models/coaching_run_item';
import type { CoachingRunReference } from '../database/models/coaching_run_reference';
import type { CoachingRunContext, CoachingContextRole } from '../database/models/coaching_run_context';
import type { CoachingRunSnapshot, CanonicalSnapshotContent } from '../database/models/coaching_run_snapshot';
import type { Actor } from '../database/models/actor';
import type { ResearchArtifact } from '../database/models/research_artifact';
import type { ResearchStudy } from '../database/models/research_study';
import type { ArtifactSection } from '../database/models/artifact_section';
import {
  authorizationDenied,
  resourceNotFound,
  validationError,
  coachRunAlreadyActive,
  coachRunInvalidState,
  coachRunNotRetryable,
} from '../types/api-errors';
import { assertProjectAccessByActor } from '../services/authorization.service';
import { getActiveContract } from '../coaching/contracts/registry';
import { getModelName } from '../helpers/modelProvider';
import sequelize from '../database';

// ─── Model References ──────────────────────────────────────────────────

const CoachingRunModel = sequelize.models.CoachingRun as typeof CoachingRun;
const CoachingRunItemModel = sequelize.models.CoachingRunItem as typeof CoachingRunItem;
const CoachingRunReferenceModel = sequelize.models.CoachingRunReference as typeof CoachingRunReference;
const CoachingRunContextModel = sequelize.models.CoachingRunContext as typeof CoachingRunContext;
const CoachingRunSnapshotModel = sequelize.models.CoachingRunSnapshot as typeof CoachingRunSnapshot;
const ActorModel = sequelize.models.Actor as typeof Actor;
const ArtifactModel = sequelize.models.ResearchArtifact as typeof ResearchArtifact;
const StudyModel = sequelize.models.ResearchStudy as typeof ResearchStudy;
const ArtifactSectionModel = sequelize.models.ArtifactSection as typeof ArtifactSection;

// ─── Internal Types ────────────────────────────────────────────────────

/**
 * Internal actor summary (uses internal IDs for service layer).
 */
export interface InternalActorSummary {
  id: number;
  public_id: string;
  display_name: string | null;
}

/**
 * Internal coaching run representation.
 */
export interface InternalCoachingRunDTO {
  id: string;
  study_id: number;
  artifact_id: number;
  artifact_public_id: string;
  artifact_type: string;
  content_version: number;
  selected_section_key: string | null;
  review_scope: CoachingReviewScope;
  status: CoachingRunStatus;
  requested_by: InternalActorSummary;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  retry_of_run_id: string | null;
  coaching_contract_version: string;
  prompt_template_version: string;
  provider: string;
  model: string;
  generation_config_json: Record<string, unknown> | null;
  failure_code: CoachingFailureCode | null;
  failure_diagnostic: string | null;
  /** Server-derived: true if this run can be retried by the researcher */
  retryable: boolean;
}

/**
 * Internal coaching run with items and context.
 */
export interface InternalCoachingRunDetailDTO extends InternalCoachingRunDTO {
  items: InternalCoachingRunItemDTO[];
  context: InternalCoachingRunContextDTO[];
}

/**
 * Internal coaching item representation.
 */
export interface InternalCoachingRunItemDTO {
  id: string;
  run_id: string;
  category: CoachingItemCategory;
  position: number;
  text: string;
  references: InternalCoachingRunReferenceDTO[];
}

/**
 * Internal coaching reference representation.
 */
export interface InternalCoachingRunReferenceDTO {
  id: string;
  item_id: string;
  object_type: string;
  object_id: string;
  section_key: string | null;
  label: string;
}

/**
 * Internal coaching context entry representation.
 */
export interface InternalCoachingRunContextDTO {
  id: string;
  run_id: string;
  object_type: string;
  object_id: string;
  object_version: number | null;
  section_key: string | null;
  context_role: CoachingContextRole;
  position: number;
}

/**
 * Input for creating a coaching run.
 */
export interface CreateCoachingRunInput {
  artifact_id: number;
  review_scope: CoachingReviewScope;
  selected_section_key: string | null;
  coaching_contract_version: string;
  prompt_template_version: string;
  provider: string;
  model: string;
  generation_config_json?: Record<string, unknown> | null;
}

/**
 * Input for recording coaching items.
 */
export interface RecordCoachingItemInput {
  category: CoachingItemCategory;
  position: number;
  text: string;
}

/**
 * Input for recording coaching references.
 */
export interface RecordCoachingReferenceInput {
  object_type: string;
  object_id: string;
  section_key: string | null;
  label: string;
}

/**
 * Input for recording coaching context.
 */
export interface RecordCoachingContextInput {
  object_type: string;
  object_id: string;
  object_version: number | null;
  section_key: string | null;
  context_role: CoachingContextRole;
  position: number;
}

/**
 * Input for recording usage metadata.
 */
export interface RecordCoachingUsageInput {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  estimated_cost?: number;
  actual_provider_cost?: number;
  latency_ms?: number;
}

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
 * Transform coaching run to internal DTO.
 */
async function toRunDTO(
  run: CoachingRun,
  artifactPublicId: string,
): Promise<InternalCoachingRunDTO> {
  const requester = await ActorModel.findByPk(run.requested_by);
  if (!requester) throw resourceNotFound('Run requester');

  return {
    id: run.id,
    study_id: run.study_id,
    artifact_id: run.artifact_id,
    artifact_public_id: artifactPublicId,
    artifact_type: run.artifact_type,
    content_version: run.content_version,
    selected_section_key: run.selected_section_key,
    review_scope: run.review_scope,
    status: run.status,
    requested_by: toActorSummary(requester),
    requested_at: run.requested_at.toISOString(),
    started_at: run.started_at ? run.started_at.toISOString() : null,
    completed_at: run.completed_at ? run.completed_at.toISOString() : null,
    failed_at: run.failed_at ? run.failed_at.toISOString() : null,
    retry_of_run_id: run.retry_of_run_id,
    coaching_contract_version: run.coaching_contract_version,
    prompt_template_version: run.prompt_template_version,
    provider: run.provider,
    model: run.model,
    generation_config_json: run.generation_config_json,
    failure_code: run.failure_code,
    failure_diagnostic: run.failure_diagnostic,
    retryable: isRunRetryable(run.status, run.review_scope, run.artifact_type, run.selected_section_key),
  };
}

/**
 * Transform coaching item to internal DTO.
 */
async function toItemDTO(item: CoachingRunItem): Promise<InternalCoachingRunItemDTO> {
  const references = await CoachingRunReferenceModel.findAll({
    where: { item_id: item.id },
    order: [['created_at', 'ASC']],
  }) as CoachingRunReference[];

  return {
    id: item.id,
    run_id: item.run_id,
    category: item.category,
    position: item.position,
    text: item.text,
    references: references.map(toReferenceDTO),
  };
}

/**
 * Transform coaching reference to internal DTO.
 */
function toReferenceDTO(ref: CoachingRunReference): InternalCoachingRunReferenceDTO {
  return {
    id: ref.id,
    item_id: ref.item_id,
    object_type: ref.object_type,
    object_id: ref.object_id,
    section_key: ref.section_key,
    label: ref.label,
  };
}

/**
 * Transform coaching context to internal DTO.
 */
function toContextDTO(ctx: CoachingRunContext): InternalCoachingRunContextDTO {
  return {
    id: ctx.id,
    run_id: ctx.run_id,
    object_type: ctx.object_type,
    object_id: ctx.object_id,
    object_version: ctx.object_version,
    section_key: ctx.section_key,
    context_role: ctx.context_role,
    position: ctx.position,
  };
}

// ─── Valid Section Keys ────────────────────────────────────────────────────
// CRITICAL: These keys MUST match artifact_sections.section_key exactly.
// See: packages/artifact-contracts/src/*.contract.ts for authoritative keys.
// See: frontend/src/components/study/document/sectionLabels.ts for alignment.
//
// CANONICAL SECTION IDENTITY RULE:
// Coach section identity uses the exact canonical artifact_sections.section_key.
// Do NOT use UI presentation IDs, heading labels, or invented Coach aliases.

const VALID_BRIEF_SECTIONS = [
  'summary',
  'problem_narrative',
  'method_prose',
  'participants_prose',
  'out_of_scope',
  'risks',
];

const VALID_PLAN_SECTIONS = [
  'plan_summary',
  'plan_background',
  'plan_method_approach',
  'plan_participants_prose',
  'plan_deliverables',
  'plan_risks',
  'plan_commitments',
];

function isValidSectionKey(artifactType: string, sectionKey: string): boolean {
  if (artifactType === 'brief') {
    return VALID_BRIEF_SECTIONS.includes(sectionKey);
  }
  if (artifactType === 'plan') {
    return VALID_PLAN_SECTIONS.includes(sectionKey);
  }
  return false;
}

// ─── Legacy Section Key Resolution ─────────────────────────────────────────
// M3C FIX: Some older failed runs may have non-canonical section keys from before
// the M3B canonical key standardization. This provides a deterministic server-side
// mapping from legacy keys to current canonical keys.
//
// IMPORTANT: This is ONLY for researcher retry of historical failed runs.
// New runs MUST use canonical keys from the start (enforced by isValidSectionKey).

const LEGACY_BRIEF_KEY_MAP: Record<string, string> = {
  // No known legacy brief keys currently
};

const LEGACY_PLAN_KEY_MAP: Record<string, string> = {
  // Legacy keys that may exist in older failed runs
  'background': 'plan_background',
  'summary': 'plan_summary',
  'method': 'plan_method_approach',
  'method_approach': 'plan_method_approach',
  'participants': 'plan_participants_prose',
  'participants_prose': 'plan_participants_prose',
  'deliverables': 'plan_deliverables',
  'risks': 'plan_risks',
  'commitments': 'plan_commitments',
};

/**
 * Attempt to resolve a legacy section key to its canonical form.
 *
 * @returns The canonical key if a deterministic mapping exists, or null if not resolvable
 */
function resolveLegacySectionKey(artifactType: string, legacyKey: string): string | null {
  const keyMap = artifactType === 'brief' ? LEGACY_BRIEF_KEY_MAP : LEGACY_PLAN_KEY_MAP;
  return keyMap[legacyKey] ?? null;
}

/**
 * Determine if a coaching run is retryable by the researcher.
 *
 * A run is retryable when:
 * - status === 'failed'
 * - AND (review_scope === 'artifact' OR section key resolves to canonical)
 *
 * This is the SERVER-AUTHORITATIVE determination of retryability.
 * Frontend uses this to show/hide Retry UI; backend still enforces on actual retry attempt.
 */
export function isRunRetryable(
  status: string,
  reviewScope: string,
  artifactType: string,
  selectedSectionKey: string | null
): boolean {
  // Only failed runs are retryable
  if (status !== 'failed') {
    return false;
  }

  // Artifact-scoped runs are always retryable (if failed)
  if (reviewScope === 'artifact') {
    return true;
  }

  // Section-scoped runs need a valid/resolvable section key
  if (reviewScope === 'section' && selectedSectionKey) {
    // Check if already canonical
    if (isValidSectionKey(artifactType, selectedSectionKey)) {
      return true;
    }
    // Check if resolvable legacy key
    const canonical = resolveLegacySectionKey(artifactType, selectedSectionKey);
    if (canonical && isValidSectionKey(artifactType, canonical)) {
      return true;
    }
  }

  // Malformed/unknown section key or missing key for section scope
  return false;
}

// ─── Service Functions ─────────────────────────────────────────────────

/**
 * Create a new coaching run.
 *
 * Validates:
 * - Actor has project access
 * - Artifact exists and belongs to a study
 * - Section key is valid for artifact type (if section-scoped)
 * - No active run exists for the same requester+artifact+version+scope+section
 *
 * Captures artifact content_version at creation (immutable provenance).
 * Creates immutable content snapshot transactionally with run.
 *
 * Coach M2: Snapshot ensures execution uses exact content at request time,
 * even if artifact is later edited before worker processes the run.
 */
export async function createCoachRun(
  ctx: ApplicationContext,
  input: CreateCoachingRunInput,
): Promise<InternalCoachingRunDTO> {
  // 1. Load artifact
  const artifact = await ArtifactModel.findByPk(input.artifact_id) as ResearchArtifact | null;
  if (!artifact) throw resourceNotFound('Artifact');

  if (!artifact.study_id) {
    throw validationError('Artifact has no associated study');
  }

  // 2. Load study
  const study = await StudyModel.findByPk(artifact.study_id) as ResearchStudy | null;
  if (!study) throw resourceNotFound('Study');

  // 3. Authorization: actor must have project access
  await assertProjectAccessByActor(ctx.actor.id, artifact.project_id, ctx.organization.id);

  // 4. Validate review scope and section key
  if (input.review_scope === 'section') {
    if (!input.selected_section_key) {
      throw validationError('Section key is required for section-scoped review');
    }
    if (!isValidSectionKey(artifact.artifact_type, input.selected_section_key)) {
      throw validationError(
        `Invalid section key '${input.selected_section_key}' for artifact type '${artifact.artifact_type}'`,
        { artifact_type: artifact.artifact_type, section_key: input.selected_section_key }
      );
    }
  } else if (input.review_scope === 'artifact') {
    if (input.selected_section_key) {
      throw validationError('Section key must be null for artifact-scoped review');
    }
  } else {
    throw validationError(`Invalid review scope: ${input.review_scope}`);
  }

  // 5. Check for existing active run (concurrency enforcement)
  // Note: Also enforced by partial unique index, but we check here for better error messages
  const existingActive = await CoachingRunModel.findOne({
    where: {
      requested_by: ctx.actor.id,
      artifact_id: input.artifact_id,
      content_version: artifact.content_version,
      review_scope: input.review_scope,
      selected_section_key: input.selected_section_key,
      status: ['pending', 'running'],
    },
  }) as CoachingRun | null;

  if (existingActive) {
    throw coachRunAlreadyActive(
      `A coaching run is already ${existingActive.status} for this artifact version and scope`
    );
  }

  // 6. Load artifact sections for snapshot (before transaction to avoid races)
  const sections = await ArtifactSectionModel.findAll({
    where: { artifact_id: input.artifact_id },
    order: [['section_key', 'ASC']],
  }) as ArtifactSection[];

  // Build snapshot content
  const snapshotContent: CanonicalSnapshotContent = {
    title: artifact.title,
    sections: {},
  };
  for (const section of sections) {
    snapshotContent.sections[section.section_key] = {
      content_type: section.content_type as 'prose' | 'structured_json',
      content: section.content,
    };
  }

  // 7. Create run and snapshot in transaction (atomic)
  // This ensures run.content_version == snapshot.content_version
  const transaction = await sequelize.transaction();

  try {
    // Re-verify content_version hasn't changed during our setup
    const currentArtifact = await ArtifactModel.findByPk(input.artifact_id, { transaction, lock: true }) as ResearchArtifact | null;
    if (!currentArtifact || currentArtifact.content_version !== artifact.content_version) {
      await transaction.rollback();
      throw validationError(
        'Artifact was modified while creating Coach run. Please retry.',
        { original_version: artifact.content_version, current_version: currentArtifact?.content_version }
      );
    }

    // Create the run
    const run = await CoachingRunModel.create({
      study_id: artifact.study_id,
      artifact_id: input.artifact_id,
      artifact_type: artifact.artifact_type,
      content_version: artifact.content_version,
      selected_section_key: input.selected_section_key,
      review_scope: input.review_scope,
      status: 'pending',
      requested_by: ctx.actor.id,
      coaching_contract_version: input.coaching_contract_version,
      prompt_template_version: input.prompt_template_version,
      provider: input.provider,
      model: input.model,
      generation_config_json: input.generation_config_json ?? null,
    }, { transaction }) as CoachingRun;

    // Create immutable snapshot
    await CoachingRunSnapshotModel.create({
      run_id: run.id,
      snapshot_schema_version: '1.0.0',
      artifact_type: artifact.artifact_type,
      artifact_id: artifact.id,
      artifact_public_id: artifact.public_id,
      content_version: artifact.content_version,
      canonical_snapshot_json: snapshotContent,
    }, { transaction });

    await transaction.commit();

    return toRunDTO(run, artifact.public_id);
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Get a coaching run by ID.
 */
export async function getCoachRun(
  ctx: ApplicationContext,
  runId: string,
): Promise<InternalCoachingRunDetailDTO> {
  const run = await CoachingRunModel.findByPk(runId) as CoachingRun | null;
  if (!run) throw resourceNotFound('Coaching run');

  // Load artifact for authorization and public_id
  const artifact = await ArtifactModel.findByPk(run.artifact_id) as ResearchArtifact | null;
  if (!artifact) throw resourceNotFound('Artifact');

  // Authorization: actor must have project access
  await assertProjectAccessByActor(ctx.actor.id, artifact.project_id, ctx.organization.id);

  // Load items with references
  const items = await CoachingRunItemModel.findAll({
    where: { run_id: runId },
    order: [['category', 'ASC'], ['position', 'ASC']],
  }) as CoachingRunItem[];

  const itemDTOs = await Promise.all(items.map(toItemDTO));

  // Load context
  const contextEntries = await CoachingRunContextModel.findAll({
    where: { run_id: runId },
    order: [['context_role', 'ASC'], ['position', 'ASC']],
  }) as CoachingRunContext[];

  const baseDTO = await toRunDTO(run, artifact.public_id);

  return {
    ...baseDTO,
    items: itemDTOs,
    context: contextEntries.map(toContextDTO),
  };
}

/**
 * List coaching runs for an artifact.
 */
export async function listCoachRunsForArtifact(
  ctx: ApplicationContext,
  artifactId: number,
  options?: {
    content_version?: number;
    status?: CoachingRunStatus;
    review_scope?: CoachingReviewScope;
    section_key?: string;
  },
): Promise<InternalCoachingRunDTO[]> {
  // Load artifact for authorization
  const artifact = await ArtifactModel.findByPk(artifactId) as ResearchArtifact | null;
  if (!artifact) throw resourceNotFound('Artifact');

  // Authorization: actor must have project access
  await assertProjectAccessByActor(ctx.actor.id, artifact.project_id, ctx.organization.id);

  // Build where clause
  const whereClause: Record<string, unknown> = { artifact_id: artifactId };
  if (options?.content_version !== undefined) {
    whereClause.content_version = options.content_version;
  }
  if (options?.status) {
    whereClause.status = options.status;
  }
  if (options?.review_scope) {
    whereClause.review_scope = options.review_scope;
  }
  if (options?.section_key) {
    whereClause.selected_section_key = options.section_key;
  }

  const runs = await CoachingRunModel.findAll({
    where: whereClause,
    order: [['requested_at', 'DESC']],
  }) as CoachingRun[];

  return Promise.all(runs.map(run => toRunDTO(run, artifact.public_id)));
}

/**
 * Mark a coaching run as running.
 * Only valid from 'pending' status.
 */
export async function markCoachRunRunning(
  runId: string,
  workerId?: string,
): Promise<void> {
  const run = await CoachingRunModel.findByPk(runId) as CoachingRun | null;
  if (!run) throw resourceNotFound('Coaching run');

  if (run.status !== 'pending') {
    throw coachRunInvalidState(`Cannot mark run as running from status '${run.status}'`);
  }

  await run.update({
    status: 'running',
    started_at: new Date(),
    claimed_at: new Date(),
    worker_id: workerId ?? null,
    last_attempt_at: new Date(),
  });
}

/**
 * Mark a coaching run as completed.
 * Only valid from 'running' status.
 */
export async function markCoachRunCompleted(
  runId: string,
): Promise<void> {
  const run = await CoachingRunModel.findByPk(runId) as CoachingRun | null;
  if (!run) throw resourceNotFound('Coaching run');

  if (run.status !== 'running') {
    throw coachRunInvalidState(`Cannot mark run as completed from status '${run.status}'`);
  }

  await run.update({
    status: 'completed',
    completed_at: new Date(),
  });
}

/**
 * Mark a coaching run as failed.
 * Only valid from 'running' status.
 */
export async function markCoachRunFailed(
  runId: string,
  failureCode: CoachingFailureCode,
  failureDiagnostic?: string,
): Promise<void> {
  const run = await CoachingRunModel.findByPk(runId) as CoachingRun | null;
  if (!run) throw resourceNotFound('Coaching run');

  if (run.status !== 'running') {
    throw coachRunInvalidState(`Cannot mark run as failed from status '${run.status}'`);
  }

  await run.update({
    status: 'failed',
    failed_at: new Date(),
    failure_code: failureCode,
    failure_diagnostic: failureDiagnostic ?? null,
  });
}

/**
 * Record coaching items for a run.
 * Should only be called when run is in 'running' status (will be enforced in M2).
 */
export async function recordCoachRunItems(
  runId: string,
  items: RecordCoachingItemInput[],
  transaction?: Transaction,
): Promise<CoachingRunItem[]> {
  const run = await CoachingRunModel.findByPk(runId) as CoachingRun | null;
  if (!run) throw resourceNotFound('Coaching run');

  const createdItems: CoachingRunItem[] = [];
  for (const input of items) {
    const item = await CoachingRunItemModel.create(
      {
        run_id: runId,
        category: input.category,
        position: input.position,
        text: input.text,
      },
      { transaction }
    ) as CoachingRunItem;
    createdItems.push(item);
  }

  return createdItems;
}

/**
 * Record coaching references for an item.
 */
export async function recordCoachRunReferences(
  itemId: string,
  references: RecordCoachingReferenceInput[],
  transaction?: Transaction,
): Promise<CoachingRunReference[]> {
  // CRITICAL: Use transaction for lookup — item may not be committed yet
  const item = await CoachingRunItemModel.findByPk(itemId, { transaction }) as CoachingRunItem | null;
  if (!item) throw resourceNotFound('Coaching run item');

  const createdRefs: CoachingRunReference[] = [];
  for (const input of references) {
    const ref = await CoachingRunReferenceModel.create(
      {
        item_id: itemId,
        object_type: input.object_type,
        object_id: input.object_id,
        section_key: input.section_key,
        label: input.label,
      },
      { transaction }
    ) as CoachingRunReference;
    createdRefs.push(ref);
  }

  return createdRefs;
}

/**
 * Record coaching context for a run.
 */
export async function recordCoachRunContext(
  runId: string,
  entries: RecordCoachingContextInput[],
  transaction?: Transaction,
): Promise<CoachingRunContext[]> {
  // Use transaction for consistency (run exists but use same isolation level)
  const run = await CoachingRunModel.findByPk(runId, { transaction }) as CoachingRun | null;
  if (!run) throw resourceNotFound('Coaching run');

  const createdEntries: CoachingRunContext[] = [];
  for (const input of entries) {
    const entry = await CoachingRunContextModel.create(
      {
        run_id: runId,
        object_type: input.object_type,
        object_id: input.object_id,
        object_version: input.object_version,
        section_key: input.section_key,
        context_role: input.context_role,
        position: input.position,
      },
      { transaction }
    ) as CoachingRunContext;
    createdEntries.push(entry);
  }

  return createdEntries;
}

/**
 * Record usage metadata for a run.
 * Updates the run with token counts, cost estimates, and latency.
 */
export async function recordCoachUsage(
  runId: string,
  usage: RecordCoachingUsageInput,
): Promise<void> {
  const run = await CoachingRunModel.findByPk(runId) as CoachingRun | null;
  if (!run) throw resourceNotFound('Coaching run');

  const updates: Partial<CoachingRun> = {};
  if (usage.input_tokens !== undefined) updates.input_tokens = usage.input_tokens;
  if (usage.output_tokens !== undefined) updates.output_tokens = usage.output_tokens;
  if (usage.total_tokens !== undefined) updates.total_tokens = usage.total_tokens;
  if (usage.estimated_cost !== undefined) updates.estimated_cost = usage.estimated_cost;
  if (usage.actual_provider_cost !== undefined) updates.actual_provider_cost = usage.actual_provider_cost;
  if (usage.latency_ms !== undefined) updates.latency_ms = usage.latency_ms;

  if (Object.keys(updates).length > 0) {
    await run.update(updates);
  }
}

/**
 * Create a researcher retry run.
 * Creates a NEW run linked to the original via retry_of_run_id.
 * The original run is not modified.
 *
 * Coach M3C: Researcher retry is ONLY available for failed runs.
 * Captures CURRENT artifact version/content and CURRENT approved contract/model.
 * The historical failed run's provenance remains unchanged.
 *
 * @param ctx - Application context with authenticated actor
 * @param originalRunId - ID of the failed run to retry
 * @returns The newly created retry run
 * @throws COACH_RUN_NOT_RETRYABLE if source run is not failed
 * @throws COACH_RUN_ALREADY_ACTIVE if active run exists for same scope
 * @throws VALIDATION_ERROR if section is no longer coachable
 */
export async function createResearcherRetryRun(
  ctx: ApplicationContext,
  originalRunId: string,
): Promise<InternalCoachingRunDTO> {
  // 1. Load original run
  const originalRun = await CoachingRunModel.findByPk(originalRunId) as CoachingRun | null;
  if (!originalRun) throw resourceNotFound('Original coaching run');

  // 2. M3C: Only FAILED runs can be retried (reject pending, running, completed)
  if (originalRun.status !== 'failed') {
    throw coachRunNotRetryable(
      `Cannot retry a run with status '${originalRun.status}'. Only failed runs can be retried.`
    );
  }

  // 3. Load artifact for current content_version
  const artifact = await ArtifactModel.findByPk(originalRun.artifact_id) as ResearchArtifact | null;
  if (!artifact) throw resourceNotFound('Artifact');

  // 4. Authorization: actor must have project access
  await assertProjectAccessByActor(ctx.actor.id, artifact.project_id, ctx.organization.id);

  // 5. Get CURRENT approved Coaching Contract (not original run's historical config)
  const contract = getActiveContract(artifact.artifact_type);
  if (!contract) {
    throw validationError(
      `Coaching is not available for artifact type '${artifact.artifact_type}'`,
      { artifact_type: artifact.artifact_type }
    );
  }

  // 6. M3C FIX: For section-scoped retries, resolve legacy keys and validate
  let resolvedSectionKey: string | null = originalRun.selected_section_key;

  if (originalRun.review_scope === 'section' && originalRun.selected_section_key) {
    // First check if the key is already canonical
    if (!contract.isValidSectionKey(originalRun.selected_section_key)) {
      // Attempt legacy key resolution
      const canonicalKey = resolveLegacySectionKey(
        artifact.artifact_type,
        originalRun.selected_section_key
      );

      if (canonicalKey && contract.isValidSectionKey(canonicalKey)) {
        // Successfully resolved legacy key to canonical
        resolvedSectionKey = canonicalKey;
      } else {
        // No valid mapping exists — reject retry with clear error
        const sectionLabel = contract.getSectionDisplayName(originalRun.selected_section_key)
          ?? originalRun.selected_section_key;
        throw validationError(
          `This older ${sectionLabel} review cannot be retried because the section identifier has changed. Please start a new review from the current section.`,
          {
            legacy_key: originalRun.selected_section_key,
            artifact_type: artifact.artifact_type,
            hint: 'Use "Review this section" to start a fresh review with the current section structure.',
          }
        );
      }
    }
  }

  // 7. Check for existing active run (concurrency enforcement)
  // M3C FIX: Use resolved section key for concurrency check
  const existingActive = await CoachingRunModel.findOne({
    where: {
      requested_by: ctx.actor.id,
      artifact_id: artifact.id,
      content_version: artifact.content_version,
      review_scope: originalRun.review_scope,
      selected_section_key: resolvedSectionKey,
      status: ['pending', 'running'],
    },
  }) as CoachingRun | null;

  if (existingActive) {
    throw coachRunAlreadyActive(
      `A coaching run is already ${existingActive.status} for this artifact version and scope`
    );
  }

  // 8. Load artifact sections for snapshot
  const sections = await ArtifactSectionModel.findAll({
    where: { artifact_id: originalRun.artifact_id },
    order: [['section_key', 'ASC']],
  }) as ArtifactSection[];

  // Build snapshot content
  const snapshotContent: CanonicalSnapshotContent = {
    title: artifact.title,
    sections: {},
  };
  for (const section of sections) {
    snapshotContent.sections[section.section_key] = {
      content_type: section.content_type as 'prose' | 'structured_json',
      content: section.content,
    };
  }

  // 9. Create run and snapshot in transaction
  const transaction = await sequelize.transaction();

  try {
    // Re-verify content_version hasn't changed
    const currentArtifact = await ArtifactModel.findByPk(originalRun.artifact_id, { transaction, lock: true }) as ResearchArtifact | null;
    if (!currentArtifact || currentArtifact.content_version !== artifact.content_version) {
      await transaction.rollback();
      throw validationError(
        'Artifact was modified while creating Coach retry. Please retry.',
        { original_version: artifact.content_version, current_version: currentArtifact?.content_version }
      );
    }

    // Create retry run with CURRENT approved contract/model configuration
    // M3C FIX: Use resolved section key (may differ from original if legacy key was migrated)
    const run = await CoachingRunModel.create({
      study_id: originalRun.study_id,
      artifact_id: originalRun.artifact_id,
      artifact_type: artifact.artifact_type,
      content_version: artifact.content_version, // Current version, not original
      selected_section_key: resolvedSectionKey, // M3C FIX: Use resolved canonical key
      review_scope: originalRun.review_scope,
      status: 'pending',
      requested_by: ctx.actor.id,
      retry_of_run_id: originalRunId,
      // M3C: Use CURRENT approved contract/model, not original run's historical config
      coaching_contract_version: contract.contractVersion,
      prompt_template_version: contract.promptTemplateVersion,
      provider: 'anthropic',
      model: getModelName(contract.modelConfig.tier),
      generation_config_json: {
        temperature: contract.modelConfig.temperature,
        max_tokens: contract.modelConfig.maxOutputTokens,
      },
    }, { transaction }) as CoachingRun;

    // Create immutable snapshot for the NEW run
    await CoachingRunSnapshotModel.create({
      run_id: run.id,
      snapshot_schema_version: '1.0.0',
      artifact_type: artifact.artifact_type,
      artifact_id: artifact.id,
      artifact_public_id: artifact.public_id,
      content_version: artifact.content_version,
      canonical_snapshot_json: snapshotContent,
    }, { transaction });

    await transaction.commit();

    return toRunDTO(run, artifact.public_id);
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

/**
 * Increment attempt count for operational retry.
 * This is for the same run being retried by a worker, not a researcher retry.
 */
export async function incrementAttemptCount(
  runId: string,
  workerId?: string,
): Promise<void> {
  const run = await CoachingRunModel.findByPk(runId) as CoachingRun | null;
  if (!run) throw resourceNotFound('Coaching run');

  await run.update({
    attempt_count: run.attempt_count + 1,
    last_attempt_at: new Date(),
    claimed_at: new Date(),
    worker_id: workerId ?? null,
  });
}

/**
 * Update heartbeat for a running job.
 */
export async function updateHeartbeat(runId: string): Promise<void> {
  const run = await CoachingRunModel.findByPk(runId) as CoachingRun | null;
  if (!run) throw resourceNotFound('Coaching run');

  await run.update({ heartbeat_at: new Date() });
}

/**
 * Get the immutable snapshot for a coaching run.
 * Returns the exact artifact content captured at run creation time.
 *
 * Coach M2: This is the authoritative source for execution context.
 * The current artifact content may have changed since run creation.
 */
export async function getCoachRunSnapshot(
  runId: string,
): Promise<CoachingRunSnapshot | null> {
  const snapshot = await CoachingRunSnapshotModel.findOne({
    where: { run_id: runId },
  }) as CoachingRunSnapshot | null;

  return snapshot;
}
