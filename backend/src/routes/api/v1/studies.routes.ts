/**
 * /api/v1/studies — Study endpoints, org-scoped.
 *
 * WS-1: Added brief and plan sub-routes for Workspace operating loop.
 */

import { Router } from 'express';
import { requireAuth } from '../../../middleware/auth';
import * as studyAppService from '../../../application/study.app-service';
import * as approvalAppService from '../../../application/approval.app-service';
import { executeBrief, BriefGenerationIncompleteError } from '../../../application/brief.app-service';
import { updateBriefContent, updatePlanContent } from '../../../application/content-update.app-service';
import { executePlan, PlanGenerationIncompleteError } from '../../../application/plan.app-service';

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

    // Resolve study context — studyId is the EXACT study we must operate on
    const { studyId, projectId, studyName } = await studyAppService.resolveStudyContext(
      req.ctx!, req.params.studyId as string,
    );

    // Idempotency guard: if a brief is already pending_approval or approved for
    // this lifecycle state, return the existing brief instead of regenerating.
    // Legitimate regeneration only happens after an explicit resubmit transition
    // (changes_requested → null brief_status via resubmit endpoint).
    const sequelize = require('../../../database').default;
    const currentStudy = await sequelize.models.ResearchStudy.findByPk(studyId);
    if (currentStudy?.brief_status === 'pending_approval' || currentStudy?.brief_status === 'approved') {
      res.status(200).json({
        data: {
          study_public_id: req.params.studyId,
          brief_url: currentStudy.link || null,
          brief_status: currentStudy.brief_status,
        },
      });
      return;
    }

    // Get project for slug/name
    const project = await sequelize.models.Project.findByPk(projectId);
    if (!project) {
      res.status(404).json({ error: { code: 'RESOURCE_NOT_FOUND', message: 'Project not found' } });
      return;
    }

    const actorName = req.ctx!.actor.displayName || 'Researcher';

    // CRITICAL FIX: Pass existingStudyId to ensure executeBrief uses THIS exact study.
    // Previously, executeBrief used project slug as the study name, which caused a
    // name mismatch when the study was created with a human-readable name. This led
    // to duplicate study creation and orphaned brief_status on the wrong study.
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
      existingStudyId: studyId,  // Use exact study identity, not name-based lookup
    });

    // ── LIFECYCLE INVARIANT GUARD ──
    // A Brief MUST NOT transition to pending_approval unless the minimum canonical
    // Brief commitments were successfully generated AND persisted to the SAME study.
    //
    // Verify persisted state from DB rather than trusting in-memory result arrays,
    // to catch scenarios where extraction or artifact persistence failed silently.
    const missingPrerequisites: string[] = [];

    // 1. Verify artifact was created for THIS study
    const artifact = await sequelize.models.ResearchArtifact?.findOne({
      where: { study_id: studyId, artifact_type: 'brief' },
      order: [['created_at', 'DESC']],
    });
    if (!artifact) {
      missingPrerequisites.push('artifact not created');
    } else {
      // 2. Verify artifact_sections were written (prose content)
      const sectionCount = await sequelize.models.ArtifactSection?.count({
        where: { artifact_id: artifact.id },
      });
      if (!sectionCount || sectionCount < 3) {
        // Expect at minimum: summary, problem_narrative, method_prose
        missingPrerequisites.push(`insufficient artifact sections (found ${sectionCount || 0}, need >= 3)`);
      }
    }

    // 3. Verify study_variables were written (cascade extraction)
    const variableCount = await sequelize.models.StudyVariable?.count({
      where: { study_id: studyId, scope: 'study' },
    });
    if (!variableCount || variableCount < 3) {
      // Expect at minimum: research_objectives, research_questions, target_barriers
      missingPrerequisites.push(`insufficient study variables (found ${variableCount || 0}, need >= 3)`);
    }

    // 4. Verify in-memory result meets minimum content requirements
    if (result.objectives.length === 0) {
      missingPrerequisites.push('no research objectives');
    }
    if (result.researchQuestions.length === 0) {
      missingPrerequisites.push('no research questions');
    }
    if (result.targetBarriers.length === 0) {
      missingPrerequisites.push('no target barriers');
    }
    if (!result.methodology) {
      missingPrerequisites.push('no methodology');
    }

    // If any prerequisite is missing, do NOT transition to pending_approval.
    // Return a structured error so the caller knows what failed.
    if (missingPrerequisites.length > 0) {
      console.error(`[BRIEF] Lifecycle guard failed for study ${studyId}:`, missingPrerequisites);
      throw new BriefGenerationIncompleteError(missingPrerequisites);
    }

    // All prerequisites met — safe to transition to pending_approval
    const study = await sequelize.models.ResearchStudy.findByPk(studyId);
    if (study) {
      await study.update({
        brief_status: 'pending_approval',
        brief_change_feedback: null,
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
    // Handle BriefGenerationIncompleteError with appropriate status
    if (error instanceof BriefGenerationIncompleteError) {
      res.status(422).json({
        error: {
          code: error.code,
          message: error.message,
          missing_fields: error.missingFields,
        },
      });
      return;
    }
    next(error);
  }
});

