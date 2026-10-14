/**
 * /api/v1/projects/:projectId/studies/:studyId/readouts — Desk Research Readout API
 *
 * DR-6b-3: Study-scoped readout management for Desk Research synthesis.
 * All routes require authentication and enforce nested resource isolation.
 *
 * Per DR-6b canonical contract:
 * - Readouts are study-scoped within a project (D1)
 * - Eligible evidence comes from accepted insights in the same project (D2)
 * - Save and Approve are separate actions (D3)
 * - Optimistic concurrency via content_version (D4)
 * - Display IDs use RO-0001 format, study-scoped (D7)
 */

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../../middleware/auth';
import * as deskReadoutService from '../../../services/desk-readout.service';
import {
  assertProjectAccessByActor,
  assertProjectResearcherByActor,
  AuthorizationError,
} from '../../../services/authorization.service';
import type { Project } from '../../../database/models/project';
import type { ResearchStudy } from '../../../database/models/research_study';
import sequelize from '../../../database';

const router = Router({ mergeParams: true });

// Typed model references
const ProjectModel = sequelize.models.Project as typeof Project;
const StudyModel = sequelize.models.ResearchStudy as typeof ResearchStudy;

// UUID pattern for identifier detection
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ═══════════════════════════════════════════════════════════════════════════
// RESOLUTION HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Resolve project identifier (numeric ID, UUID public_id, or slug) to numeric project ID.
 * Returns null if project not found or identifier invalid.
 */
async function resolveProjectId(
  projectIdParam: string,
  organizationId: number,
): Promise<number | null> {
  if (!projectIdParam || !ProjectModel) return null;

  // 1. Try parsing as numeric ID
  if (/^\d+$/.test(projectIdParam)) {
    const numericId = parseInt(projectIdParam, 10);
    const project = await ProjectModel.findOne({
      where: { id: numericId, organization_id: organizationId },
      attributes: ['id'],
    });
    return project ? project.id : null;
  }

  // 2. Try UUID public_id
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

/**
 * Resolve study identifier (numeric ID or UUID public_id) to numeric study ID.
 * Verifies study belongs to the specified project.
 * Returns null if study not found or doesn't belong to project.
 */
async function resolveStudyId(
  studyIdParam: string,
  projectId: number,
): Promise<number | null> {
  if (!studyIdParam || !StudyModel) return null;

  let study: any = null;

  // 1. Try UUID public_id first
  if (UUID_PATTERN.test(studyIdParam)) {
    study = await StudyModel.findOne({
      where: { public_id: studyIdParam.toLowerCase() },
      attributes: ['id', 'project_id'],
    });
  }

  // 2. Try numeric ID
  if (!study && /^\d+$/.test(studyIdParam)) {
    const numericId = parseInt(studyIdParam, 10);
    study = await StudyModel.findByPk(numericId, {
      attributes: ['id', 'project_id'],
    });
  }

  // Verify project ownership
  if (!study || study.project_id !== projectId) return null;

  return study.id;
}

/**
 * Resolve readout by numeric ID or public_id, verify ownership.
 * Returns null if not found or ownership mismatch.
 */
async function resolveAndVerifyReadout(
  readoutIdParam: string,
  studyId: number,
  projectId: number,
  actorId: number,
): Promise<{ readoutId: number; readout: deskReadoutService.ReadoutDetail } | null> {
  let readout: deskReadoutService.ReadoutDetail | null = null;

  if (UUID_PATTERN.test(readoutIdParam)) {
    readout = await deskReadoutService.getReadoutByPublicId(
      readoutIdParam.toLowerCase(),
      actorId,
    );
  } else if (/^\d+$/.test(readoutIdParam)) {
    readout = await deskReadoutService.getReadoutById(
      parseInt(readoutIdParam, 10),
      actorId,
    );
  }

  if (!readout || readout.studyId !== studyId || readout.projectId !== projectId) {
    return null;
  }

  return { readoutId: readout.id, readout };
}

/**
 * Common resource resolution for all readout-specific endpoints.
 * Resolves project, study, and readout with ownership verification.
 */
interface ResolvedResources {
  projectId: number;
  studyId: number;
  readoutId: number;
  readout: deskReadoutService.ReadoutDetail;
}

async function resolveAllResources(
  req: Request,
  res: Response,
): Promise<ResolvedResources | null> {
  const projectIdParam = req.params.projectId as string;
  const studyIdParam = req.params.studyId as string;
  const readoutIdParam = req.params.readoutId as string;

  const projectId = await resolveProjectId(projectIdParam, req.ctx!.organization.id);
  if (projectId === null) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Project not found' },
    });
    return null;
  }

  const studyId = await resolveStudyId(studyIdParam, projectId);
  if (studyId === null) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Study not found' },
    });
    return null;
  }

  const resolved = await resolveAndVerifyReadout(
    readoutIdParam,
    studyId,
    projectId,
    req.ctx!.actor.id,
  );
  if (resolved === null) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Readout not found' },
    });
    return null;
  }

  return { projectId, studyId, ...resolved };
}

