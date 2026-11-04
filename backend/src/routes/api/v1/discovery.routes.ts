/**
 * /api/v1/projects/:projectId/discovery — Discovery API endpoints.
 *
 * DISC-2: First REST API over DISC-1 domain foundation.
 *
 * All routes require authentication via requireAuth middleware.
 * Project authorization enforced at application service layer.
 */

import { Router } from 'express';
import { requireAuth } from '../../../middleware/auth';
import * as discoveryAppService from '../../../application/discovery.app-service';
import { getProjectById } from '../../../services/project.service';
import type { PreparedDiscoverySource, DiscoveryTypeKey } from '../../../types/discovery';
import type { Project } from '../../../database/models/project';
import sequelize from '../../../database';
import { AppError, ApiErrorCode } from '../../../types/api-errors';
import { isControlledExecutionEnabled } from '../../../services/controlled-session-authorization.service';
import {
  listSessionsByProjectAndActor,
  getSessionDetailsByPublicId,
  getSessionReservations,
  cancelControlledSessionFromApi,
  createSessionForApi,
  SessionNotFoundError,
  SessionActorMismatchError,
  SessionNotCancellableError,
  SessionAlreadyExistsError,
  IdempotencyConflictError,
  ConcurrencyRetryableError,
  SESSION_BUDGET_CEILINGS,
  SESSION_BUDGET_DEFAULTS,
} from '../../../services/controlled-test-budget.service';
import { assertProjectAccessByActor } from '../../../services/authorization.service';
import { getDiscoveryRunById } from '../../../services/discovery-run.service';

const router = Router({ mergeParams: true });

// Typed model reference
const ProjectModel = sequelize.models.Project as typeof Project;

// UUID pattern for public_id detection
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve project identifier (numeric ID, UUID public_id, or slug) to numeric project ID.
 * Returns null if project not found or identifier invalid.
 *
 * DR-4 hotfix: Frontend passes project slug from study.project_public_id,
 * which falls back to slug when public_id is null.
 */
async function resolveProjectId(
  projectIdParam: string | string[] | undefined,
  organizationId: number,
): Promise<number | null> {
  if (typeof projectIdParam !== 'string' || !projectIdParam) return null;
  if (!ProjectModel) return null;

  // 1. Try parsing as numeric ID (legacy support)
  // Only if the entire string is numeric (e.g., "123", not "74e132f6-...")
  if (/^\d+$/.test(projectIdParam)) {
    const numericId = parseInt(projectIdParam, 10);
    const project = await ProjectModel.findOne({
      where: { id: numericId, organization_id: organizationId },
      attributes: ['id'],
    });
    return project ? project.id : null;
  }

  // 2. Try UUID public_id (case-insensitive match, lowercase query)
  if (UUID_PATTERN.test(projectIdParam)) {
    const project = await ProjectModel.findOne({
      where: { public_id: projectIdParam.toLowerCase(), organization_id: organizationId },
      attributes: ['id'],
    });
    if (project) return project.id;
  }

  // 3. Fall back to slug
  const project = await ProjectModel.findOne({
    where: { slug: projectIdParam, organization_id: organizationId },
    attributes: ['id'],
  });
  return project ? project.id : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// RUNS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/projects/:projectId/discovery/runs
 *
 * List Discovery runs for a project.
 * Supports filtering by type and status.
 */
router.get('/runs', requireAuth, async (req, res, next) => {
  try {
    const projectId = await resolveProjectId(req.params.projectId, req.ctx!.organization.id);
    if (projectId === null) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid or unknown project identifier' },
      });
      return;
    }

    const discoveryType = req.query.type as DiscoveryTypeKey | undefined;
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const offset = parseInt(req.query.offset as string, 10) || 0;

    // Validate discovery type if provided
    if (discoveryType && !['desk_research', 'stakeholder_synthesis', 'survey_synthesis'].includes(discoveryType)) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid discovery type' },
      });
      return;
    }

    const runs = await discoveryAppService.listDiscoveryRuns(req.ctx!, projectId, {
      discoveryType,
      status,
      limit: Math.min(limit, 100),
      offset,
    });

    res.json({ data: runs });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/projects/:projectId/discovery/runs/:runId
 *
 * Get Discovery run detail by public ID.
 */
