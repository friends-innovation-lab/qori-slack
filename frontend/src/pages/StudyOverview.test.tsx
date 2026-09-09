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

  it('shows error state on failure', () => {
    mockUseStudy.mockReturnValue({ data: undefined, isLoading: false, error: new Error('fail') });
    mockUseStudyBrief.mockReturnValue({ data: undefined, isLoading: false, error: null });
    renderWithProviders(<StudyOverview />);
    expect(screen.getByText(/Could not load/i)).toBeInTheDocument();
  });

  it('renders study name and lifecycle rail when data loaded', () => {
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
        cascade_fields: {},
      },
      isLoading: false,
      error: null,
    });
    renderWithProviders(<StudyOverview />);
    // Study name may appear in multiple places (header, breadcrumb, etc.)
    expect(screen.getAllByText('Claims Usability').length).toBeGreaterThan(0);
    // Lifecycle rail should have Brief stage
    expect(screen.getByText('Brief')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
  });
});
