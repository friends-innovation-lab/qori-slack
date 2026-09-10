/**
 * /api/v1/studies — Study endpoints, org-scoped.
 *
 * WS-1: Added brief and plan sub-routes for Workspace operating loop.
 */

import { Router } from 'express';
import { requireAuth } from '../../../middleware/auth';
import * as studyAppService from '../../../application/study.app-service';
import * as approvalAppService from '../../../application/approval.app-service';
import { executeBrief } from '../../../application/brief.app-service';

const router = Router();

// Get a single study
router.get('/:studyId', requireAuth, async (req, res, next) => {
  try {
    const result = await studyAppService.getStudy(req.ctx!, req.params.studyId as string);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// ─── Brief sub-routes ─────────────────────────────────────────────

// Get brief details for a study
router.get('/:studyId/brief', requireAuth, async (req, res, next) => {
  try {
    const result = await studyAppService.getStudyBrief(req.ctx!, req.params.studyId as string);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// Generate/submit a brief for a study
router.post('/:studyId/brief', requireAuth, async (req, res, next) => {
  try {
    const { problem_statement, learning_objectives, methodology } = req.body;
    if (!problem_statement || typeof problem_statement !== 'string') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Problem statement is required' } });
      return;
    }
    if (!learning_objectives || typeof learning_objectives !== 'string') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Learning objectives are required' } });
      return;
    }
    if (!methodology || typeof methodology !== 'string') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Methodology is required' } });
      return;
    }

    // Resolve study context
    const { studyId, projectId, studyName } = await studyAppService.resolveStudyContext(
      req.ctx!, req.params.studyId as string,
    );

    // Get project for slug/name
    const sequelize = require('../../../database').default;
    const project = await sequelize.models.Project.findByPk(projectId);
    if (!project) {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Project not found' } });
      return;
    }

    const actorName = req.ctx!.actor.displayName || 'Researcher';
    const result = await executeBrief(req.ctx!, {
      projectId,
      projectSlug: project.slug,
      projectName: project.name,
      leadResearcher: actorName,
      requestorName: actorName,
      createdByActorId: req.ctx!.actor.publicId,
      researcherEmail: '',
      problemStatement: problem_statement,
      learningObjectives: learning_objectives,
      outOfScope: req.body.out_of_scope || '',
      methodology: methodology,
      methodologyValue: req.body.method_override || methodology,
      participantApproach: req.body.participant_approach || '',
      recruitmentSources: req.body.recruitment_sources || '',
      startDate: req.body.start_date || '',
      decisionDeadline: req.body.decision_deadline || '',
      budget: req.body.budget || '',
      discoverySelections: req.body.discovery_selections || [],
    });

    // Update study brief_status (mirrors Slack handler behavior)
    const study = await sequelize.models.ResearchStudy.findByPk(studyId);
    if (study) {
      await study.update({
        brief_status: 'pending_approval',
        link: result.url,
        updated_at: new Date(),
      });
    }

    res.status(201).json({
      data: {
        study_public_id: req.params.studyId,
        brief_url: result.url,
        brief_status: 'pending_approval',
      },
    });
  } catch (error) {
    next(error);
  }
});

// Approve a brief
router.post('/:studyId/brief/approve', requireAuth, async (req, res, next) => {
  try {
    const { studyId, projectId, studyName } = await studyAppService.resolveStudyContext(
      req.ctx!, req.params.studyId as string,
    );
    const result = await approvalAppService.executeDocumentApproval(req.ctx!, {
      documentType: 'brief',
      studyId,
      projectId,
      studyName,
      action: 'approve',
    });
    res.json({ data: { new_status: result.newStatus } });
  } catch (error) {
    next(error);
  }
});

// Request changes on a brief
router.post('/:studyId/brief/request-changes', requireAuth, async (req, res, next) => {
  try {
    const { comment } = req.body;
    if (!comment || typeof comment !== 'string') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Comment is required when requesting changes' } });
      return;
    }
    const { studyId, projectId, studyName } = await studyAppService.resolveStudyContext(
      req.ctx!, req.params.studyId as string,
    );
    const result = await approvalAppService.executeDocumentApproval(req.ctx!, {
      documentType: 'brief',
      studyId,
      projectId,
      studyName,
      action: 'request_changes',
      comment,
    });
    res.json({ data: { new_status: result.newStatus } });
  } catch (error) {
    next(error);
  }
});

// Resubmit a brief after changes were requested
router.post('/:studyId/brief/resubmit', requireAuth, async (req, res, next) => {
  try {
    const result = await studyAppService.resubmitBrief(req.ctx!, req.params.studyId as string);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// ─── Plan sub-routes ──────────────────────────────────────────────

// Get plan details for a study
router.get('/:studyId/plan', requireAuth, async (req, res, next) => {
  try {
    const result = await studyAppService.getStudyPlan(req.ctx!, req.params.studyId as string);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// Get cascade readiness for plan creation
router.get('/:studyId/cascade-readiness', requireAuth, async (req, res, next) => {
  try {
    const result = await studyAppService.getCascadeReadiness(req.ctx!, req.params.studyId as string);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// ─── Existing sub-routes ──────────────────────────────────────────

// Get evidence sources for a study
router.get('/:studyId/sources', requireAuth, async (req, res, next) => {
  try {
    const result = await studyAppService.getStudySources(req.ctx!, req.params.studyId as string);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// Get evidence constructs for a study
router.get('/:studyId/evidence', requireAuth, async (req, res, next) => {
  try {
    const result = await studyAppService.getStudyEvidence(req.ctx!, req.params.studyId as string);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// Get artifacts for a study
router.get('/:studyId/artifacts', requireAuth, async (req, res, next) => {
  try {
    const result = await studyAppService.getStudyArtifacts(req.ctx!, req.params.studyId as string);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