router.get('/runs/:runId', requireAuth, async (req, res, next) => {
  try {
    const projectId = await resolveProjectId(req.params.projectId, req.ctx!.organization.id);
    if (projectId === null) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid or unknown project identifier' },
      });
      return;
    }

    const runId = req.params.runId;
    if (!runId || typeof runId !== 'string') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid run ID' },
      });
      return;
    }

    const run = await discoveryAppService.getDiscoveryRunByPublicId(req.ctx!, projectId, runId);

    if (!run) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Discovery run not found' },
      });
      return;
    }

    res.json({ data: run });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/projects/:projectId/discovery/runs
 *
 * Create a new Discovery run (desk_research or stakeholder_synthesis).
 * Returns pending run immediately. Worker will execute asynchronously.
 *
 * Body (legacy sources[] path):
 * - discoveryType: 'desk_research' | 'stakeholder_synthesis'
 * - topic: string
 * - sourceIntent?: string
 * - sources: PreparedDiscoverySource[]
 *
 * Body (DISC-WEB-1B-2b sourceRefs[] path):
 * - discoveryType: 'desk_research' | 'stakeholder_synthesis'
 * - topic: string
 * - sourceIntent?: string
 * - sourceRefs: string[] (ref_token from extraction staging)
 * + Header: Idempotency-Key: <UUID v4> (REQUIRED)
 *
 * Returns:
 * - 201: New run created
 * - 200: Idempotent replay (existing run returned)
 * - 400: Validation error (invalid input)
 * - 409: Idempotency conflict (key reused with different payload)
 * - 410: Source refs unavailable (expired, consumed, or invalid)
 */