/**
 * Resolve project and study only (for list and create endpoints).
 */
async function resolveProjectAndStudy(
  req: Request,
  res: Response,
): Promise<{ projectId: number; studyId: number } | null> {
  const projectIdParam = req.params.projectId as string;
  const studyIdParam = req.params.studyId as string;

  const projectId = await resolveProjectId(projectIdParam, req.ctx!.organization.id);
  if (projectId === null) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Project not found' },
    });
    return null;
  }

  const studyId = await resolveStudyId(studyIdParam, projectId);
  if (studyId === null) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Study not found' },
    });
    return null;
  }

  return { projectId, studyId };
}

// ═══════════════════════════════════════════════════════════════════════════
// ERROR HANDLING HELPER
// ═══════════════════════════════════════════════════════════════════════════

function handleServiceError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof AuthorizationError) {
    res.status(403).json({
      error: { code: 'AUTHORIZATION_DENIED', message: error.message },
    });
    return;
  }
  if (error instanceof deskReadoutService.ValidationError) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: error.message },
    });
    return;
  }
  if (error instanceof deskReadoutService.ReadoutNotFoundError) {
    res.status(404).json({
      error: { code: 'NOT_FOUND', message: error.message },
    });
    return;
  }
  if (error instanceof deskReadoutService.ConcurrencyError) {
    res.status(409).json({
      error: {
        code: 'CONCURRENCY_ERROR',
        message: error.message,
        currentVersion: error.currentVersion,
      },
    });
    return;
  }
  if (error instanceof deskReadoutService.ApprovalEligibilityError) {
    res.status(422).json({
      error: {
        code: 'APPROVAL_INELIGIBLE',
        message: error.message,
        errors: error.errors,
      },
    });
    return;
  }
  next(error);
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/projects/:projectId/studies/:studyId/readouts
 *
 * Create a new readout for a study.
 * Requires researcher role.
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const resolved = await resolveProjectAndStudy(req, res);
    if (!resolved) return;

    const { projectId, studyId } = resolved;

    // Verify researcher role
    await assertProjectResearcherByActor(req.ctx!.actor.id, projectId, req.ctx!.organization.id);

    // Validate request body
    const { title, question } = req.body;
    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'title is required' },
      });
      return;
    }

    const result = await deskReadoutService.createReadout({
      studyId,
      projectId,
      title: title.trim(),
      question: question?.trim() || undefined,
      createdByActorId: req.ctx!.actor.id,
    });

    res.status(201).json({ data: result });
  } catch (error) {
    handleServiceError(error, res, next);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// LIST
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/projects/:projectId/studies/:studyId/readouts
 *
 * List readouts for a study.
 * Query params: limit (1-100, default 50), offset (default 0)
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const resolved = await resolveProjectAndStudy(req, res);
    if (!resolved) return;

    const { projectId, studyId } = resolved;

    // Verify project access
    await assertProjectAccessByActor(req.ctx!.actor.id, projectId, req.ctx!.organization.id);

    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
    const offset = parseInt(req.query.offset as string, 10) || 0;

    const result = await deskReadoutService.listReadoutsByStudy(
      studyId,
      req.ctx!.actor.id,
      { limit, offset },
    );

    res.json({
      data: {
        readouts: result.readouts,
        total: result.total,
        limit,
        offset,
      },
    });
  } catch (error) {
    handleServiceError(error, res, next);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET SINGLE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/projects/:projectId/studies/:studyId/readouts/:readoutId
 *
 * Retrieve a single readout with its draft.
 */
router.get('/:readoutId', requireAuth, async (req, res, next) => {
  try {
    const resolved = await resolveAllResources(req, res);
    if (!resolved) return;

    res.json({ data: resolved.readout });
  } catch (error) {
    handleServiceError(error, res, next);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SAVE DRAFT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * PATCH /api/v1/projects/:projectId/studies/:studyId/readouts/:readoutId/draft
 *
 * Save draft with optimistic concurrency.
 * Returns 409 on version conflict with submitted content for recovery.
 */
router.patch('/:readoutId/draft', requireAuth, async (req, res, next) => {
  try {
    const resolved = await resolveAllResources(req, res);
    if (!resolved) return;

    const { projectId, readoutId } = resolved;

    // Validate request body
    const { expectedVersion, content, findingsChecked, implicationsReviewed } = req.body;

    if (typeof expectedVersion !== 'number' || expectedVersion < 1) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'expectedVersion is required and must be >= 1' },
      });
      return;
    }

    if (!content || typeof content !== 'object') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'content is required' },
      });
      return;
    }

    // Verify researcher role
    await assertProjectResearcherByActor(req.ctx!.actor.id, projectId, req.ctx!.organization.id);

    const result = await deskReadoutService.saveDraft({
      readoutId,
      content,
      findingsChecked: findingsChecked || [],
      implicationsReviewed: implicationsReviewed || [],
      expectedVersion,
      editedByActorId: req.ctx!.actor.id,
    });

    // Translate conflict to 409
    if (!result.success && result.conflict) {
      res.status(409).json({
        error: {
          code: 'CONCURRENCY_ERROR',
          message: 'Draft was modified by another user',
          currentVersion: result.conflict.currentVersion,
          submittedContent: result.conflict.submittedContent,
        },
      });
      return;
    }

    res.json({
      data: {
        draft: result.draft,
        invalidatedFindings: result.invalidatedFindings,
        invalidatedImplications: result.invalidatedImplications,
      },
    });
  } catch (error) {
    handleServiceError(error, res, next);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// APPROVAL ELIGIBILITY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/projects/:projectId/studies/:studyId/readouts/:readoutId/eligibility
 *
 * Check if readout is eligible for approval.
 */
router.get('/:readoutId/eligibility', requireAuth, async (req, res, next) => {
  try {
    const resolved = await resolveAllResources(req, res);
    if (!resolved) return;

    const result = await deskReadoutService.checkApprovalEligibility(
      resolved.readoutId,
      req.ctx!.actor.id,
    );

    res.json({ data: result });
  } catch (error) {
    handleServiceError(error, res, next);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// APPROVE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/projects/:projectId/studies/:studyId/readouts/:readoutId/approve
 *
 * Approve readout with optimistic concurrency.
 * Creates immutable approval snapshot.
 */
router.post('/:readoutId/approve', requireAuth, async (req, res, next) => {
  try {
    const resolved = await resolveAllResources(req, res);
    if (!resolved) return;

    const { projectId, readoutId } = resolved;

    // Validate request body
    const { expectedVersion, approvalNote, supersessionNotes } = req.body;

    if (typeof expectedVersion !== 'number' || expectedVersion < 1) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'expectedVersion is required and must be >= 1' },
      });
      return;
    }

    // Verify researcher role
    await assertProjectResearcherByActor(req.ctx!.actor.id, projectId, req.ctx!.organization.id);

    const result = await deskReadoutService.approveReadout({
      readoutId,
      expectedVersion,
      approvedByActorId: req.ctx!.actor.id,
      approvalNote: approvalNote?.trim() || undefined,
      supersessionNotes: supersessionNotes || undefined,
    });

    res.status(201).json({ data: result });
  } catch (error) {
    handleServiceError(error, res, next);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// APPROVAL HISTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/projects/:projectId/studies/:studyId/readouts/:readoutId/approvals
 *
 * Retrieve approval history for a readout.
 */
router.get('/:readoutId/approvals', requireAuth, async (req, res, next) => {
  try {
    const resolved = await resolveAllResources(req, res);
    if (!resolved) return;

    const approvals = await deskReadoutService.getApprovalHistory(
      resolved.readoutId,
      req.ctx!.actor.id,
    );

    res.json({ data: { approvals } });
  } catch (error) {
    handleServiceError(error, res, next);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GENERATION HISTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/projects/:projectId/studies/:studyId/readouts/:readoutId/versions
 *
 * Retrieve generation history for a readout.
 * Note: POST /generate is deferred until AI worker implementation.
 */
router.get('/:readoutId/versions', requireAuth, async (req, res, next) => {
  try {
    const resolved = await resolveAllResources(req, res);
    if (!resolved) return;

    const versions = await deskReadoutService.getGenerationHistory(
      resolved.readoutId,
      req.ctx!.actor.id,
    );

    res.json({ data: { versions } });
  } catch (error) {
    handleServiceError(error, res, next);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// EVIDENCE ELIGIBILITY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/projects/:projectId/studies/:studyId/readouts/:readoutId/evidence
 *
 * Retrieve eligible evidence (accepted, non-withdrawn insights) for citation.
 * Evidence is project-scoped, not study-scoped (per D2).
 */
router.get('/:readoutId/evidence', requireAuth, async (req, res, next) => {
  try {
    const resolved = await resolveAllResources(req, res);
    if (!resolved) return;

    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
    const offset = parseInt(req.query.offset as string, 10) || 0;

    // Evidence is project-scoped
    const result = await deskReadoutService.getEligibleEvidence(
      resolved.projectId,
      req.ctx!.actor.id,
      { limit, offset },
    );

    res.json({
      data: {
        insights: result.insights,
        total: result.total,
        limit,
        offset,
      },
    });
  } catch (error) {
    handleServiceError(error, res, next);
  }
});

export default router;
