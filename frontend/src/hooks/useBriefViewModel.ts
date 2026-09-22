/**
 * useBriefViewModel — Phase 4
 *
 * Transforms raw Brief API response into a normalized view model.
 *
 * Architecture:
 *   useStudyBrief() → raw API response
 *   → projectBriefToWorkspace()
 *   → BriefViewModel
 *   → React components
 *
 * React components should consume this hook instead of useStudyBrief directly.
 * All derivation logic (Quick Facts, participant counts, etc.) is centralized
 * in the projection layer.
 */

import { useMemo } from 'react';
import { useStudyBrief } from '@/api/queries/useStudy';
import {
  projectBriefToWorkspace,
  type BriefViewModel,
  type BriefProjectionInput,
} from '@qori/artifact-contracts';

export interface UseBriefViewModelResult {
  /** Projected view model (null if loading or error) */
  viewModel: BriefViewModel | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Raw API response (for cases where direct access is needed) */
  rawData: unknown | null;
}

/**
 * Hook that projects Brief API response to a normalized view model.
 *
 * @param studyPublicId - Study public ID to fetch the brief for
 * @returns Projected view model and loading/error states
 */
export function useBriefViewModel(studyPublicId: string): UseBriefViewModelResult {
  const { data: brief, isLoading, error } = useStudyBrief(studyPublicId);

  const viewModel = useMemo(() => {
    if (!brief) return null;

    // Transform raw API response to projection input
    // The API response shape should match BriefProjectionInput
    const input: BriefProjectionInput = {
      study: {
        public_id: studyPublicId,
        name: brief.study?.name || '',
        created_at: brief.study?.created_at,
      },
      brief_status: brief.brief_status,
      brief_reviewer_id: brief.brief_approved_by,
      brief_reviewer_display_name: brief.brief_reviewer_display_name,
      brief_change_feedback: brief.brief_change_feedback,
      brief_approved_at: brief.brief_approved_at,
      brief_url: brief.brief_url,
      prose_sections: brief.prose_sections,
      cascade_fields: brief.cascade_fields || {},
      structured_fields: brief.structured_fields,
      artifact_metadata: (brief as any).artifact_metadata,
    };

    return projectBriefToWorkspace(input);
  }, [brief, studyPublicId]);

  return {
    viewModel,
    isLoading,
    error: error as Error | null,
    rawData: brief,
  };
}
