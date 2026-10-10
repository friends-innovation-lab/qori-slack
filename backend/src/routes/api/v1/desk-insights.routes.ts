/**
 * /api/v1/projects/:projectId/insights — Desk Research Insights API
 *
 * DR-1: Canonical insight management for Desk Research.
 * All routes require authentication and project access.
 *
 * Per SPEC-2 design authority:
 * - Insights are project-scoped (D1)
 * - Researchers and above may self-accept (D2)
 * - Save and Accept are separate (D3)
 * - Withdrawal reason required (D6)
 * - Display IDs use IN-0001 format (D7)
 * - Protect sources cited by accepted revisions (D9)
 */

import { Router } from 'express';
import { requireAuth } from '../../../middleware/auth';
import * as deskInsightService from '../../../services/desk-insight.service';
import {
  assertProjectAccessByActor,
  assertProjectResearcherByActor,
  AuthorizationError,
} from '../../../services/authorization.service';
import type { EvidenceReference } from '../../../database/models/evidence_construct_revision';

const router = Router({ mergeParams: true });

// Helper to extract projectId from route params
function extractProjectId(params: Record<string, string | string[] | undefined>): number | null {
  const projectIdParam = params.projectId;
  if (typeof projectIdParam !== 'string') return null;
  const parsed = parseInt(projectIdParam, 10);
  return isNaN(parsed) ? null : parsed;
}

// ═══════════════════════════════════════════════════════════════════════════
// LIST & COUNT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/projects/:projectId/insights
 *
 * List desk research insights for a project.
 * Query params:
 *   - status: 'proposed' | 'accepted' | 'rejected' | 'withdrawn' | 'all'
 *   - sourceId: number (filter by evidence source)
 *   - limit: number (default 50, max 100)
 *   - offset: number (default 0)
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

    // Verify actor has access to this project
    await assertProjectAccessByActor(req.ctx!.actor.id, projectId, req.ctx!.organization.id);

    const status = req.query.status as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
    const offset = parseInt(req.query.offset as string, 10) || 0;

    // DR-4a: Parse optional sourceId filter
    const sourceIdParam = req.query.sourceId as string | undefined;
    let sourceId: number | undefined;
    if (sourceIdParam) {
      sourceId = parseInt(sourceIdParam, 10);
      if (isNaN(sourceId)) {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Invalid sourceId filter' },
        });
        return;
      }
    }

    // Validate status
    const validStatuses = ['proposed', 'accepted', 'rejected', 'withdrawn', 'all'];
    if (status && !validStatuses.includes(status)) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid status filter' },
      });
      return;
    }

    const result = await deskInsightService.listInsights(projectId, {
      status: status as any,
      sourceId,
      limit,
      offset,
    });

    res.json({
      data: result.insights,
      meta: {
        total: result.total,
        needsReviewCount: result.needsReviewCount,
        limit,
        offset,
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      res.status(403).json({
        error: { code: 'AUTHORIZATION_ERROR', message: error.message },
      });
      return;
    }
    next(error);
  }
});

/**
 * GET /api/v1/projects/:projectId/insights/needs-review-count
 *
 * Get count of insights needing review (for rail badge per D1).
 */
router.get('/needs-review-count', requireAuth, async (req, res, next) => {
  try {
    const projectId = extractProjectId(req.params);
    if (projectId === null) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid project ID' },
      });
      return;
    }

    // Verify actor has access to this project
    await assertProjectAccessByActor(req.ctx!.actor.id, projectId, req.ctx!.organization.id);

    const count = await deskInsightService.countInsightsNeedingReview(projectId);

    res.json({ data: { count } });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      res.status(403).json({
        error: { code: 'AUTHORIZATION_ERROR', message: error.message },
      });
      return;
    }
    next(error);
  }
});

/**
 * GET /api/v1/projects/:projectId/insights/synthesis-eligible
 *
 * Get insights eligible for synthesis (accepted, not withdrawn).
 */
