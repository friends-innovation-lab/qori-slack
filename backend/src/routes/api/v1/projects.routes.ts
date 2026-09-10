/**
 * /api/v1/projects — Project endpoints, org-scoped.
 */

import { Router } from 'express';
import { requireAuth } from '../../../middleware/auth';
import * as projectAppService from '../../../application/project.app-service';

const router = Router();

// Create a new project
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, problem_statement, description, approver_actor_public_id } = req.body;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Project name is required' } });
      return;
    }
    if (!problem_statement || typeof problem_statement !== 'string') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Problem statement is required' } });
      return;
    }
    const result = await projectAppService.createProject(req.ctx!, {
      name,
      problem_statement,
      description: typeof description === 'string' ? description : undefined,
      approver_actor_public_id: typeof approver_actor_public_id === 'string' ? approver_actor_public_id : undefined,
    });
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

// List projects the actor has access to
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const result = await projectAppService.listProjects(req.ctx!);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// Get a single project by slug
router.get('/:projectSlug', requireAuth, async (req, res, next) => {
  try {
    const result = await projectAppService.getProject(req.ctx!, req.params.projectSlug as string);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// Get studies for a project
router.get('/:projectSlug/studies', requireAuth, async (req, res, next) => {
  try {
    const result = await projectAppService.getProjectStudies(req.ctx!, req.params.projectSlug as string);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

// Create a study within a project
router.post('/:projectSlug/studies', requireAuth, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Study name is required' } });
      return;
    }
    const result = await projectAppService.createStudyForProject(
      req.ctx!,
      req.params.projectSlug as string,
      { name },
    );
    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

// Get governance summary for a project
router.get('/:projectSlug/governance', requireAuth, async (req, res, next) => {
  try {
    const result = await projectAppService.getProjectGovernance(req.ctx!, req.params.projectSlug as string);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
