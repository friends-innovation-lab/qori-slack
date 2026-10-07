/**
 * WS-1: Study Overview tests — lifecycle rail rendering, navigation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { StudyOverview } from './StudyOverview';

// Mock route params
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => ({ studyPublicId: 'study-uuid-1' }),
  };
});

// Mock queries
const mockUseStudy = vi.fn();
const mockUseStudyBrief = vi.fn();
vi.mock('@/api/queries/useStudy', () => ({
  useStudy: () => mockUseStudy(),
  useStudyBrief: () => mockUseStudyBrief(),
  useCascadeReadiness: () => ({ data: null, isLoading: false, error: null }),
}));

// NAV-1a: Mock workspace context (provides nav state)
vi.mock('@/components/study/workspace', async () => {
  const actual = await vi.importActual('@/components/study/workspace');
  return {
    ...actual,
    useStudyWorkspace: () => ({
      studyPublicId: 'study-uuid-1',
      projectPublicId: 'proj-1',
      studyName: 'Test Study',
      briefStatus: null,
      lifecycleNodes: [],
      discoveryCounts: undefined,
      navOpen: false,
      openNav: vi.fn(),
      closeNav: vi.fn(),
      toggleNav: vi.fn(),
      isLoading: false,
      error: null,
    }),
  };
});

describe('StudyOverview page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state', () => {
    mockUseStudy.mockReturnValue({ data: undefined, isLoading: true, error: null });
    mockUseStudyBrief.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderWithProviders(<StudyOverview />);
    // Should not crash
  });

  // NAV-1a: Error states for study loading are now handled by StudyWorkspaceLayout
  // The component renders normally when workspace context provides study data
  it('renders study name from workspace context', () => {
    mockUseStudy.mockReturnValue({
      data: {
        public_id: 'study-uuid-1',
        name: 'Claims Usability',
        status: 'active',
        brief_status: 'approved',
        project_public_id: 'p1',
        created_at: new Date().toISOString(),
      },
      isLoading: false,
      error: null,
    });
    mockUseStudyBrief.mockReturnValue({
      data: {
        study: {
          public_id: 'study-uuid-1',
          name: 'Claims Usability',
          status: 'active',
          brief_status: 'approved',
          project_public_id: 'p1',
          created_at: new Date().toISOString(),
        },
        brief_status: 'approved',
        brief_approved_at: '2026-09-01T00:00:00.000Z',
        brief_approved_by: 'a1',
        brief_change_feedback: null,
        brief_reviewer_display_name: null,
        brief_url: null,
        cascade_fields: {
          research_objectives: null, research_questions: null, target_barriers: null,
          methodology_selection: null, timeline_preference: null, timeline_phases: null,
          start_date: null, decision_deadline: null, participant_approach: null,
          participant_segments: null, recruitment_sources: null, session_format: null,
          session_duration: null, budget: null, requestor_name: null, discovery_sources: null,
        },
      },
      isLoading: false,
      error: null,
    });
    renderWithProviders(<StudyOverview />);
    // NAV-1a: Study name comes from workspace context mock ("Test Study")
    expect(screen.getAllByText('Test Study').length).toBeGreaterThan(0);
    // NAV-1a: Lifecycle rail is now owned by StudyWorkspaceLayout, not StudyOverview
    // The component renders the study overview content without the rail
  });
});
