/**
 * Project Application Service — PLAT-3
 *
 * Organization-scoped project operations.
 * All queries are filtered by the actor's organization.
 */

import type { ApplicationContext } from '../types/application-context';
import type { ProjectResource, StudyResource, GovernanceResource } from '../types/api-responses';
import { listProjectsByOrg, getProjectByIdAndOrg, getProjectStudiesByOrg, createProjectFromName } from '../services/project.service';
import { isProjectMemberByActor, addProjectMember, setProjectStakeholder } from '../services/authorization.service';
import { scaffoldProject } from '../services/scaffolding.service';
import { resourceNotFound, authorizationDenied, resourceConflict } from '../types/api-errors';
import { addResearchStudyWithRoles } from '../services/research_study.service';
import sequelize from '../database';

// ─── Input Types ──────────────────────────────────────────────────

export interface CreateProjectInput {
  name: string;
  problem_statement: string;
  description?: string;
  approver_actor_public_id?: string;
}

// ─── Create Project ───────────────────────────────────────────────

/**
 * Create a new research project — the adapter-neutral business operation.
 *
 * Extracted from projectStartHandler.ts so both Slack and Workspace
 * adapters call the same operation. Slack-specific post-processing
 * (channel creation, DMs) stays in the Slack handler.
 */
export async function createProject(
  ctx: ApplicationContext,
  input: CreateProjectInput,
): Promise<ProjectResource> {
  // 1. Create project record
  const project = await createProjectFromName(input.name, {
    description: input.description,
    problem_statement: input.problem_statement,
    created_by: ctx.actor.publicId,
    status: 'active',
    organization_id: ctx.organization.id,
  });

  // 2. Add creator as owner — dual-write: PLAT-2 actor-based + legacy Slack-based
  const ProjectMembershipModel = sequelize.models.ProjectMembership;
  if (ProjectMembershipModel) {
    await ProjectMembershipModel.findOrCreate({
      where: { project_id: project.id, actor_id: ctx.actor.id },
      defaults: { project_id: project.id, actor_id: ctx.actor.id, role: 'owner' },
    });
  }
  // Legacy project_members for Slack handler compatibility (userId = actor publicId)
  await addProjectMember(project.id, ctx.actor.publicId, 'creator', 'owner');

  // 3. Set stakeholder if provided
  if (input.approver_actor_public_id) {
    const ActorModel = sequelize.models.Actor;
    if (ActorModel) {
      const approver = await ActorModel.findOne({
        where: { public_id: input.approver_actor_public_id },
      }) as { id: number; public_id: string } | null;
      if (approver) {
        if (ProjectMembershipModel) {
          await ProjectMembershipModel.findOrCreate({
            where: { project_id: project.id, actor_id: approver.id },
            defaults: { project_id: project.id, actor_id: approver.id, role: 'researcher' },
          });
        }
        await addProjectMember(project.id, approver.public_id, 'explicit', 'member');
        await setProjectStakeholder(project.id, approver.public_id);
      }
    }
  }

  // 4. Scaffold GitHub folder (non-blocking)
  try {
    await scaffoldProject(
      project.slug,
      project.name,
      ctx.actor.displayName || 'Researcher',
    );
  } catch (err) {
    console.warn('[PROJECT] GitHub scaffold failed (non-blocking):', err instanceof Error ? err.message : err);
  }

  return mapProjectResource(project, ctx.organization.publicId);
}

// ─── Create Study ──────────────────────────────────────────────────

export interface CreateStudyInput {
  name: string;
}

/**
 * Create a new research study within a project.
 * Returns a minimal StudyResource so the frontend can navigate to the brief form.
 */
export async function createStudyForProject(
  ctx: ApplicationContext,
  projectPublicId: string,
  input: CreateStudyInput,
): Promise<StudyResource> {
  const project = await getProjectBySlugOrId(projectPublicId, ctx.organization.id) as any;
  if (!project) throw resourceNotFound('Project');

  const isMember = await isProjectMemberByActor(ctx.actor.id, project.id);
  if (!isMember) throw authorizationDenied('Not a project member');

  // Check for existing study with same name in this project
  const existingStudies = await getProjectStudiesByOrg(project.id, ctx.organization.id);
  const duplicate = existingStudies.find(
    (s: any) => s.name.toLowerCase() === input.name.trim().toLowerCase(),
  );
  if (duplicate) {
    throw resourceConflict('A study with this name already exists in this project.');
  }

  const actorName = ctx.actor.displayName || 'Researcher';
  const channelName = `study-${input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`;

  const study = await addResearchStudyWithRoles({
    name: input.name.trim(),
    project_id: project.id,
    created_by: ctx.actor.publicId,
    researcher_name: actorName,
    researcher_email: '', // Workspace flow doesn't require email
    channel_name: channelName,
    status: 'active',
  });

  return mapStudyResource(study as any, project.public_id || project.slug);
}

