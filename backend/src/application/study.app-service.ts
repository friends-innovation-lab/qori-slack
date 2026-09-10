/**
 * Study Application Service — PLAT-3
 *
 * Organization-scoped study operations.
 */

import type { ApplicationContext } from '../types/application-context';
import type { StudyResource, ArtifactResource, EvidenceSourceResource, EvidenceConstructResource } from '../types/api-responses';
import { assertStudyAccessByActor } from '../services/authorization.service';
import { resourceNotFound, invalidState } from '../types/api-errors';
import sequelize from '../database';

/**
 * Get a single study by public_id, verifying org scope and membership.
 */
export async function getStudy(ctx: ApplicationContext, studyPublicId: string): Promise<StudyResource> {
  const study = await resolveStudy(studyPublicId, ctx.organization.id);
  if (!study) throw resourceNotFound('Study');

  await assertStudyAccessByActor(ctx.actor.id, study.id, ctx.organization.id);

  return {
    public_id: study.public_id || String(study.id),
    name: study.name,
    status: study.status || 'active',
    brief_status: study.brief_status || null,
    project_public_id: study.project?.public_id || study.project?.slug || '',
    created_at: study.created_at?.toISOString() || new Date().toISOString(),
  };
}

/**
 * Get evidence sources for a study.
 */
export async function getStudySources(
  ctx: ApplicationContext,
  studyPublicId: string,
): Promise<EvidenceSourceResource[]> {
  const study = await resolveStudy(studyPublicId, ctx.organization.id);
  if (!study) throw resourceNotFound('Study');

  await assertStudyAccessByActor(ctx.actor.id, study.id, ctx.organization.id);

  const EvidenceSourceModel = sequelize.models.EvidenceSource;
  if (!EvidenceSourceModel) return [];

  const sources = await EvidenceSourceModel.findAll({
    where: { project_id: study.project_id },
    order: [['created_at', 'DESC']],
  });

  return sources.map((s: any) => ({
    public_id: s.public_id || String(s.id),
    semantic_key: s.semantic_key,
    source_type: s.source_type || 'unknown',
    status: s.status || 'active',
    project_public_id: study.project?.slug || '',
    created_at: s.created_at?.toISOString() || new Date().toISOString(),
  }));
}

/**
 * Get evidence constructs for a study.
 */
export async function getStudyEvidence(
  ctx: ApplicationContext,
  studyPublicId: string,
): Promise<EvidenceConstructResource[]> {
  const study = await resolveStudy(studyPublicId, ctx.organization.id);
  if (!study) throw resourceNotFound('Study');

  await assertStudyAccessByActor(ctx.actor.id, study.id, ctx.organization.id);

  const EvidenceConstructModel = sequelize.models.EvidenceConstruct;
  if (!EvidenceConstructModel) return [];

  const constructs = await EvidenceConstructModel.findAll({
    where: { project_id: study.project_id },
    order: [['created_at', 'DESC']],
  });

  return constructs.map((c: any) => ({
    public_id: c.public_id || String(c.id),
    semantic_key: c.semantic_key,
    construct_type: c.construct_type || 'unknown',
    label: c.label || null,
    status: c.status || 'active',
    source_public_id: '', // Resolved via source_id FK
    created_at: c.created_at?.toISOString() || new Date().toISOString(),
  }));
}

/**
 * Get artifacts for a study.
 */
export async function getStudyArtifacts(
  ctx: ApplicationContext,
  studyPublicId: string,
): Promise<ArtifactResource[]> {
  const study = await resolveStudy(studyPublicId, ctx.organization.id);
  if (!study) throw resourceNotFound('Study');

  await assertStudyAccessByActor(ctx.actor.id, study.id, ctx.organization.id);

  const ArtifactModel = sequelize.models.ResearchArtifact;
  if (!ArtifactModel) return [];

  const artifacts = await ArtifactModel.findAll({
    where: { study_id: study.id },
    order: [['created_at', 'DESC']],
  });

  return artifacts.map((a: any) => ({
    public_id: a.public_id,
    artifact_type: a.artifact_type,
    title: a.title,
    workflow_status: mapWorkflowStatus(a.status),
    publication_status: a.publication_status || mapPublicationStatus(a.status),
    template_id: a.template_id,
    template_version: a.template_version,
    project_public_id: study.project?.slug || '',
    study_public_id: study.public_id || String(study.id),
    created_at: a.created_at?.toISOString() || new Date().toISOString(),
    updated_at: a.updated_at?.toISOString() || new Date().toISOString(),
  }));
}

// ─── WS-1: Brief, Plan, Cascade Readiness ────────────────────────