router.post('/runs', requireAuth, async (req, res, next) => {
  try {
    const projectId = await resolveProjectId(req.params.projectId, req.ctx!.organization.id);
    if (projectId === null) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid or unknown project identifier' },
      });
      return;
    }

    const { discoveryType, topic, sourceIntent, sources, sourceRefs, controlledSessionPublicId } = req.body;

    // Validate discovery type
    if (!discoveryType || !['desk_research', 'stakeholder_synthesis'].includes(discoveryType)) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'discoveryType must be "desk_research" or "stakeholder_synthesis"',
        },
      });
      return;
    }

    // Validate topic
    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'topic is required' },
      });
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DISC-WEB-1B-2b: sourceRefs[] path (atomic extraction staging consumption)
    // ═══════════════════════════════════════════════════════════════════════════

    if (Array.isArray(sourceRefs)) {
      // ─── Feature Flag Check (BEFORE any validation or mutation) ────────────
      if (process.env.DISC_WEB1_ENABLED !== 'true') {
        res.status(503).json({
          error: {
            code: ApiErrorCode.FEATURE_DISABLED,
            message: 'Source reference consumption is not available',
          },
        });
        return;
      }

      // Validate sourceRefs array
      if (sourceRefs.length === 0) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'sourceRefs must not be empty' },
        });
        return;
      }

      // Validate all refs are strings
      for (let i = 0; i < sourceRefs.length; i++) {
        if (typeof sourceRefs[i] !== 'string' || sourceRefs[i].length === 0) {
          res.status(400).json({
            error: { code: 'VALIDATION_ERROR', message: `sourceRefs[${i}] must be a non-empty string` },
          });
          return;
        }
      }

      // Require Idempotency-Key header (case-insensitive per HTTP spec)
      const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
      if (!idempotencyKey || typeof idempotencyKey !== 'string') {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Idempotency-Key header is required when using sourceRefs',
          },
        });
        return;
      }

      // Validate UUID v4 format
      if (!UUID_PATTERN.test(idempotencyKey)) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Idempotency-Key must be a valid UUID v4',
          },
        });
        return;
      }

      // Get project for slug
      const project = await getProjectById(projectId);
      if (!project) {
        res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Project not found' },
        });
        return;
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // DISC-WEB-1D-2 M5d: Controlled session selector routing
      // ═══════════════════════════════════════════════════════════════════════════

      // Explicit null is a validation error (not the same as undefined/omitted)
      if (controlledSessionPublicId === null) {
        res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'controlledSessionPublicId cannot be null; omit the field for ordinary runs',
          },
        });
        return;
      }

      // If controlledSessionPublicId is provided, route to controlled path
      if (typeof controlledSessionPublicId === 'string') {
        // Validate UUID format
        if (!UUID_PATTERN.test(controlledSessionPublicId)) {
          res.status(400).json({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'controlledSessionPublicId must be a valid UUID',
            },
          });
          return;
        }

        // Check controlled execution gate
        if (!isControlledExecutionEnabled()) {
          res.status(503).json({
            error: {
              code: ApiErrorCode.CONTROLLED_EXECUTION_DISABLED,
              message: 'Controlled execution is not enabled',
            },
          });
          return;
        }

        // Create controlled run from sourceRefs
        const result = await discoveryAppService.createControlledDiscoveryRunFromRefs({
          projectId,
          projectSlug: project.slug,
          actorId: req.ctx!.actor.id,
          discoveryType: discoveryType as DiscoveryTypeKey,
          topic: topic.trim(),
          sourceIntent: sourceIntent?.trim() || null,
          sourceRefs,
          idempotencyKey,
          createdByIdentity: `api:${req.ctx!.actor.publicId}`,
          controlledSessionPublicId,
        });

        // Return run summary
        const runSummary = await discoveryAppService.getDiscoveryRunByPublicId(
          req.ctx!,
          projectId,
          result.run.public_id,
        );

        // Status: 200 for replay, 201 for new creation
        const statusCode = result.isReplay ? 200 : 201;
        const message = result.isReplay
          ? 'Idempotent replay: returning existing controlled run.'
          : 'Controlled Discovery run created. Worker will process asynchronously.';

        res.status(statusCode).json({
          data: runSummary,
          meta: {
            message,
            isReplay: result.isReplay,
            isControlled: true,
            pollUrl: `/api/v1/projects/${projectId}/discovery/runs/${result.run.public_id}`,
            recommendedPollInterval: '2000ms',
          },
        });
        return;
      }

      // ═══════════════════════════════════════════════════════════════════════════
      // Ordinary sourceRefs path (controlledSessionPublicId is undefined)
      // ═══════════════════════════════════════════════════════════════════════════

      // Create run from sourceRefs (atomic orchestration)
      const result = await discoveryAppService.createPendingDiscoveryRunFromRefs({
        projectId,
        projectSlug: project.slug,
        actorId: req.ctx!.actor.id,
        discoveryType: discoveryType as DiscoveryTypeKey,
        topic: topic.trim(),
        sourceIntent: sourceIntent?.trim() || null,
        sourceRefs,
        idempotencyKey,
        createdByIdentity: `api:${req.ctx!.actor.publicId}`,
      });

      // DISC-WEB-1D-2: Guard against replaying controlled runs on ordinary path
      if (result.isReplay && result.run.is_controlled) {
        res.status(409).json({
          error: {
            code: ApiErrorCode.IDEMPOTENCY_CONFLICT,
            message: 'Idempotency key was used for a controlled run; include controlledSessionPublicId to replay',
          },
        });
        return;
      }

      // Return run summary
      const runSummary = await discoveryAppService.getDiscoveryRunByPublicId(
        req.ctx!,
        projectId,
        result.run.public_id,
      );

      // Status: 200 for replay, 201 for new creation
      const statusCode = result.isReplay ? 200 : 201;
      const message = result.isReplay
        ? 'Idempotent replay: returning existing run.'
        : 'Discovery run created. Worker will process asynchronously.';

      res.status(statusCode).json({
        data: runSummary,
        meta: {
          message,
          isReplay: result.isReplay,
          pollUrl: `/api/v1/projects/${projectId}/discovery/runs/${result.run.public_id}`,
          recommendedPollInterval: '2000ms',
        },
      });
      return;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Legacy sources[] path (existing behavior preserved)
    // ═══════════════════════════════════════════════════════════════════════════

    // Validate sources
    if (!Array.isArray(sources) || sources.length === 0) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'At least one source is required' },
      });
      return;
    }

    // Validate each source
    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      if (!source.filename || typeof source.filename !== 'string') {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: `sources[${i}].filename is required` },
        });
        return;
      }
      if (!source.extractedText || typeof source.extractedText !== 'string') {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: `sources[${i}].extractedText is required` },
        });
        return;
      }
      if (!source.contentHash || typeof source.contentHash !== 'string') {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: `sources[${i}].contentHash is required` },
        });
        return;
      }
      if (!source.mimeType || typeof source.mimeType !== 'string') {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: `sources[${i}].mimeType is required` },
        });
        return;
      }
      if (typeof source.sizeBytes !== 'number') {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: `sources[${i}].sizeBytes is required` },
        });
        return;
      }
    }

    // Get project for slug
    const project = await getProjectById(projectId);
    if (!project) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      });
      return;
    }

    // Prepare sources with REST metadata
    const preparedSources: PreparedDiscoverySource[] = sources.map((s: any) => ({
      filename: s.filename,
      extractedText: s.extractedText,
      contentHash: s.contentHash,
      mimeType: s.mimeType,
      sizeBytes: s.sizeBytes,
      metadata: {
        ...(s.metadata || {}),
        source: 'rest' as const,
      },
    }));

    // Create pending run
    const run = await discoveryAppService.createPendingDiscoveryRun({
      projectId,
      projectSlug: project.slug,
      discoveryType: discoveryType as DiscoveryTypeKey,
      topic: topic.trim(),
      sourceIntent: sourceIntent?.trim() || null,
      sources: preparedSources,
      createdByIdentity: `api:${req.ctx!.actor.publicId}`,
      actorId: req.ctx!.actor.id,
    });

    // Store extracted text in EvidenceSources for worker access
    // This is done inside createPendingDiscoveryRun for now
    // TODO: Move to a proper content storage mechanism

    // Return pending run summary
    const runSummary = await discoveryAppService.getDiscoveryRunByPublicId(
      req.ctx!,
      projectId,
      run.public_id,
    );

    res.status(201).json({
      data: runSummary,
      meta: {
        message: 'Discovery run created. Worker will process asynchronously.',
        pollUrl: `/api/v1/projects/${projectId}/discovery/runs/${run.public_id}`,
        recommendedPollInterval: '2000ms',
      },
    });
  } catch (error) {
    // Handle AppError with specific codes
    if (error instanceof AppError) {
      if (error.code === ApiErrorCode.SOURCE_REF_UNAVAILABLE) {
        res.status(410).json({
          error: {
            code: error.code,
            message: error.message,
            details: error.details,
          },
        });
        return;
      }
      if (error.code === ApiErrorCode.IDEMPOTENCY_CONFLICT) {
        res.status(409).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      // DISC-WEB-1D-2: Controlled session errors
      if (error.code === ApiErrorCode.CONTROLLED_SESSION_NOT_FOUND) {
        res.status(404).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      if (error.code === ApiErrorCode.CONTROLLED_SESSION_ACTOR_MISMATCH) {
        res.status(403).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      if (error.code === ApiErrorCode.CONTROLLED_SESSION_NOT_ACTIVE) {
        res.status(409).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      if (error.code === ApiErrorCode.CONTROLLED_SESSION_ALREADY_BOUND) {
        res.status(409).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
      if (error.code === ApiErrorCode.CONTROLLED_EXECUTION_DISABLED) {
        res.status(503).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }
    }
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DISC-WEB-1D-2 M5e: CONTROLLED EXECUTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/projects/:projectId/discovery/runs/:runId/execute
 *
 * Execute a pending controlled Discovery run.
 *
 * DISC-WEB-1D-2 M5e: Authorized controlled execution endpoint.
 *
 * Requirements:
 * - DISC_WEB1_ENABLED === 'true' (sourceRefs feature)
 * - DISC_WEB1D_ENABLED === 'true' (controlled execution feature)
 * - Authenticated actor must own the bound session
 * - Session must be active
 * - Run must be pending and controlled
 * - Run must be bound to the session
 *
 * Returns:
 * - 200: Execution completed successfully
 * - 400: Validation error
 * - 403: Actor does not own session
 * - 404: Run or session not found
 * - 409: Run not pending, session not active, or already claimed
 * - 503: Feature not enabled
 */
router.post('/runs/:runId/execute', requireAuth, async (req, res, next) => {
  try {
    const projectId = await resolveProjectId(req.params.projectId, req.ctx!.organization.id);
    if (projectId === null) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid or unknown project identifier' },
      });
      return;
    }

    const runPublicId = req.params.runId;
    if (!runPublicId || typeof runPublicId !== 'string') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid run ID' },
      });
      return;
    }

    // ─── Feature Gate: DISC_WEB1_ENABLED ─────────────────────────────────
    if (process.env.DISC_WEB1_ENABLED !== 'true') {
      res.status(503).json({
        error: {
          code: ApiErrorCode.FEATURE_DISABLED,
          message: 'Discovery source consumption is not available',
        },
      });
      return;
    }

    // ─── Feature Gate: DISC_WEB1D_ENABLED (controlled execution) ─────────
    if (!isControlledExecutionEnabled()) {
      res.status(503).json({
        error: {
          code: ApiErrorCode.CONTROLLED_EXECUTION_DISABLED,
          message: 'Controlled execution is not enabled',
        },
      });
      return;
    }

    // Execute controlled run
    const result = await discoveryAppService.executeControlledDiscoveryRunFromApi({
      projectId,
      runPublicId,
      actorId: req.ctx!.actor.id,
      actorPublicId: req.ctx!.actor.publicId,
    });

    // Check final run status — do not return success for failed runs
    if (!result.success) {
      res.status(result.statusCode || 500).json({
        error: {
          code: result.errorCode || 'EXECUTION_FAILED',
          message: result.errorMessage || 'Controlled execution failed',
        },
        data: result.run ? {
          runPublicId: result.run.public_id,
          status: result.run.status,
          failureCode: result.run.failure_code,
          failureMessage: result.run.failure_message,
        } : undefined,
      });
      return;
    }

    res.status(200).json({
      data: {
        runPublicId: result.run!.public_id,
        status: result.run!.status,
        artifactPublicId: result.artifactPublicId,
        githubUrl: result.githubUrl,
        extractionSuccess: result.extractionSuccess,
        extractionVariableCount: result.extractionVariableCount,
      },
      meta: {
        message: 'Controlled execution completed successfully.',
        isControlled: true,
      },
    });
  } catch (error) {
    // Handle specific error types
    if (error instanceof AppError) {
      if (error.code === ApiErrorCode.CONTROLLED_SESSION_NOT_FOUND) {
        res.status(404).json({
          error: { code: error.code, message: error.message },
        });
        return;
      }
      if (error.code === ApiErrorCode.CONTROLLED_SESSION_ACTOR_MISMATCH) {
        res.status(403).json({
          error: { code: error.code, message: error.message },
        });
        return;
      }
      if (error.code === ApiErrorCode.CONTROLLED_SESSION_NOT_ACTIVE) {
        res.status(409).json({
          error: { code: error.code, message: error.message },
        });
        return;
      }
    }
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ARTIFACTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/projects/:projectId/discovery/artifacts
 *
 * List canonical Discovery artifacts for a project.
 * Defaults to current artifacts only.
 */
router.get('/artifacts', requireAuth, async (req, res, next) => {
  try {
    const projectId = await resolveProjectId(req.params.projectId, req.ctx!.organization.id);
    if (projectId === null) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid or unknown project identifier' },
      });
      return;
    }

    const artifactType = req.query.type as string | undefined;
    const status = req.query.status as string | undefined;
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const offset = parseInt(req.query.offset as string, 10) || 0;

    const artifacts = await discoveryAppService.listCanonicalDiscoveryArtifacts(
      req.ctx!,
      projectId,
      {
        artifactType,
        status,
        limit: Math.min(limit, 100),
        offset,
      },
    );

    res.json({ data: artifacts });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/projects/:projectId/discovery/artifacts/:artifactId
 *
 * Get Discovery artifact detail by public ID.
 * Includes canonical content.
 */
router.get('/artifacts/:artifactId', requireAuth, async (req, res, next) => {
  try {
    const projectId = await resolveProjectId(req.params.projectId, req.ctx!.organization.id);
    if (projectId === null) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid or unknown project identifier' },
      });
      return;
    }

    const artifactId = req.params.artifactId;
    if (!artifactId || typeof artifactId !== 'string') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid artifact ID' },
      });
      return;
    }

    const artifact = await discoveryAppService.getDiscoveryArtifactByPublicId(
      req.ctx!,
      projectId,
      artifactId,
    );

    if (!artifact) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Discovery artifact not found' },
      });
      return;
    }

    res.json({ data: artifact });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/projects/:projectId/discovery/artifacts/:artifactId/variables
 *
 * DISC-3B: Get extracted cascade variables for a Discovery artifact.
 * Queries canonical study_variables via discovery_artifact_fk_id lineage.
 */
