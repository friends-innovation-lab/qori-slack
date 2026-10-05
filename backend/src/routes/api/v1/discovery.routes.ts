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

const router = Router({ mergeParams: true });

// Helper to extract projectId from route params
function extractProjectId(params: Record<string, string | string[] | undefined>): number | null {
  const projectIdParam = params.projectId;
  if (typeof projectIdParam !== 'string') return null;
  const parsed = parseInt(projectIdParam, 10);
  return isNaN(parsed) ? null : parsed;
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
    const projectId = extractProjectId(req.params);
    if (projectId === null) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid project ID' },
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
    const projectId = extractProjectId(req.params);
    if (projectId === null) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid project ID' },
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
 * Body:
 * - discoveryType: 'desk_research' | 'stakeholder_synthesis'
 * - topic: string
 * - sourceIntent?: string
 * - sources: PreparedDiscoverySource[]
 */
router.post('/runs', requireAuth, async (req, res, next) => {
  try {
    const projectId = extractProjectId(req.params);
    if (projectId === null) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid project ID' },
      });
      return;
    }

    const { discoveryType, topic, sourceIntent, sources } = req.body;

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
    const projectId = extractProjectId(req.params);
    if (projectId === null) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid project ID' },
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
    const projectId = extractProjectId(req.params);
    if (projectId === null) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid project ID' },
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

export default router;