// Approve a brief
router.post('/:studyId/brief/approve', requireAuth, async (req, res, next) => {
  try {
    const { studyId, projectId, studyName } = await studyAppService.resolveStudyContext(
      req.ctx!, req.params.studyId as string,
    );
    // Resolve study link for audit trail (file_name derived from URL)
    const studyRecord = await require('../../../database').default.models.ResearchStudy.findByPk(studyId, {
      attributes: ['link'],
    });
    const result = await approvalAppService.executeDocumentApproval(req.ctx!, {
      documentType: 'brief',
      studyId,
      projectId,
      studyName,
      action: 'approve',
      documentUrl: studyRecord?.link || undefined,
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
    const studyForUrl = await require('../../../database').default.models.ResearchStudy.findByPk(studyId, {
      attributes: ['link'],
    });
    const result = await approvalAppService.executeDocumentApproval(req.ctx!, {
      documentType: 'brief',
      studyId,
      projectId,
      studyName,
      action: 'request_changes',
      comment,
      documentUrl: studyForUrl?.link || undefined,
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

// Generate/submit a plan for a study
router.post('/:studyId/plan', requireAuth, async (req, res, next) => {
  try {
    const { studyId, projectId, studyName } = await studyAppService.resolveStudyContext(
      req.ctx!, req.params.studyId as string,
    );

    // Idempotency guard: if a plan record already exists for this study,
    // return the existing plan instead of regenerating.
    const sequelize = require('../../../database').default;
    const existingPlan = await sequelize.models.ResearchPlan?.findOne({
      where: { study_id: studyId },
      order: [['created_at', 'DESC']],
    });
    if (existingPlan) {
      res.status(200).json({
        data: {
          plan_url: existingPlan.file_url || existingPlan.url || null,
        },
      });
      return;
    }

    const actorName = req.ctx!.actor.displayName || 'Researcher';
    const result = await executePlan(req.ctx!, {
      studyId,
      studyName,
      projectId,
      leadResearcher: actorName,
      createdByActorId: req.ctx!.actor.publicId,
      operationalRisks: req.body.operational_risks || '',
    });

    // ── LIFECYCLE INVARIANT GUARD (Plan) ──
    // Verify persisted state before considering the plan successfully generated.
    const missingPrerequisites: string[] = [];

    // 1. Verify artifact was created for THIS study
    const artifact = await sequelize.models.ResearchArtifact?.findOne({
      where: { study_id: studyId, artifact_type: 'plan' },
      order: [['created_at', 'DESC']],
    });
    if (!artifact) {
      missingPrerequisites.push('artifact not created');
    } else {
      // 2. Verify artifact_sections were written (prose content)
      const sectionCount = await sequelize.models.ArtifactSection?.count({
        where: { artifact_id: artifact.id },
      });
      if (!sectionCount || sectionCount < 2) {
        missingPrerequisites.push(`insufficient artifact sections (found ${sectionCount || 0}, need >= 2)`);
      }
    }

    // 3. Verify cascade extraction succeeded
    if (!result.extractionSuccess) {
      missingPrerequisites.push('cascade extraction failed');
    }

    // If any prerequisite is missing, return error
    if (missingPrerequisites.length > 0) {
      console.error(`[PLAN] Lifecycle guard failed for study ${studyId}:`, missingPrerequisites);
      throw new PlanGenerationIncompleteError(missingPrerequisites);
    }

    res.status(201).json({
      data: {
        plan_url: result.url,
      },
    });
  } catch (error) {
    // Handle PlanGenerationIncompleteError with appropriate status
    if (error instanceof PlanGenerationIncompleteError) {
      res.status(422).json({
        error: {
          code: error.code,
          message: error.message,
          missing_fields: error.missingFields,
        },
      });
      return;
    }
    next(error);
  }
});

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

// ─── Content PATCH endpoints (WS-2 document workspace) ──────────

// Update Brief content (prose sections + structured arrays)
router.patch('/:studyId/brief/content', requireAuth, async (req, res, next) => {
  try {
    const { artifact_version, sections, structured } = req.body;
    if (typeof artifact_version !== 'number') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'artifact_version is required' } });
      return;
    }
    const result = await updateBriefContent(req.ctx!, req.params.studyId as string, {
      artifact_version,
      sections,
      structured,
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// Update Plan content (prose sections + structured arrays)
router.patch('/:studyId/plan/content', requireAuth, async (req, res, next) => {
  try {
    const { artifact_version, sections, structured } = req.body;
    if (typeof artifact_version !== 'number') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'artifact_version is required' } });
      return;
    }
    const result = await updatePlanContent(req.ctx!, req.params.studyId as string, {
      artifact_version,
      sections,
      structured,
    });
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