router.get('/artifacts/:artifactId/variables', requireAuth, async (req, res, next) => {
  try {
    const projectId = await resolveProjectId(req.params.projectId, req.ctx!.organization.id);
    if (projectId === null) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid or unknown project identifier' },
      });
      return;
    }

    const artifactId = req.params.artifactId;
    if (!artifactId || typeof artifactId !== 'string') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid artifact ID' },
      });
      return;
    }

    const variables = await discoveryAppService.getArtifactVariables(
      req.ctx!,
      projectId,
      artifactId,
    );

    if (!variables) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Discovery artifact not found' },
      });
      return;
    }

    res.json({ data: variables });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// KNOWLEDGE GAPS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/projects/:projectId/discovery/knowledge-gaps
 *
 * DISC-3B: Get aggregated knowledge gaps across all current Discovery artifacts.
 * Preserves provenance for each gap.
 */
router.get('/knowledge-gaps', requireAuth, async (req, res, next) => {
  try {
    const projectId = await resolveProjectId(req.params.projectId, req.ctx!.organization.id);
    if (projectId === null) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid or unknown project identifier' },
      });
      return;
    }

    const gaps = await discoveryAppService.getKnowledgeGaps(req.ctx!, projectId);

    res.json({ data: gaps });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CONTROLLED SESSIONS — M6 Admin API
