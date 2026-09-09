/**
 * Queue Application Service — WS-1
 *
 * Returns actionable items for the current actor. UX-3A scope:
 * brief approvals where the actor is the designated reviewer.
 */

import type { ApplicationContext } from '../types/application-context';
import { isProjectMemberByActor } from '../services/authorization.service';
import sequelize from '../database';

export interface QueueItem {
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

function computeAgeCategory(createdAt: Date): 'fresh' | 'aging' | 'overdue' {
  const ageMs = Date.now() - createdAt.getTime();
  const days = ageMs / (1000 * 60 * 60 * 24);
  if (days > 5) return 'overdue';
  if (days > 2) return 'aging';
  return 'fresh';
}

/**
 * Get actionable queue items for the current actor.
 *
 * UX-3A scope: brief approvals where actor is reviewer.
 * Future: PII reviews, findings reviews, publication failures.
 */
export async function getQueueItems(ctx: ApplicationContext): Promise<QueueItem[]> {
  const ResearchStudyModel = sequelize.models.ResearchStudy;
  const ProjectModel = sequelize.models.Project;

  // Get actor's accessible projects
  const projects = await ProjectModel.findAll({
    where: { organization_id: ctx.organization.id },
    attributes: ['id'],
  }) as any[];

  const accessibleProjectIds: number[] = [];
  for (const p of projects) {
    const isMember = await isProjectMemberByActor(ctx.actor.id, p.id);
    if (isMember) accessibleProjectIds.push(p.id);
  }

  if (accessibleProjectIds.length === 0) return [];

  // Find studies with briefs pending the current actor's approval
  const studies = await ResearchStudyModel.findAll({
    where: {
      project_id: accessibleProjectIds,
      brief_status: 'pending_approval',
      brief_reviewer_id: ctx.actor.publicId,
    },
    order: [['updated_at', 'ASC']],
  }) as any[];

  return studies.map(s => ({
    id: `brief-approval-${s.public_id || s.id}`,
    kind: 'brief_approval',
    statement: `Brief for "${s.name}" needs your approval`,
    study_public_id: s.public_id || String(s.id),
    study_name: s.name,
    action_label: 'Review',
    action_route: `/studies/${s.public_id || s.id}/brief`,
    created_at: s.updated_at?.toISOString() || new Date().toISOString(),
    age_category: computeAgeCategory(s.updated_at || new Date()),
  }));
}
