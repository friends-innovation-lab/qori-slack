/**
 * Coaching Routes — Coach M3A
 *
 * REST API endpoints for AI Coach advisory runs.
 *
 * PUBLIC ID BOUNDARY: Routes receive and return public UUIDs only.
 * Internal integer IDs never cross the API boundary.
 *
 * Routes:
 * - GET  /api/v1/artifacts/:artifactPublicId/coaching     → List coaching runs
 * - POST /api/v1/artifacts/:artifactPublicId/coaching     → Create artifact-level review
 * - GET  /api/v1/coaching/runs/:runId                     → Get run detail
 *
 * CANONICAL ISOLATION: Coaching routes MUST NOT modify:
 * - artifact_sections content
 * - artifact_version
 * - Brief/Plan save state
 * - Markdown projection
 * - GitHub sync
 * - Approval state
 * - Comments
 */

import { Router } from 'express';
import { requireAuth } from '../../../middleware/auth';
import * as coachingAppService from '../../../application/coaching.app-service';
import type {
  CoachRunSummaryResource,
  CoachRunDetailResource,
  CoachRunRequesterSummary,
  CoachRunItemResource,
  CoachRunReferenceResource,
  CoachRunContextEntryResource,
  CoachRunListResponse,
  CoachRunDetailResponse,
  CreateCoachRunResponse,
  CoachRunStatus,
  CoachReviewScope,
  CoachFailureCode,
} from '@qori/api-contracts';
import type {
  InternalCoachingRunDTO,
  InternalCoachingRunDetailDTO,
  InternalActorSummary,
} from '../../../application/coaching.app-service';
import { resourceNotFound, validationError } from '../../../types/api-errors';
import { getActiveContract } from '../../../coaching/contracts/registry';
import sequelize from '../../../database';
import type { ResearchArtifact } from '../../../database/models/research_artifact';

const router = Router();

const ArtifactModel = sequelize.models.ResearchArtifact as typeof ResearchArtifact;

// ─── Public ID Lookup Helpers ──────────────────────────────────────────────

/**
 * Look up artifact by public ID, return artifact with internal ID.
 */
async function resolveArtifact(
  publicId: string,
): Promise<{ id: number; artifact_type: string; content_version: number; public_id: string }> {
  const artifact = (await ArtifactModel.findOne({
    where: { public_id: publicId },
    attributes: ['id', 'artifact_type', 'content_version', 'public_id'],
  })) as { id: number; artifact_type: string; content_version: number; public_id: string } | null;

  if (!artifact) {
    throw resourceNotFound('Artifact');
  }

  return artifact;
}

// ─── DTO → Resource Mappers ────────────────────────────────────────────────

/**
 * Map internal actor summary to public requester summary.
 * Strips internal `id`, keeps only `public_id` and `display_name`.
 */
function toRequesterSummary(internal: InternalActorSummary): CoachRunRequesterSummary {
  return {
    public_id: internal.public_id,
    display_name: internal.display_name,
  };
}

/**
 * Sanitize failure code to human-readable message.
 * Never expose raw diagnostics to clients.
 */
function sanitizeFailureMessage(code: CoachFailureCode): string {
  switch (code) {
    case 'PROVIDER_UNAVAILABLE':
      return 'The coaching service is temporarily unavailable. Please try again later.';
    case 'PROVIDER_TIMEOUT':
      return 'The coaching review took too long to complete. Please try again.';
    case 'RATE_LIMITED':
      return 'Too many coaching requests. Please wait a moment and try again.';
    case 'INVALID_MODEL_RESPONSE':
      return 'The coaching review could not be completed. Please try again.';
    case 'OUTPUT_VALIDATION_FAILED':
      return 'The coaching review could not be completed. Please try again.';
    case 'CONTEXT_BUILD_FAILED':
      return 'Could not prepare the artifact for review. Please try again.';
    case 'GENERATION_FAILED':
      return 'The coaching review could not be completed. Please try again.';
    case 'MAX_ATTEMPTS_EXCEEDED':
      return 'The coaching review could not be completed after multiple attempts.';
    default:
      return 'An unexpected error occurred during the coaching review.';
  }
}

/**
 * Map internal run DTO to public summary resource.
 */