// ═══════════════════════════════════════════════════════════════════════════

// UUID pattern for session public_id validation
const SESSION_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Feature gate middleware for M6 controlled session endpoints.
 * Returns 503 if either DISC_WEB1_ENABLED or isControlledExecutionEnabled() is false.
 */
function requireControlledExecutionEnabled(
  req: Parameters<typeof requireAuth>[0],
  res: Parameters<typeof requireAuth>[1],
  next: Parameters<typeof requireAuth>[2],
) {
  if (process.env.DISC_WEB1_ENABLED !== 'true') {
    res.status(503).json({
      error: {
        code: ApiErrorCode.CONTROLLED_EXECUTION_DISABLED,
        message: 'Controlled execution feature is not available',
      },
    });
    return;
  }

  if (!isControlledExecutionEnabled()) {
    res.status(503).json({
      error: {
        code: ApiErrorCode.CONTROLLED_EXECUTION_DISABLED,
        message: 'Controlled execution feature is not available',
      },
    });
    return;
  }

  next();
}

// UUID v4 pattern for Idempotency-Key validation
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * POST /api/v1/projects/:projectId/discovery/controlled-sessions
 *
 * M9a: Create a new controlled session for AI execution budget enforcement.
 *
 * Headers:
 * - Authorization: Bearer OIDC token (required)
 * - Idempotency-Key: UUID v4 (required)
 *
 * Body (optional):
 * - maxRequests: number (default: 4, ceiling: 4)
 * - maxInputTokens: number (default: 40000, ceiling: 40000)
 * - maxOutputTokens: number (default: 16384, ceiling: 16384)
 *
 * Returns:
 * - 201: New session created
 * - 200: Idempotent replay (same actor/project/key/payload)
 * - 400: Validation error
 * - 401: Missing/invalid auth
 * - 403: Actor lacks project access
 * - 404: Project not found
 * - 409: Idempotency conflict or active session exists
 * - 503: Feature disabled
 */
