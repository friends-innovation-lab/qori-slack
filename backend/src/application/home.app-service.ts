/**
 * Home Application Service — WS-1
 *
 * Aggregates data for the Workspace home screen: queue preview,
 * active studies, and recent activity.
 */

import type { ApplicationContext } from '../types/application-context';
import { isProjectMemberByActor } from '../services/authorization.service';
import sequelize from '../database';

export interface HomeData {
  greeting_name: string;
  queue_preview: QueuePreviewItem[];
  active_studies: ActiveStudy[];
  recent_activity: ActivityEvent[];
}

export interface QueuePreviewItem {
  id: string;
  kind: string;
  statement: string;
  study_public_id: string | null;
  study_name: string | null;
  action_label: string;
  action_route: string;
  created_at: string;
  age_category: 'fresh' | 'aging' | 'overdue';
}

export interface ActiveStudy {
  public_id: string;
  name: string;
  project_name: string;
  project_public_id: string;
  status: string;
  brief_status: string | null;
  next_action: string | null;
  next_action_route: string | null;
  updated_at: string;
}

export interface ActivityEvent {
  id: string;
  description: string;
  study_public_id: string | null;
  study_name: string | null;
  created_at: string;
}

function computeAgeCategory(createdAt: Date): 'fresh' | 'aging' | 'overdue' {
  const ageMs = Date.now() - createdAt.getTime();
  const days = ageMs / (1000 * 60 * 60 * 24);
  if (days > 5) return 'overdue';
  if (days > 2) return 'aging';
  return 'fresh';
}

function computeNextAction(study: any): { action: string | null; route: string | null } {
  if (!study.brief_status) {
    return { action: 'Create brief', route: `/studies/${study.public_id || study.id}/brief/new` };
  }
  if (study.brief_status === 'pending_approval') {
    return { action: 'Brief awaiting approval', route: `/studies/${study.public_id || study.id}/brief` };
  }
  if (study.brief_status === 'changes_requested') {
    return { action: 'Revise brief', route: `/studies/${study.public_id || study.id}/brief` };
  }
  if (study.brief_status === 'approved') {
    return { action: 'Create research plan', route: `/studies/${study.public_id || study.id}/plan/new` };
  }
  return { action: null, route: null };
}

export async function getHomeData(ctx: ApplicationContext): Promise<HomeData> {
  const ResearchStudyModel = sequelize.models.ResearchStudy;
  const ProjectModel = sequelize.models.Project;

  // Get actor's studies via project membership
  const projects = await ProjectModel.findAll({
    where: { organization_id: ctx.organization.id },
    attributes: ['id', 'name', 'slug', 'public_id'],
  }) as any[];

  const accessibleProjects: any[] = [];
  for (const p of projects) {
    const isMember = await isProjectMemberByActor(ctx.actor.id, p.id);
    if (isMember) accessibleProjects.push(p);
  }

  const projectIds = accessibleProjects.map(p => p.id);
  const projectMap = new Map(accessibleProjects.map(p => [p.id, p]));

  // Active studies
  const studies = projectIds.length > 0
    ? await ResearchStudyModel.findAll({
        where: { project_id: projectIds },
        order: [['updated_at', 'DESC']],
        limit: 10,
      }) as any[]
    : [];

  const activeStudies: ActiveStudy[] = studies.map(s => {
    const project = projectMap.get(s.project_id);
    const { action, route } = computeNextAction(s);
    return {
      public_id: s.public_id || String(s.id),
      name: s.name,
      project_name: project?.name || '',
      project_public_id: project?.public_id || project?.slug || '',
      status: s.status || 'active',
      brief_status: s.brief_status || null,
      next_action: action,
      next_action_route: route,
      updated_at: s.updated_at?.toISOString() || new Date().toISOString(),
    };
  });

  // Queue preview — briefs pending approval where actor is the approver
  const queuePreview: QueuePreviewItem[] = [];
  for (const s of studies) {
    if (s.brief_status === 'pending_approval' && s.brief_reviewer_id) {
      // Check if the current actor is the reviewer
      // brief_reviewer_id may be a Slack user ID or actor public_id
      const isReviewer = s.brief_reviewer_id === ctx.actor.publicId;
      if (isReviewer) {
        queuePreview.push({
          id: `brief-approval-${s.public_id || s.id}`,
          kind: 'brief_approval',
          statement: `Brief for "${s.name}" needs your approval`,
          study_public_id: s.public_id || String(s.id),
          study_name: s.name,
          action_label: 'Review',
          action_route: `/studies/${s.public_id || s.id}/brief`,
          created_at: s.updated_at?.toISOString() || new Date().toISOString(),
          age_category: computeAgeCategory(s.updated_at || new Date()),
        });
      }
    }
  }

  // Recent activity — study status changes (simplified for v1)
  const StudyStatusModel = sequelize.models.StudyStatus;
  let recentActivity: ActivityEvent[] = [];
  if (StudyStatusModel && projectIds.length > 0) {
    const statuses = await StudyStatusModel.findAll({
      order: [['created_at', 'DESC']],
      limit: 10,
      include: [{
        model: ResearchStudyModel,
        as: 'study',
        attributes: ['id', 'name', 'public_id', 'project_id'],
        where: { project_id: projectIds },
        required: true,
      }],
    }) as any[];

    recentActivity = statuses.map(ss => ({
      id: String(ss.id),
      description: `${ss.status} — ${ss.study?.name || 'Unknown study'}`,
      study_public_id: ss.study?.public_id || String(ss.study?.id),
      study_name: ss.study?.name || null,
      created_at: ss.created_at?.toISOString() || new Date().toISOString(),
    }));
  }

  return {
    greeting_name: ctx.actor.displayName || 'Researcher',
    queue_preview: queuePreview.slice(0, 3),
    active_studies: activeStudies,
    recent_activity: recentActivity,
  };
}