function toRunSummaryResource(
  internal: InternalCoachingRunDTO,
  currentContentVersion: number,
): CoachRunSummaryResource {
  return {
    id: internal.id,
    artifact_public_id: internal.artifact_public_id,
    artifact_type: internal.artifact_type,
    content_version: internal.content_version,
    selected_section_key: internal.selected_section_key,
    review_scope: internal.review_scope as CoachReviewScope,
    status: internal.status as CoachRunStatus,
    requested_by: toRequesterSummary(internal.requested_by),
    requested_at: internal.requested_at,
    completed_at: internal.completed_at,
    failed_at: internal.failed_at,
    is_current_version: internal.content_version === currentContentVersion,
    retry_of_run_id: internal.retry_of_run_id,
  };
}

/**
 * Internal item type for mapping.
 */
interface InternalCoachingRunItemDTO {
  id: string;
  run_id: string;
  category: string;
  position: number;
  text: string;
  references: Array<{
    id: string;
    item_id: string;
    object_type: string;
    object_id: string;
    section_key: string | null;
    label: string;
  }>;
}

/**
 * Internal context type for mapping.
 */
interface InternalCoachingRunContextDTO {
  id: string;
  run_id: string;
  object_type: string;
  object_id: string;
  object_version: number | null;
  section_key: string | null;
  context_role: string;
  position: number;
}

/**
 * Map internal run item to public resource.
 */
function toItemResource(item: InternalCoachingRunItemDTO): CoachRunItemResource {
  return {
    id: item.id,
    run_id: item.run_id,
    category: item.category as 'strength' | 'issue' | 'suggestion' | 'question',
    position: item.position,
    text: item.text,
    references: item.references.map(
      (ref): CoachRunReferenceResource => ({
        id: ref.id,
        item_id: ref.item_id,
        object_type: ref.object_type,
        object_id: ref.object_id,
        section_key: ref.section_key,
        label: ref.label,
      }),
    ),
  };
}

/**
 * Map internal context entry to public resource.
 */
function toContextResource(ctx: InternalCoachingRunContextDTO): CoachRunContextEntryResource {
  return {
    id: ctx.id,
    run_id: ctx.run_id,
    object_type: ctx.object_type,
    object_id: ctx.object_id,
    object_version: ctx.object_version,
    section_key: ctx.section_key,
    context_role: ctx.context_role as 'primary' | 'supporting',
    position: ctx.position,
  };
}

/**
 * Map internal run detail DTO to public detail resource.
 */
function toRunDetailResource(
  internal: InternalCoachingRunDetailDTO,
  currentContentVersion: number,
): CoachRunDetailResource {
  const base = toRunSummaryResource(internal, currentContentVersion);

  const detail: CoachRunDetailResource = {
    ...base,
    coaching_contract_version: internal.coaching_contract_version,
    prompt_template_version: internal.prompt_template_version,
    model: internal.model,
    items: (internal.items as InternalCoachingRunItemDTO[]).map(toItemResource),
    context: (internal.context as InternalCoachingRunContextDTO[]).map(toContextResource),
  };

  // Add failure info only if status is failed
  if (internal.status === 'failed' && internal.failure_code) {
    (detail as { failure?: { code: CoachFailureCode; message: string } }).failure = {
      code: internal.failure_code as CoachFailureCode,
      message: sanitizeFailureMessage(internal.failure_code as CoachFailureCode),
    };
  }

  return detail;
}

// ─── Route Handlers ────────────────────────────────────────────────────────

// Valid status values for query validation
const VALID_STATUS_VALUES: CoachRunStatus[] = ['pending', 'running', 'completed', 'failed'];
const VALID_SCOPE_VALUES: CoachReviewScope[] = ['artifact', 'section'];

/**
 * GET /api/v1/artifacts/:artifactPublicId/coaching
 * List coaching runs for an artifact.
 *
 * Query params:
 * - status: 'pending' | 'running' | 'completed' | 'failed' (optional)
 * - review_scope: 'artifact' | 'section' (optional)
 * - section_key: string (optional, for section-scoped history)
 * - limit: number (optional, default 20, max 100)
 */