router.get('/synthesis-eligible', requireAuth, async (req, res, next) => {
  try {
    const projectId = extractProjectId(req.params);
    if (projectId === null) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid project ID' },
      });
      return;
    }

    // Verify actor has access to this project
    await assertProjectAccessByActor(req.ctx!.actor.id, projectId, req.ctx!.organization.id);

    const insights = await deskInsightService.getSynthesisEligibleInsights(projectId);

    res.json({ data: insights });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      res.status(403).json({
        error: { code: 'AUTHORIZATION_ERROR', message: error.message },
      });
      return;
    }
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// CREATE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/projects/:projectId/insights
 *
 * Create a new desk research insight.
 * Body:
 *   - wording: string (required)
 *   - evidenceReferences: EvidenceReference[] (required, at least one)
 *   - origin?: 'ai' | 'researcher' (default: 'researcher')
 *   - discoveryRunId?: number (for AI-generated insights)
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const projectId = extractProjectId(req.params);
    if (projectId === null) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid project ID' },
      });
      return;
    }

    // Verify actor has access to this project
    await assertProjectAccessByActor(req.ctx!.actor.id, projectId, req.ctx!.organization.id);

    const { wording, evidenceReferences, origin, discoveryRunId } = req.body;

    // Validate wording
    if (!wording || typeof wording !== 'string' || wording.trim().length === 0) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'wording is required' },
      });
      return;
    }

    // Validate evidence references
    if (!Array.isArray(evidenceReferences) || evidenceReferences.length === 0) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'At least one evidence reference is required' },
      });
      return;
    }

    // Validate each evidence reference
    for (let i = 0; i < evidenceReferences.length; i++) {
      const ref = evidenceReferences[i];
      if (!ref.evidenceSourceId || typeof ref.evidenceSourceId !== 'number') {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: `evidenceReferences[${i}].evidenceSourceId is required` },
        });
        return;
      }
      if (!ref.locator || typeof ref.locator !== 'object') {
        res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: `evidenceReferences[${i}].locator is required` },
        });
        return;
      }
    }

    const insight = await deskInsightService.createInsight({
      projectId,
      wording: wording.trim(),
      evidenceReferences: evidenceReferences as EvidenceReference[],
      createdBy: `actor:${req.ctx!.actor.publicId}`,
      origin: origin || 'researcher',
      discoveryRunId,
    });

    res.status(201).json({ data: insight });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      res.status(403).json({
        error: { code: 'AUTHORIZATION_ERROR', message: error.message },
      });
      return;
    }
    if (error instanceof deskInsightService.ValidationError) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: error.message },
      });
      return;
    }
    if (error instanceof deskInsightService.ProjectAccessError) {
      res.status(403).json({
        error: { code: 'PROJECT_ACCESS_ERROR', message: error.message },
      });
      return;
    }
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SINGLE INSIGHT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/projects/:projectId/insights/:insightId
 *
 * Get insight detail by ID.
 */
router.get('/:insightId', requireAuth, async (req, res, next) => {
  try {
    const projectId = extractProjectId(req.params);
    if (projectId === null) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid project ID' },
      });
      return;
    }

    // Verify actor has access to this project
    await assertProjectAccessByActor(req.ctx!.actor.id, projectId, req.ctx!.organization.id);

    const insightIdParam = req.params.insightId;
    if (!insightIdParam || typeof insightIdParam !== 'string') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid insight ID' },
      });
      return;
    }

    // Try to parse as integer first, then as UUID
    let insight;
    const parsed = parseInt(insightIdParam, 10);
    if (!isNaN(parsed)) {
      insight = await deskInsightService.getInsightById(parsed);
    } else {
      insight = await deskInsightService.getInsightByPublicId(insightIdParam);
    }

    if (!insight) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Insight not found' },
      });
      return;
    }

    // Verify project ownership
    if (insight.projectId !== projectId) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Insight not found' },
      });
      return;
    }

    res.json({ data: insight });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      res.status(403).json({
        error: { code: 'AUTHORIZATION_ERROR', message: error.message },
      });
      return;
    }
    next(error);
  }
});

/**
 * GET /api/v1/projects/:projectId/insights/:insightId/revisions
 *
 * Get revision history for an insight.
 */