/**
 * Resolve study internal IDs for route handlers that need to delegate
 * to application services requiring numeric IDs.
 */
export async function resolveStudyContext(
  ctx: ApplicationContext,
  studyPublicId: string,
): Promise<{ studyId: number; projectId: number; studyName: string }> {
  const study = await resolveStudy(studyPublicId, ctx.organization.id);
  if (!study) throw resourceNotFound('Study');

  await assertStudyAccessByActor(ctx.actor.id, study.id, ctx.organization.id);

  return {
    studyId: study.id,
    projectId: study.project_id,
    studyName: study.name,
  };
}

/**
 * Get brief details for a study — status, approval info, cascade fields.
 */
export async function getStudyBrief(ctx: ApplicationContext, studyPublicId: string) {
  const study = await resolveStudy(studyPublicId, ctx.organization.id);
  if (!study) throw resourceNotFound('Study');

  await assertStudyAccessByActor(ctx.actor.id, study.id, ctx.organization.id);

  // Load cascade variables for the brief
  const StudyVariableModel = sequelize.models.StudyVariable;
  const cascadeFields: Record<string, string | null> = {
    research_objectives: null,
    research_questions: null,
    target_barriers: null,
    methodology_selection: null,
    timeline_preference: null,
    start_date: null,
    participant_approach: null,
    budget: null,
  };

  if (StudyVariableModel) {
    const vars = await StudyVariableModel.findAll({
      where: {
        study_id: study.id,
        variable_key: Object.keys(cascadeFields),
      },
    }) as any[];

    for (const v of vars) {
      const val = v.value;
      // study_variables.value is JSONB — may be string, array, or object
      cascadeFields[v.variable_key] = typeof val === 'string' ? val :
        Array.isArray(val) ? JSON.stringify(val) : val ? String(val) : null;
    }
  }

  // Resolve brief reviewer display name
  let reviewerDisplayName: string | null = null;
  if (study.brief_reviewer_id) {
    const ActorModel = sequelize.models.Actor;
    if (ActorModel) {
      const reviewer = await ActorModel.findOne({
        where: { public_id: study.brief_reviewer_id },
        attributes: ['display_name'],
      }) as { display_name: string | null } | null;
      reviewerDisplayName = reviewer?.display_name || null;
    }
  }

  // Get brief artifact URL
  const ArtifactModel = sequelize.models.ResearchArtifact;
  let briefUrl: string | null = null;
  if (ArtifactModel) {
    const briefArtifact = await ArtifactModel.findOne({
      where: { study_id: study.id, artifact_type: 'research_brief' },
      attributes: ['id'],
      order: [['created_at', 'DESC']],
    }) as any;
    if (briefArtifact) {
      // GitHub URL from study path
      briefUrl = study.link || null;
    }
  }

  return {
    study: {
      public_id: study.public_id || String(study.id),
      name: study.name,
      status: study.status || 'active',
      brief_status: study.brief_status || null,
      project_public_id: study.project?.slug || '',
      created_at: study.created_at?.toISOString() || new Date().toISOString(),
    },
    brief_status: study.brief_status || null,
    brief_approved_at: study.brief_approved_at?.toISOString() || null,
    brief_approved_by: study.brief_approved_by || null,
    brief_change_feedback: study.brief_change_feedback || null,
    brief_reviewer_display_name: reviewerDisplayName,
    brief_url: briefUrl,
    cascade_fields: cascadeFields,
  };
}

/**
 * Get plan details for a study.
 */
export async function getStudyPlan(ctx: ApplicationContext, studyPublicId: string) {
  const study = await resolveStudy(studyPublicId, ctx.organization.id);
  if (!study) throw resourceNotFound('Study');

  await assertStudyAccessByActor(ctx.actor.id, study.id, ctx.organization.id);

  const ResearchPlanModel = sequelize.models.ResearchPlan;
  let planUrl: string | null = null;
  let planCreatedAt: string | null = null;
  if (ResearchPlanModel) {
    const plan = await ResearchPlanModel.findOne({
      where: { study_id: study.id },
      order: [['created_at', 'DESC']],
    }) as any;
    if (plan) {
      planUrl = plan.url || plan.link || null;
      planCreatedAt = plan.created_at?.toISOString() || null;
    }
  }

  // Load inherited context from cascade variables
  const StudyVariableModel = sequelize.models.StudyVariable;
  const inheritedKeys = [
    'research_objectives', 'research_questions', 'target_barriers',
    'methodology_selection', 'timeline_phases', 'participant_approach',
    'compensation', 'deliverables',
  ];
  const inherited: Record<string, string | null> = {};
  for (const k of inheritedKeys) inherited[k] = null;

  if (StudyVariableModel) {
    const vars = await StudyVariableModel.findAll({
      where: { study_id: study.id, variable_key: inheritedKeys },
    }) as any[];
    for (const v of vars) {
      const val = v.value;
      inherited[v.variable_key] = typeof val === 'string' ? val :
        Array.isArray(val) ? JSON.stringify(val) : val ? String(val) : null;
    }
  }

  return {
    study: {
      public_id: study.public_id || String(study.id),
      name: study.name,
      status: study.status || 'active',
      brief_status: study.brief_status || null,
      project_public_id: study.project?.slug || '',
      created_at: study.created_at?.toISOString() || new Date().toISOString(),
    },
    plan_url: planUrl,
    plan_created_at: planCreatedAt,
    inherited_context: inherited,
  };
}

