/**
 * studyStatus.ts — NAV-1c
 *
 * Status derivation helpers for Study Overview.
 * Computes "Needs You" items and lifecycle group statuses from canonical data.
 *
 * Design authority: STUDY_WORKSPACE_NAV_CORRECTION.md §S02
 */

import type { DiscoveryCounts } from '@/components/study/LifecycleRail';

// ─── Types ─────────────────────────────────────────────────────────

export type BriefStatusValue =
  | 'pending_approval'
  | 'changes_requested'
  | 'approved'
  | null;

export interface NeedsYouItem {
  id: string;
  label: string;
  sublabel?: string;
  action: string;
  href: string;
  priority: number; // Lower = higher priority
}

export interface LifecycleGroupStatus {
  group: string;
  status: string;
  statusMuted?: string;
  action?: { label: string; href: string };
}

// ─── Needs You Derivation ──────────────────────────────────────────

/**
 * Derive actionable "Needs You" items from study state.
 * Returns items sorted by priority (highest first), limited to top 3.
 *
 * Priority order:
 * 1. Brief approval (blocking)
 * 2. Discovery review queue
 */
export function deriveNeedsYouItems(
  studyPublicId: string,
  briefStatus: BriefStatusValue,
  discoveryCounts: DiscoveryCounts | undefined,
): NeedsYouItem[] {
  const items: NeedsYouItem[] = [];

  // Brief pending approval
  if (briefStatus === 'pending_approval') {
    items.push({
      id: 'brief-approval',
      label: 'Research brief needs approval',
      action: 'Review',
      href: `/studies/${studyPublicId}/brief`,
      priority: 1,
    });
  }

  // Brief changes requested
  if (briefStatus === 'changes_requested') {
    items.push({
      id: 'brief-changes',
      label: 'Research brief has requested changes',
      action: 'Edit',
      href: `/studies/${studyPublicId}/brief`,
      priority: 1,
    });
  }

  // Discovery review queue
  if (discoveryCounts?.needsReview) {
    const types: Array<{ key: 'desk' | 'stakeholder' | 'survey'; label: string; path: string }> = [
      { key: 'desk', label: 'Desk research', path: '/desk' },
      { key: 'stakeholder', label: 'Stakeholders', path: '/stakeholders' },
      { key: 'survey', label: 'Surveys', path: '/surveys' },
    ];

    for (const type of types) {
      if (discoveryCounts.needsReview[type.key]) {
        items.push({
          id: `discovery-review-${type.key}`,
          label: `${type.label} needs review`,
          sublabel: 'Failed analysis',
          action: 'Review',
          href: `/studies/${studyPublicId}/discovery${type.path}`,
          priority: 2,
        });
      }
    }
  }

  // Sort by priority and return top 3
  return items.sort((a, b) => a.priority - b.priority).slice(0, 3);
}

// ─── Lifecycle Group Status Derivation ─────────────────────────────

/**
 * Derive status for each lifecycle group.
 * Returns one row per group with status line and optional action.
 *
 * Design: STUDY_WORKSPACE_NAV_CORRECTION.md §S02 "Where this study is"
 */
export function deriveLifecycleGroupStatuses(
  studyPublicId: string,
  briefStatus: BriefStatusValue,
  discoveryCounts: DiscoveryCounts | undefined,
): LifecycleGroupStatus[] {
  const groups: LifecycleGroupStatus[] = [];

  // Discovery
  const discoveryStatus = deriveDiscoveryStatus(discoveryCounts);
  groups.push({
    group: 'Discovery',
    status: discoveryStatus.status,
    statusMuted: discoveryStatus.muted,
    action: discoveryStatus.hasContent
      ? { label: 'View evidence', href: `/studies/${studyPublicId}/discovery` }
      : { label: 'Add evidence', href: `/studies/${studyPublicId}/discovery` },
  });

  // Planning
  const planningStatus = derivePlanningStatus(studyPublicId, briefStatus);
  groups.push(planningStatus);

  // Fieldwork - placeholder
  groups.push({
    group: 'Fieldwork',
    status: 'Not started',
  });

  // Analysis - placeholder
  groups.push({
    group: 'Analysis',
    status: 'Not started',
  });

  // Outputs - placeholder
  groups.push({
    group: 'Outputs',
    status: 'Not started',
  });

  return groups;
}

function deriveDiscoveryStatus(discoveryCounts: DiscoveryCounts | undefined): {
  status: string;
  muted?: string;
  hasContent: boolean;
} {
  if (!discoveryCounts) {
    return { status: 'No evidence yet', hasContent: false };
  }

  const { desk, stakeholder, survey, needsReview } = discoveryCounts;
  const total = (desk ?? 0) + (stakeholder ?? 0) + (survey ?? 0);

  if (total === 0) {
    return { status: 'No evidence yet', hasContent: false };
  }

  const parts: string[] = [];
  if (desk && desk > 0) parts.push(`${desk} desk`);
  if (stakeholder && stakeholder > 0) parts.push(`${stakeholder} stakeholder`);
  if (survey && survey > 0) parts.push(`${survey} survey`);

  const reviewCount = [
    needsReview?.desk,
    needsReview?.stakeholder,
    needsReview?.survey,
  ].filter(Boolean).length;

  return {
    status: `${total} artifact${total === 1 ? '' : 's'}`,
    muted: reviewCount > 0 ? `${reviewCount} needs review` : parts.join(', '),
    hasContent: true,
  };
}

function derivePlanningStatus(
  studyPublicId: string,
  briefStatus: BriefStatusValue,
): LifecycleGroupStatus {
  if (!briefStatus) {
    return {
      group: 'Planning',
      status: 'Brief not started',
      action: { label: 'Create brief', href: `/studies/${studyPublicId}/brief/new` },
    };
  }

  if (briefStatus === 'pending_approval') {
    return {
      group: 'Planning',
      status: 'Brief pending approval',
      action: { label: 'Review brief', href: `/studies/${studyPublicId}/brief` },
    };
  }

  if (briefStatus === 'changes_requested') {
    return {
      group: 'Planning',
      status: 'Brief has changes requested',
      action: { label: 'Edit brief', href: `/studies/${studyPublicId}/brief` },
    };
  }

  if (briefStatus === 'approved') {
    // Brief approved, check if plan exists (for now, always suggest creating plan)
    return {
      group: 'Planning',
      status: 'Brief approved',
      statusMuted: 'Plan not started',
      action: { label: 'Create plan', href: `/studies/${studyPublicId}/plan/new` },
    };
  }

  // Fallback for unknown status
  return {
    group: 'Planning',
    status: 'In progress',
    action: { label: 'View brief', href: `/studies/${studyPublicId}/brief` },
  };
}
