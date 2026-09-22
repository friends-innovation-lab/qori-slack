/**
 * usePlanViewModel — Phase 4
 *
 * Transforms raw Plan API response into a normalized view model.
 *
 * Architecture:
 *   useStudyPlan() → raw API response
 *   → projectPlanToWorkspace()
 *   → PlanViewModel
 *   → React components
 *
 * React components should consume this hook instead of useStudyPlan directly.
 * All derivation logic (Quick Facts, timeline summaries, etc.) is centralized
 * in the projection layer.
 */

import { useMemo } from 'react';
import { useStudyPlan } from '@/api/queries/useStudy';
import {
  projectPlanToWorkspace,
  type PlanViewModel,
  type PlanProjectionInput,
} from '@qori/artifact-contracts';

export interface UsePlanViewModelResult {
  /** Projected view model (null if loading or error) */
  viewModel: PlanViewModel | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Whether plan exists (has URL) */
  exists: boolean;
  /** Raw API response (for cases where direct access is needed) */
  rawData: unknown | null;
}

/**
 * Hook that projects Plan API response to a normalized view model.
 *
 * @param studyPublicId - Study public ID to fetch the plan for
 * @returns Projected view model and loading/error states
 */
export function usePlanViewModel(studyPublicId: string): UsePlanViewModelResult {
  const { data: plan, isLoading, error } = useStudyPlan(studyPublicId);

  const viewModel = useMemo(() => {
    if (!plan || !plan.plan_url) return null;

    // Transform raw API response to projection input
    const input: PlanProjectionInput = {
      study: {
        public_id: studyPublicId,
        name: plan.study?.name || '',
        created_at: plan.study?.created_at,
      },
      plan_url: plan.plan_url,
      plan_created_at: plan.plan_created_at,
      prose_sections: (plan as any).prose_sections,
      inherited_context: plan.inherited_context || {},
      structured_fields: (plan as any).structured_fields,
      study_metadata: (plan as any).study_metadata,
      artifact_metadata: (plan as any).artifact_metadata,
      artifact_version: (plan as any).artifact_version,
    };

    return projectPlanToWorkspace(input);
  }, [plan, studyPublicId]);

  const exists = !!plan?.plan_url;

  return {
    viewModel,
    isLoading,
    error: error as Error | null,
    exists,
    rawData: plan,
  };
}