router.get('/:insightId/revisions', requireAuth, async (req, res, next) => {
  try {
    const projectId = extractProjectId(req.params);
    if (projectId === null) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid project ID' },
      });
      return;
    }

    // Verify actor has access to this project
    await assertProjectAccessByActor(req.ctx!.actor.id, projectId, req.ctx!.organization.id);

    const insightId = parseInt(req.params.insightId as string, 10);
    if (isNaN(insightId)) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid insight ID' },
      });
      return;
    }

    // Verify insight exists and belongs to project
    const insight = await deskInsightService.getInsightById(insightId);
    if (!insight || insight.projectId !== projectId) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Insight not found' },
      });
      return;
    }

    const revisions = await deskInsightService.getRevisionHistory(insightId);

    res.json({ data: revisions });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      res.status(403).json({
        error: { code: 'AUTHORIZATION_ERROR', message: error.message },
      });
      return;
    }
    if (error instanceof deskInsightService.InsightNotFoundError) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: error.message },
      });
      return;
    }
    next(error);
  }
});

/**
 * GET /api/v1/projects/:projectId/insights/:insightId/reviews
 *
 * Get review history for an insight.
 */
router.get('/:insightId/reviews', requireAuth, async (req, res, next) => {
  try {
    const projectId = extractProjectId(req.params);
    if (projectId === null) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid project ID' },
      });
      return;
    }

    // Verify actor has access to this project
    await assertProjectAccessByActor(req.ctx!.actor.id, projectId, req.ctx!.organization.id);

    const insightId = parseInt(req.params.insightId as string, 10);
    if (isNaN(insightId)) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid insight ID' },
      });
      return;
    }

    // Verify insight exists and belongs to project
    const insight = await deskInsightService.getInsightById(insightId);
    if (!insight || insight.projectId !== projectId) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Insight not found' },
      });
      return;
    }

    const reviews = await deskInsightService.getReviewHistory(insightId);

    res.json({ data: reviews });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      res.status(403).json({
        error: { code: 'AUTHORIZATION_ERROR', message: error.message },
      });
      return;
    }
    if (error instanceof deskInsightService.InsightNotFoundError) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: error.message },
      });
      return;
    }
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// REVISIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/projects/:projectId/insights/:insightId/revisions
 *
 * Create a new proposed revision.
 * Body:
 *   - wording: string (required)
 *   - evidenceReferences: EvidenceReference[] (required)
 *   - expectedVersion: number (required for concurrency)
 */
router.post('/:insightId/revisions', requireAuth, async (req, res, next) => {
  try {
    const projectId = extractProjectId(req.params);
    if (projectId === null) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid project ID' },
      });
      return;
    }

    // Verify actor has access to this project
    await assertProjectAccessByActor(req.ctx!.actor.id, projectId, req.ctx!.organization.id);

    const insightId = parseInt(req.params.insightId as string, 10);
    if (isNaN(insightId)) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid insight ID' },
      });
      return;
    }

    const { wording, evidenceReferences, expectedVersion } = req.body;

    // Validate wording
    if (!wording || typeof wording !== 'string' || wording.trim().length === 0) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'wording is required' },
      });
      return;
    }

    // Validate evidence references
    if (!Array.isArray(evidenceReferences) || evidenceReferences.length === 0) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'At least one evidence reference is required' },
      });
      return;
    }

    // Validate expected version
    if (typeof expectedVersion !== 'number') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'expectedVersion is required for concurrency control' },
      });
      return;
    }

    // Verify insight exists and belongs to project first
    const existingInsight = await deskInsightService.getInsightById(insightId);
    if (!existingInsight || existingInsight.projectId !== projectId) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Insight not found' },
      });
      return;
    }

    const insight = await deskInsightService.createRevision({
      constructId: insightId,
      wording: wording.trim(),
      evidenceReferences: evidenceReferences as EvidenceReference[],
      createdBy: `actor:${req.ctx!.actor.publicId}`,
      expectedVersion,
    });

    res.status(201).json({ data: insight });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      res.status(403).json({
        error: { code: 'AUTHORIZATION_ERROR', message: error.message },
      });
      return;
    }
    if (error instanceof deskInsightService.ConcurrencyError) {
      res.status(409).json({
        error: {
          code: 'CONCURRENCY_ERROR',
          message: error.message,
          currentVersion: error.currentVersion,
        },
      });
      return;
    }
    if (error instanceof deskInsightService.ValidationError) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: error.message },
      });
      return;
    }
    if (error instanceof deskInsightService.InsightNotFoundError) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: error.message },
      });
      return;
    }
    if (error instanceof deskInsightService.ProjectAccessError) {
      res.status(403).json({
        error: { code: 'PROJECT_ACCESS_ERROR', message: error.message },
      });
      return;
    }
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// REVIEWS (Accept, Reject, Withdraw)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/v1/projects/:projectId/insights/:insightId/reviews
 *
 * Submit a review action (accept, reject, or withdraw).
 * Body:
 *   - action: 'accept' | 'reject' | 'withdraw'
 *   - revisionId?: number (required for accept/reject)
 *   - comment?: string (required for withdraw per D6, optional for others)
 *   - expectedVersion: number (required for concurrency)
 */