router.post(
  '/controlled-sessions',
  requireAuth,
  requireControlledExecutionEnabled,
  async (req, res, next) => {
    try {
      const ctx = req.ctx!;

      // ═══════════════════════════════════════════════════════════════════════
      // Step 1: Validate Idempotency-Key header
      // ═══════════════════════════════════════════════════════════════════════
      const idempotencyKey = req.headers['idempotency-key'];
      if (!idempotencyKey || typeof idempotencyKey !== 'string') {
        res.status(400).json({
          error: {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Idempotency-Key header is required',
          },
        });
        return;
      }

      if (!UUID_V4_PATTERN.test(idempotencyKey)) {
        res.status(400).json({
          error: {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: 'Idempotency-Key must be a valid UUID v4',
          },
        });
        return;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // Step 2: Resolve and validate project
      // ═══════════════════════════════════════════════════════════════════════
      const projectId = await resolveProjectId(req.params.projectId, ctx.organization.id);
      if (projectId === null) {
        res.status(404).json({
          error: { code: ApiErrorCode.RESOURCE_NOT_FOUND, message: 'Project not found' },
        });
        return;
      }

      // Project authorization is enforced by service layer (assertProjectAccessByActor)
      // but we do a quick check here for better error messages
      try {
        await assertProjectAccessByActor(ctx.actor.id, projectId, ctx.organization.id);
      } catch {
        res.status(403).json({
          error: { code: ApiErrorCode.AUTHORIZATION_DENIED, message: 'Access denied: not a project member' },
        });
        return;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // Step 3: Validate and apply budget values
      // ═══════════════════════════════════════════════════════════════════════
      const body = req.body || {};
      const allowedFields = ['maxRequests', 'maxInputTokens', 'maxOutputTokens'];
      const unknownFields = Object.keys(body).filter((k) => !allowedFields.includes(k));

      if (unknownFields.length > 0) {
        res.status(400).json({
          error: {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: `Unknown budget field(s): ${unknownFields.join(', ')}`,
          },
        });
        return;
      }

      // Validate and apply each budget field
      const budgetErrors: string[] = [];

      function validateBudgetField(
        name: string,
        value: unknown,
        ceiling: number,
        defaultValue: number,
      ): number {
        if (value === undefined || value === null) {
          return defaultValue;
        }

        // Type check
        if (typeof value !== 'number') {
          budgetErrors.push(`${name} must be a number`);
          return defaultValue;
        }

        // Finite check (rejects NaN, Infinity, -Infinity)
        if (!Number.isFinite(value)) {
          budgetErrors.push(`${name} must be finite (not NaN or Infinity)`);
          return defaultValue;
        }

        // Integer check
        if (!Number.isInteger(value)) {
          budgetErrors.push(`${name} must be an integer`);
          return defaultValue;
        }

        // Positive check
        if (value <= 0) {
          budgetErrors.push(`${name} must be positive`);
          return defaultValue;
        }

        // Ceiling check
        if (value > ceiling) {
          budgetErrors.push(`${name} cannot exceed ${ceiling}`);
          return defaultValue;
        }

        return value;
      }

      const maxRequests = validateBudgetField(
        'maxRequests',
        body.maxRequests,
        SESSION_BUDGET_CEILINGS.maxRequests,
        SESSION_BUDGET_DEFAULTS.maxRequests,
      );
      const maxInputTokens = validateBudgetField(
        'maxInputTokens',
        body.maxInputTokens,
        SESSION_BUDGET_CEILINGS.maxInputTokens,
        SESSION_BUDGET_DEFAULTS.maxInputTokens,
      );
      const maxOutputTokens = validateBudgetField(
        'maxOutputTokens',
        body.maxOutputTokens,
        SESSION_BUDGET_CEILINGS.maxOutputTokens,
        SESSION_BUDGET_DEFAULTS.maxOutputTokens,
      );

      if (budgetErrors.length > 0) {
        res.status(400).json({
          error: {
            code: ApiErrorCode.VALIDATION_ERROR,
            message: budgetErrors.join('; '),
          },
        });
        return;
      }

      // ═══════════════════════════════════════════════════════════════════════
      // Step 4: Create session
      // ═══════════════════════════════════════════════════════════════════════
      const result = await createSessionForApi({
        actorId: ctx.actor.id,
        projectId,
        idempotencyKey,
        maxRequests,
        maxInputTokens,
        maxOutputTokens,
      });

      const session = result.session;
      const statusCode = result.isReplay ? 200 : 201;

      // ═══════════════════════════════════════════════════════════════════════
      // Step 5: Build response (never expose internal IDs)
      // ═══════════════════════════════════════════════════════════════════════
      // Look up project public_id for response
      const projectRecord = await ProjectModel.findByPk(projectId, {
        attributes: ['public_id'],
      });

      const responseData = {
        sessionPublicId: session.public_id,
        projectId: projectRecord?.public_id || null,
        status: session.status,
        budget: {
          maxRequests: session.max_requests,
          maxInputTokens: session.max_input_tokens,
          maxOutputTokens: session.max_output_tokens,
          usedRequests: session.used_requests,
          usedInputTokens: session.used_input_tokens,
          usedOutputTokens: session.used_output_tokens,
        },
        createdAt: session.created_at,
        ...(session.cancelled_at && { cancelledAt: session.cancelled_at }),
        ...(session.completed_at && { completedAt: session.completed_at }),
        ...(session.exhausted_at && { exhaustedAt: session.exhausted_at }),
        ...(session.discovery_run_id && {
          // Fetch run public_id if bound
          boundRunPublicId: await (async () => {
            const run = await getDiscoveryRunById(session.discovery_run_id!);
            return run?.public_id || null;
          })(),
        }),
      };

      res.status(statusCode).json({
        data: responseData,
        meta: {
          idempotent: result.isReplay,
        },
      });
    } catch (error) {
      // Handle specific errors with appropriate status codes
      if (error instanceof SessionAlreadyExistsError) {
        // M9a: Zero-information-leak — do not expose session details
        res.status(409).json({
          error: {
            code: 'CONTROLLED_SESSION_ACTIVE',
            message: 'A controlled session is already active',
          },
        });
        return;
      }

      if (error instanceof IdempotencyConflictError) {
        res.status(409).json({
          error: {
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'Idempotency-Key already used with different payload',
          },
        });
        return;
      }

      if (error instanceof ConcurrencyRetryableError) {
        res.status(503).json({
          error: {
            code: 'CONCURRENCY_ERROR',
            message: 'Concurrent modification detected, please retry',
          },
        });
        return;
      }

      next(error);
    }
  },
);

/**
 * GET /api/v1/projects/:projectId/discovery/controlled-sessions
 *
 * M6: List controlled sessions for the current actor in this project.
 * Only returns sessions bound to controlled runs in this project.
 */
router.get(
  '/controlled-sessions',
  requireAuth,
  requireControlledExecutionEnabled,
  async (req, res, next) => {
    try {
      const projectId = await resolveProjectId(req.params.projectId, req.ctx!.organization.id);
      if (projectId === null) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid or unknown project identifier' },
        });
        return;
      }

      const actorId = req.ctx!.actor.id;
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
      const offset = parseInt(req.query.offset as string, 10) || 0;

      if (offset < 0 || !Number.isInteger(offset)) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid offset parameter' },
        });
        return;
      }

      const result = await listSessionsByProjectAndActor(projectId, actorId, { limit, offset });

      res.json({
        data: result.items,
        pagination: {
          total: result.total,
          limit,
          offset,
          hasMore: offset + result.items.length < result.total,
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * GET /api/v1/projects/:projectId/discovery/controlled-sessions/:sessionPublicId
 *
 * M6: Get details of a specific controlled session.
 * Requires creator ownership and project binding.
 */
router.get(
  '/controlled-sessions/:sessionPublicId',
  requireAuth,
  requireControlledExecutionEnabled,
  async (req, res, next) => {
    try {
      const projectId = await resolveProjectId(req.params.projectId, req.ctx!.organization.id);
      if (projectId === null) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid or unknown project identifier' },
        });
        return;
      }

      const sessionPublicId = req.params.sessionPublicId as string | undefined;
      if (!sessionPublicId || typeof sessionPublicId !== 'string' || !SESSION_UUID_PATTERN.test(sessionPublicId)) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid session identifier format' },
        });
        return;
      }

      const actorId = req.ctx!.actor.id;

      const session = await getSessionDetailsByPublicId(
        sessionPublicId.toLowerCase(),
        projectId,
        actorId,
      );

      res.json({ data: session });
    } catch (error) {
      if (error instanceof SessionNotFoundError) {
        res.status(404).json({
          error: {
            code: ApiErrorCode.CONTROLLED_SESSION_NOT_FOUND,
            message: 'Controlled session not found',
          },
        });
        return;
      }
      if (error instanceof SessionActorMismatchError) {
        res.status(403).json({
          error: {
            code: ApiErrorCode.CONTROLLED_SESSION_ACTOR_MISMATCH,
            message: 'Not authorized to access this session',
          },
        });
        return;
      }
      next(error);
    }
  },
);

