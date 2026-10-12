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
import type { Project } from '../../../database/models/project';
import sequelize from '../../../database';

const router = Router({ mergeParams: true });

// Typed model reference
const ProjectModel = sequelize.models.Project as typeof Project;

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
  const numericId = parseInt(projectIdParam, 10);
  if (!isNaN(numericId)) {
    const project = await ProjectModel.findOne({
      where: { id: numericId, organization_id: organizationId },
      attributes: ['id'],
    });
    return project ? project.id : null;
  }

  // 2. Try UUID public_id
  if (UUID_PATTERN.test(projectIdParam)) {
    const project = await ProjectModel.findOne({
      where: { public_id: projectIdParam, organization_id: organizationId },
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
    const projectId = await resolveProjectId(req.params.projectId, req.ctx!.organization.id);
    if (projectId === null) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid or unknown project identifier' },
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