router.post('/:insightId/reviews', requireAuth, async (req, res, next) => {
  try {
    const projectId = extractProjectId(req.params);
    if (projectId === null) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid project ID' },
      });
      return;
    }

    // D2: Verify actor has researcher role or higher for accept/reject/withdraw
    await assertProjectResearcherByActor(req.ctx!.actor.id, projectId, req.ctx!.organization.id);

    const insightId = parseInt(req.params.insightId as string, 10);
    if (isNaN(insightId)) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid insight ID' },
      });
      return;
    }

    const { action, revisionId, comment, expectedVersion } = req.body;

    // Validate action
    if (!action || !['accept', 'reject', 'withdraw'].includes(action)) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'action must be "accept", "reject", or "withdraw"' },
      });
      return;
    }

    // Validate expected version
    if (typeof expectedVersion !== 'number') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'expectedVersion is required for concurrency control' },
      });
      return;
    }

    // Validate revisionId for accept/reject
    if ((action === 'accept' || action === 'reject') && typeof revisionId !== 'number') {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'revisionId is required for accept/reject' },
      });
      return;
    }

    // Verify insight exists and belongs to project first
    const existingInsight = await deskInsightService.getInsightById(insightId);
    if (!existingInsight || existingInsight.projectId !== projectId) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Insight not found' },
      });
      return;
    }

    let insight;
    const reviewInput = {
      constructId: insightId,
      revisionId,
      action,
      reviewedBy: `actor:${req.ctx!.actor.publicId}`,
      comment,
      expectedVersion,
    };

    switch (action) {
      case 'accept':
        insight = await deskInsightService.acceptRevision(reviewInput);
        break;
      case 'reject':
        insight = await deskInsightService.rejectRevision(reviewInput);
        break;
      case 'withdraw':
        insight = await deskInsightService.withdrawInsight(reviewInput);
        break;
    }

    res.status(201).json({ data: insight });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      res.status(403).json({
        error: { code: 'AUTHORIZATION_ERROR', message: error.message },
      });
      return;
    }
    if (error instanceof deskInsightService.ConcurrencyError) {
      res.status(409).json({
        error: {
          code: 'CONCURRENCY_ERROR',
          message: error.message,
          currentVersion: error.currentVersion,
        },
      });
      return;
    }
    if (error instanceof deskInsightService.ValidationError) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: error.message },
      });
      return;
    }
    if (error instanceof deskInsightService.InsightNotFoundError) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: error.message },
      });
      return;
    }
    if (error instanceof deskInsightService.RevisionNotFoundError) {
      res.status(404).json({
        error: { code: 'NOT_FOUND', message: error.message },
      });
      return;
    }
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SOURCE PROTECTION (D9)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * GET /api/v1/projects/:projectId/insights/source-protection/:sourceId
 *
 * Check if a source is protected by an accepted revision.
 * Used to enforce D9: block removal of cited sources.
 */
router.get('/source-protection/:sourceId', requireAuth, async (req, res, next) => {
  try {
    const projectId = extractProjectId(req.params);
    if (projectId === null) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid project ID' },
      });
      return;
    }

    // Verify actor has access to this project
    await assertProjectAccessByActor(req.ctx!.actor.id, projectId, req.ctx!.organization.id);

    const sourceId = parseInt(req.params.sourceId as string, 10);
    if (isNaN(sourceId)) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Invalid source ID' },
      });
      return;
    }

    const isCited = await deskInsightService.isSourceCitedByAcceptedRevision(sourceId);

    res.json({
      data: {
        sourceId,
        isCitedByAcceptedRevision: isCited,
        protected: isCited,
      },
    });
  } catch (error) {
    if (error instanceof AuthorizationError) {
      res.status(403).json({
        error: { code: 'AUTHORIZATION_ERROR', message: error.message },
      });
      return;
    }
    next(error);
  }
});

export default router;