/**
 * GET /api/v1/projects/:projectId/discovery/controlled-sessions/:sessionPublicId/reservations
 *
 * M6: Get paginated reservation history for a controlled session.
 * Requires creator ownership and project binding.
 */
router.get(
  '/controlled-sessions/:sessionPublicId/reservations',
  requireAuth,
  requireControlledExecutionEnabled,
  async (req, res, next) => {
    try {
      const projectId = await resolveProjectId(req.params.projectId, req.ctx!.organization.id);
      if (projectId === null) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid or unknown project identifier' },
        });
        return;
      }

      const sessionPublicId = req.params.sessionPublicId as string | undefined;
      if (!sessionPublicId || typeof sessionPublicId !== 'string' || !SESSION_UUID_PATTERN.test(sessionPublicId)) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid session identifier format' },
        });
        return;
      }

      const actorId = req.ctx!.actor.id;
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
      const offset = parseInt(req.query.offset as string, 10) || 0;

      if (offset < 0 || !Number.isInteger(offset)) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid offset parameter' },
        });
        return;
      }

      const result = await getSessionReservations(
        sessionPublicId.toLowerCase(),
        projectId,
        actorId,
        { limit, offset },
      );

      res.json({
        data: result.items,
        pagination: result.pagination,
      });
    } catch (error) {
      if (error instanceof SessionNotFoundError) {
        res.status(404).json({
          error: {
            code: ApiErrorCode.CONTROLLED_SESSION_NOT_FOUND,
            message: 'Controlled session not found',
          },
        });
        return;
      }
      if (error instanceof SessionActorMismatchError) {
        res.status(403).json({
          error: {
            code: ApiErrorCode.CONTROLLED_SESSION_ACTOR_MISMATCH,
            message: 'Not authorized to access this session',
          },
        });
        return;
      }
      next(error);
    }
  },
);