/**
 * List all projects the actor has access to within their organization.
 */
export async function listProjects(ctx: ApplicationContext): Promise<ProjectResource[]> {
  const projects = await listProjectsByOrg(ctx.organization.id);

  // Filter to projects the actor is a member of
  const accessible: ProjectResource[] = [];
  for (const p of projects) {
    const isMember = await isProjectMemberByActor(ctx.actor.id, p.id);
    if (isMember) {
      accessible.push(mapProjectResource(p, ctx.organization.publicId));
    }
  }

  return accessible;
}

/**
 * Get a single project by slug or public_id, verifying org scope and membership.
 */
export async function getProject(ctx: ApplicationContext, slugOrPublicId: string): Promise<ProjectResource> {
  const project = await getProjectBySlugOrId(slugOrPublicId, ctx.organization.id) as any;
  if (!project) throw resourceNotFound('Project');

  const isMember = await isProjectMemberByActor(ctx.actor.id, project.id);
  if (!isMember) throw authorizationDenied('Not a project member');

  return mapProjectResource(project, ctx.organization.publicId);
}

/**
 * Get studies for a project.
 */
export async function getProjectStudies(
  ctx: ApplicationContext,
  projectSlug: string,
): Promise<StudyResource[]> {
  const project = await getProjectBySlugOrId(projectSlug, ctx.organization.id) as any;
  if (!project) throw resourceNotFound('Project');

  const isMember = await isProjectMemberByActor(ctx.actor.id, project.id);
  if (!isMember) throw authorizationDenied('Not a project member');

  const studies = await getProjectStudiesByOrg(project.id, ctx.organization.id);
  return studies.map(s => mapStudyResource(s as any, projectSlug));
}

/**
 * Get governance summary for a project.
 */
export async function getProjectGovernance(
  ctx: ApplicationContext,
  projectSlug: string,
): Promise<GovernanceResource> {
  const project = await getProjectBySlugOrId(projectSlug, ctx.organization.id) as any;
  if (!project) throw resourceNotFound('Project');

  const isMember = await isProjectMemberByActor(ctx.actor.id, project.id);
  if (!isMember) throw authorizationDenied('Not a project member');

  // Count governance state
  const RecordsHoldModel = sequelize.models.RecordsHold;
  const RecordsAssignmentModel = sequelize.models.RecordsManagementAssignment;

  const [holdsCount, assignmentsCount] = await Promise.all([
    RecordsHoldModel
      ? RecordsHoldModel.count({ where: { project_id: project.id, status: 'active' } })
      : 0,
    RecordsAssignmentModel
      ? RecordsAssignmentModel.count({ where: { project_id: project.id } })
      : 0,
  ]);

  return {
    project_public_id: project.public_id || projectSlug,
    active_holds_count: holdsCount,
    pending_dispositions_count: 0, // Requires eligibility evaluation — deferred
    records_assignments_count: assignmentsCount,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────

async function getProjectBySlugOrId(slugOrId: string, orgId: number) {
  const { Project: ProjectModel } = sequelize.models;
  const numericId = Number(slugOrId);
  if (Number.isFinite(numericId) && numericId > 0) {
    return getProjectByIdAndOrg(numericId, orgId);
  }
  // Try public_id (UUID) first, then fall back to slug
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidPattern.test(slugOrId)) {
    const byPublicId = await ProjectModel.findOne({ where: { public_id: slugOrId, organization_id: orgId } });
    if (byPublicId) return byPublicId;
  }
  return ProjectModel.findOne({ where: { slug: slugOrId, organization_id: orgId } });
}

function mapProjectResource(p: any, orgPublicId: string): ProjectResource {
  return {
    public_id: p.public_id || p.slug,
    slug: p.slug,
    name: p.name,
    description: p.description || null,
    problem_statement: p.problem_statement || null,
    status: p.status || 'active',
    organization_public_id: orgPublicId,
    team_public_id: null, // Team public_id resolution deferred
    created_at: p.created_at?.toISOString() || new Date().toISOString(),
  };
}

function mapStudyResource(s: any, projectSlug: string): StudyResource {
  return {
    public_id: s.public_id || String(s.id),
    name: s.name,
    status: s.status || 'active',
    project_public_id: projectSlug,
    created_at: s.created_at?.toISOString() || new Date().toISOString(),
  };
}
