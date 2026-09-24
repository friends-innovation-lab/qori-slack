/**
 * lifecycle.ts — Study lifecycle computation utilities.
 * Extracted from StudyOverview.tsx for reuse in Brief/Plan pages (DDR-03).
 */

import type { LifecycleNode } from '@qori/api-contracts';

/**
 * Compute lifecycle nodes from study brief status.
 * This is a simplified version — backend should provide this eventually.
 */
export function computeLifecycleNodes(
  briefStatus: string | null,
): LifecycleNode[] {
  const hasBrief = !!briefStatus;
  const briefApproved = briefStatus === 'approved';

  return [
    {
      stage: 'overview',
      label: 'Overview',
      state: 'current',
      unlock_hint: null,
      count: 0,
      is_current: true,
    },
    {
      stage: 'brief',
      label: 'Brief',
      state: hasBrief ? (briefApproved ? 'free' : 'suggested') : 'suggested',
      unlock_hint: null,
      count: hasBrief ? 1 : 0,
      is_current: false,
    },
    {
      stage: 'plan',
      label: 'Plan',
      state: briefApproved ? 'suggested' : 'locked',
      unlock_hint: briefApproved ? null : 'Brief must be approved first',
      count: 0,
      is_current: false,
    },
    {
      stage: 'sources',
      label: 'Sources',
      state: 'locked',
      unlock_hint: 'Add sources after plan',
      count: 0,
      is_current: false,
    },
    {
      stage: 'evidence',
      label: 'Evidence',
      state: 'locked',
      unlock_hint: 'Analyze sessions first',
      count: 0,
      is_current: false,
    },
    {
      stage: 'findings',
      label: 'Findings',
      state: 'locked',
      unlock_hint: 'Run synthesis first',
      count: 0,
      is_current: false,
    },
    {
      stage: 'outputs',
      label: 'Outputs',
      state: 'locked',
      unlock_hint: 'Generate readout first',
      count: 0,
      is_current: false,
    },
  ];
}

/**
 * Stage routes mapping — used by LifecycleRail to construct links.
 */
export const stageRoutes: Record<string, string> = {
  overview: '',
  brief: '/brief',
  plan: '/plan',
  sources: '/sources',
  evidence: '/evidence',
  findings: '/findings',
  outputs: '/outputs',
};
