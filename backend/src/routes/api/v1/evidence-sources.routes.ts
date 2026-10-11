/**
 * /api/v1/projects/:projectId/evidence-sources — Evidence Source API endpoints.
 *
 * DR-4e: Exposes evidence source identity for insight attribution.
 * EvidenceSource represents an evidence-bearing input (uploaded document,
 * stakeholder interview, etc.) with canonical identity for insight evidence references.
 *
 * All routes require authentication via requireAuth middleware.
 */

import { Router } from 'express';
import { requireAuth } from '../../../middleware/auth';
import { assertProjectAccessByActor } from '../../../services/authorization.service';
import * as evidenceSourceService from '../../../services/evidence-source.service';
import type { SourceType } from '../../../database/models/evidence_source';

const router = Router({ mergeParams: true });

// Valid source types for validation
const VALID_SOURCE_TYPES: SourceType[] = [
  'uploaded_document',
  'survey_dataset',
  'stakeholder_interview',
  'session_transcript',
  'session_notes',
  'process_document',
  'external_reference',
];

// Helper to extract projectId from route params
function extractProjectId(params: Record<string, string | string[] | undefined>): number | null {
  const projectIdParam = params.projectId;
  if (typeof projectIdParam !== 'string') return null;
  const parsed = parseInt(projectIdParam, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * GET /api/v1/projects/:projectId/evidence-sources
 *
 * List evidence sources for a project.
 * Returns canonical identity for insight attribution.
 *
 * Query parameters:
 * - sourceType: Filter by source type (optional)
 * - limit: Max results (default 100, max 500)
 * - offset: Pagination offset (default 0)
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const projectId = extractProjectId(req.params);
    if (projectId === null) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid project ID' },
      });
      return;
    }

    // Validate sourceType if provided
    const sourceType = req.query.sourceType as SourceType | undefined;
    if (sourceType && !VALID_SOURCE_TYPES.includes(sourceType)) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid sourceType. Must be one of: ${VALID_SOURCE_TYPES.join(', ')}`,
        },
      });
      return;
    }

    const limit = Math.min(parseInt(req.query.limit as string, 10) || 100, 500);
    const offset = parseInt(req.query.offset as string, 10) || 0;

    // Verify project membership (throws 403 if unauthorized)
    await assertProjectAccessByActor(req.ctx!.actor.id, projectId, req.ctx!.organization.id);

    const sources = await evidenceSourceService.listEvidenceSourcesByProject(projectId, {
      sourceType,
      limit,
      offset,
    });

    // Transform to API contract format
    const data = sources.map(source => ({
      id: source.id,
      publicId: source.public_id,
      label: source.label,
      sourceType: source.source_type,
      createdAt: source.created_at.toISOString(),
    }));

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

export default router;