/**
 * Check cascade readiness for plan creation.
 */
export async function getCascadeReadiness(ctx: ApplicationContext, studyPublicId: string) {
  const study = await resolveStudy(studyPublicId, ctx.organization.id);
  if (!study) throw resourceNotFound('Study');

  await assertStudyAccessByActor(ctx.actor.id, study.id, ctx.organization.id);

  const requiredVars = [
    { variable: 'research_objectives', human_label: 'Research objectives', resolution_hint: 'Complete the research brief' },
    { variable: 'research_questions', human_label: 'Research questions', resolution_hint: 'Complete the research brief' },
    { variable: 'target_barriers', human_label: 'Target barriers', resolution_hint: 'Complete the research brief' },
  ];

  const StudyVariableModel = sequelize.models.StudyVariable;
  const missing: Array<{ variable: string; human_label: string; resolution_hint: string }> = [];

  if (StudyVariableModel) {
    const vars = await StudyVariableModel.findAll({
      where: {
        study_id: study.id,
        variable_key: requiredVars.map(v => v.variable),
      },
      attributes: ['variable_key'],
    }) as any[];

    const found = new Set(vars.map((v: any) => v.variable_key));
    for (const req of requiredVars) {
      if (!found.has(req.variable)) missing.push(req);
    }
  } else {
    missing.push(...requiredVars);
  }

  return { ready: missing.length === 0, missing };
}

/**
 * Resubmit a brief after changes were requested.
 *
 * Transitions brief_status from changes_requested → pending_approval.
 * Only the study creator (or project member) can resubmit.
 */
export async function resubmitBrief(
  ctx: ApplicationContext,
  studyPublicId: string,
): Promise<{ new_status: string }> {
  const study = await resolveStudy(studyPublicId, ctx.organization.id);
  if (!study) throw resourceNotFound('Study');

  await assertStudyAccessByActor(ctx.actor.id, study.id, ctx.organization.id);

  if (study.brief_status !== 'changes_requested') {
    throw invalidState(
      study.brief_status === 'approved'
        ? 'Brief has already been approved'
        : 'Brief is not in changes_requested status',
    );
  }

  await study.update({
    brief_status: 'pending_approval',
    brief_change_feedback: null,
  });

  return { new_status: 'pending_approval' };
}

// ─── Helpers ────────────────────────────────────────────────────────

async function resolveStudy(publicIdOrId: string, organizationId: number) {
  const StudyModel = sequelize.models.ResearchStudy;
  const ProjectModel = sequelize.models.Project;

  // Try by public_id first, then by numeric ID
  let study: any = null;
  study = await StudyModel.findOne({
    where: { public_id: publicIdOrId },
    include: [{ model: ProjectModel, as: 'project', attributes: ['id', 'slug', 'organization_id'] }],
  });

  if (!study) {
    const numId = Number(publicIdOrId);
    if (Number.isFinite(numId) && numId > 0) {
      study = await StudyModel.findByPk(numId, {
        include: [{ model: ProjectModel, as: 'project', attributes: ['id', 'slug', 'organization_id'] }],
      });
    }
  }

  if (!study || !study.project) return null;

  // Verify organization scope
  if (study.project.organization_id !== organizationId) return null;

  return study;
}

function mapWorkflowStatus(status: string): string {
  // Map legacy status values to canonical workflow status
  switch (status) {
    case 'pending': return 'generating';
    case 'written': return 'draft';
    case 'failed': return 'draft'; // Failed write doesn't change research status
    default: return status;
  }
}

function mapPublicationStatus(status: string): string {
  // Derive publication status from legacy status
  switch (status) {
    case 'pending': return 'not_published';
    case 'written': return 'published';
    case 'failed': return 'projection_failed';
    default: return 'not_published';
  }
}