/**
 * POST /api/v1/projects/:projectId/discovery/controlled-sessions/:sessionPublicId/cancel
 *
 * M6: Cancel a controlled session.
 *
 * State transitions:
 * - active → cancelled (200, atomic with bound pending run failure)
 * - cancelled → idempotent 200 (preserves original timestamp)
 * - completed/exhausted → 409 (not cancellable)
 *
 * Lock order: session first, then run (matches authorizeAndClaimControlledRun).
 */
router.post(
  '/controlled-sessions/:sessionPublicId/cancel',
  requireAuth,
  requireControlledExecutionEnabled,
  async (req, res, next) => {
    try {
      const projectId = await resolveProjectId(req.params.projectId, req.ctx!.organization.id);
      if (projectId === null) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid or unknown project identifier' },
        });
        return;
      }

      const sessionPublicId = req.params.sessionPublicId as string | undefined;
      if (!sessionPublicId || typeof sessionPublicId !== 'string' || !SESSION_UUID_PATTERN.test(sessionPublicId)) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid session identifier format' },
        });
        return;
      }

      const actorId = req.ctx!.actor.id;
      const reason = typeof req.body?.reason === 'string' ? req.body.reason : undefined;

      const result = await cancelControlledSessionFromApi(
        sessionPublicId.toLowerCase(),
        projectId,
        actorId,
        reason,
      );

      res.status(200).json({ data: result });
    } catch (error) {
      if (error instanceof SessionNotFoundError) {
        res.status(404).json({
          error: {
            code: ApiErrorCode.CONTROLLED_SESSION_NOT_FOUND,
            message: 'Controlled session not found',
          },
        });
        return;
      }
      if (error instanceof SessionActorMismatchError) {
        res.status(403).json({
          error: {
            code: ApiErrorCode.CONTROLLED_SESSION_ACTOR_MISMATCH,
            message: 'Not authorized to cancel this session',
          },
        });
        return;
      }
      if (error instanceof SessionNotCancellableError) {
        res.status(409).json({
          error: {
            code: ApiErrorCode.CONTROLLED_SESSION_NOT_ACTIVE,
            message: `Session cannot be cancelled (status: ${error.status})`,
          },
        });
        return;
      }
      next(error);
    }
  },
);

export default router;