router.get('/artifacts/:artifactPublicId/coaching', requireAuth, async (req, res, next) => {
  try {
    const artifactPublicId = req.params.artifactPublicId as string;

    // Parse and validate query parameters
    const statusParam = req.query.status as string | undefined;
    const scopeParam = req.query.review_scope as string | undefined;
    const sectionKeyParam = req.query.section_key as string | undefined;
    const limitParam = req.query.limit as string | undefined;

    // Validate status if provided
    if (statusParam !== undefined && !VALID_STATUS_VALUES.includes(statusParam as CoachRunStatus)) {
      throw validationError(
        `Invalid status value '${statusParam}'. Must be one of: ${VALID_STATUS_VALUES.join(', ')}`,
        { status: statusParam, valid_values: VALID_STATUS_VALUES },
      );
    }

    // Validate scope if provided
    if (scopeParam !== undefined && !VALID_SCOPE_VALUES.includes(scopeParam as CoachReviewScope)) {
      throw validationError(
        `Invalid review_scope value '${scopeParam}'. Must be one of: ${VALID_SCOPE_VALUES.join(', ')}`,
        { review_scope: scopeParam, valid_values: VALID_SCOPE_VALUES },
      );
    }

    // Parse limit
    let limit = 20;
    if (limitParam !== undefined) {
      const parsed = parseInt(limitParam, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 100) {
        throw validationError('limit must be a number between 1 and 100', { limit: limitParam });
      }
      limit = parsed;
    }

    const artifact = await resolveArtifact(artifactPublicId);

    // Build query options
    const options: {
      content_version?: number;
      status?: CoachRunStatus;
      review_scope?: CoachReviewScope;
      section_key?: string;
    } = {};

    if (statusParam) options.status = statusParam as CoachRunStatus;
    if (scopeParam) options.review_scope = scopeParam as CoachReviewScope;
    if (sectionKeyParam) options.section_key = sectionKeyParam;

    const internalRuns = await coachingAppService.listCoachRunsForArtifact(
      req.ctx!,
      artifact.id,
      options,
    );

    // Apply limit (runs are already sorted newest-first by the service)
    const limitedRuns = internalRuns.slice(0, limit);

    // Map to public resources
    const runs = limitedRuns.map((run) => toRunSummaryResource(run, artifact.content_version));

    const response: CoachRunListResponse = {
      artifact_public_id: artifactPublicId,
      runs,
      cursor: null, // M3A: No pagination cursor yet
      has_more: internalRuns.length > limit,
    };

    res.json({ data: response });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/artifacts/:artifactPublicId/coaching
 * Create a new artifact-level coaching run.
 *
 * Body:
 * - review_scope: 'artifact' (M3A only supports artifact scope)
 *
 * Returns immediately with pending run (does NOT wait for AI generation).
 */
router.post('/artifacts/:artifactPublicId/coaching', requireAuth, async (req, res, next) => {
  try {
    const artifactPublicId = req.params.artifactPublicId as string;
    const { review_scope } = req.body as { review_scope?: CoachReviewScope };

    // M3A: Only artifact-level review is supported
    if (review_scope && review_scope !== 'artifact') {
      throw validationError(
        'Only artifact-level reviews are supported. Section-level reviews will be available in a future release.',
        { review_scope, supported: ['artifact'] },
      );
    }

    const artifact = await resolveArtifact(artifactPublicId);

    // Get coaching contract for this artifact type
    const contract = getActiveContract(artifact.artifact_type);
    if (!contract) {
      throw validationError(`Coaching is not available for artifact type '${artifact.artifact_type}'`);
    }

    // Create the run
    const internalRun = await coachingAppService.createCoachRun(req.ctx!, {
      artifact_id: artifact.id,
      review_scope: 'artifact',
      selected_section_key: null,
      coaching_contract_version: contract.contractVersion,
      prompt_template_version: contract.promptTemplateVersion,
      provider: 'anthropic',
      model: `claude-${contract.modelConfig.tier}-4-20250514`,
    });

    const run = toRunSummaryResource(internalRun, artifact.content_version);

    const response: CreateCoachRunResponse = { run };
    res.status(201).json({ data: response });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/coaching/runs/:runId
 * Get a single coaching run with full details.
 */
router.get('/coaching/runs/:runId', requireAuth, async (req, res, next) => {
  try {
    const runId = req.params.runId as string;

    const internalRun = await coachingAppService.getCoachRun(req.ctx!, runId);

    // Get current artifact content_version for is_current_version calculation
    const artifact = (await ArtifactModel.findByPk(internalRun.artifact_id, {
      attributes: ['content_version'],
    })) as { content_version: number } | null;

    if (!artifact) {
      throw resourceNotFound('Artifact');
    }

    const run = toRunDetailResource(internalRun, artifact.content_version);

    const response: CoachRunDetailResponse = { run };
    res.json({ data: response });
  } catch (error) {
    next(error);
  }
});

export default router;
