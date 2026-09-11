/**
 * WS-1: Brief Detail page tests — approval, request changes, status display.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { BriefDetail } from './BriefDetail';
import type { StudyBriefResource } from '@qori/api-contracts';

// Mock route params
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => ({ studyPublicId: 'study-uuid-1' }),
  };
});

// Mock auth
vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({
    status: 'authenticated' as const,
    me: {
      actor: { public_id: 'a1', display_name: 'Alex Rivera' },
      organization: { public_id: 'o1', slug: 'org', name: 'Org' },
      authentication_provider: 'session',
      memberships: [],
    },
    logout: vi.fn(),
    refresh: vi.fn(),
  }),
}));

// Mock study brief query
const mockUseStudyBrief = vi.fn();
vi.mock('@/api/queries/useStudy', () => ({
  useStudy: () => ({ data: null, isLoading: false, error: null }),
  useStudyBrief: () => mockUseStudyBrief(),
  useCascadeReadiness: () => ({ data: null, isLoading: false, error: null }),
}));

// Mock approval mutations
const mockApprove = vi.fn();
const mockRequestChanges = vi.fn();
vi.mock('@/api/mutations/useApproveBrief', () => ({
  useApproveBrief: () => ({ mutateAsync: mockApprove, isPending: false }),
  useRequestChanges: () => ({ mutateAsync: mockRequestChanges, isPending: false }),
}));

function makeBrief(overrides: Partial<StudyBriefResource> = {}): StudyBriefResource {
  return {
    study: {
      public_id: 'study-uuid-1',
      name: 'Claims Usability',
      status: 'active',
      brief_status: 'pending_approval',
      project_public_id: 'p1',
      created_at: new Date().toISOString(),
    },
    brief_status: 'pending_approval',
    brief_approved_at: null,
    brief_approved_by: null,
    brief_change_feedback: null,
    brief_reviewer_display_name: null,
    brief_url: null,
    cascade_fields: {
      research_objectives: 'Understand scheduling pain points',
      research_questions: 'How do Veterans find appointments?',
      target_barriers: null,
      methodology_selection: 'usability_testing',
      timeline_preference: null,
      start_date: null,
      participant_approach: null,
      budget: null,
    },
    ...overrides,
  };
}

describe('BriefDetail page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton when data is loading', () => {
    mockUseStudyBrief.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderWithProviders(<BriefDetail />);
    // Should not crash while loading
  });

  it('shows error state on fetch failure', () => {
    mockUseStudyBrief.mockReturnValue({ data: undefined, isLoading: false, error: new Error('fail') });
    renderWithProviders(<BriefDetail />);
    expect(screen.getByText(/Could not load/i)).toBeInTheDocument();
  });

  it('shows study name and pending_approval status', async () => {
    mockUseStudyBrief.mockReturnValue({
      data: makeBrief(),
      isLoading: false,
      error: null,
    });
    renderWithProviders(<BriefDetail />);
    expect(screen.getByText('Claims Usability')).toBeInTheDocument();
  });

  it('shows approved state correctly', () => {
    mockUseStudyBrief.mockReturnValue({
      data: makeBrief({
        brief_status: 'approved',
        study: {
          public_id: 'study-uuid-1',
          name: 'Claims Usability',
          status: 'active',
          brief_status: 'approved',
          project_public_id: 'p1',
          created_at: new Date().toISOString(),
        },
        brief_approved_at: '2026-09-01T00:00:00.000Z',
        brief_approved_by: 'reviewer-1',
      }),
      isLoading: false,
      error: null,
    });
    renderWithProviders(<BriefDetail />);
    expect(screen.getByText('Claims Usability')).toBeInTheDocument();
  });

  it('shows cascade fields from brief data', () => {
    mockUseStudyBrief.mockReturnValue({
      data: makeBrief(),
      isLoading: false,
      error: null,
    });
    renderWithProviders(<BriefDetail />);
    expect(screen.getByText(/Understand scheduling pain points/)).toBeInTheDocument();
    expect(screen.getByText(/How do Veterans find appointments/)).toBeInTheDocument();
  });

  it('shows all populated cascade fields', () => {
    mockUseStudyBrief.mockReturnValue({
      data: makeBrief({
        cascade_fields: {
          research_objectives: 'Test objectives',
          research_questions: 'Test questions',
          target_barriers: 'Access barriers',
          methodology_selection: 'user_interviews',
          timeline_preference: null,
          start_date: '2026-10-01',
          participant_approach: '8 Veterans',
          budget: '$800',
        },
      }),
      isLoading: false,
      error: null,
    });
    renderWithProviders(<BriefDetail />);
    expect(screen.getByText('Test objectives')).toBeInTheDocument();
    expect(screen.getByText('Test questions')).toBeInTheDocument();
    expect(screen.getByText('Access barriers')).toBeInTheDocument();
    expect(screen.getByText('user interviews')).toBeInTheDocument();
    expect(screen.getByText('8 Veterans')).toBeInTheDocument();
    expect(screen.getByText('$800')).toBeInTheDocument();
  });

  it('shows empty note when no cascade content exists', () => {
    mockUseStudyBrief.mockReturnValue({
      data: makeBrief({
        cascade_fields: {
          research_objectives: null,
          research_questions: null,
          target_barriers: null,
          methodology_selection: null,
          timeline_preference: null,
          start_date: null,
          participant_approach: null,
          budget: null,
        },
      }),
      isLoading: false,
      error: null,
    });
    renderWithProviders(<BriefDetail />);
    expect(screen.getByText(/Brief content will appear/)).toBeInTheDocument();
  });

  it('shows GitHub link when brief_url exists', () => {
    mockUseStudyBrief.mockReturnValue({
      data: makeBrief({ brief_url: 'https://github.com/org/repo/blob/main/study/brief.md' }),
      isLoading: false,
      error: null,
    });
    renderWithProviders(<BriefDetail />);
    expect(screen.getByText(/View full brief on GitHub/)).toBeInTheDocument();
  });

  it('shows "Revise brief" action when changes_requested', () => {
    mockUseStudyBrief.mockReturnValue({
      data: makeBrief({
        brief_status: 'changes_requested',
        study: {
          public_id: 'study-uuid-1', name: 'Claims Usability', status: 'active',
          brief_status: 'changes_requested', project_public_id: 'p1',
          created_at: new Date().toISOString(),
        },
        brief_change_feedback: 'Please expand the participant criteria.',
      }),
      isLoading: false,
      error: null,
    });
    renderWithProviders(<BriefDetail />);
    expect(screen.getByText('Revise brief')).toBeInTheDocument();
    expect(screen.getByText(/Please expand the participant criteria/)).toBeInTheDocument();
  });

  it('shows reviewer name when changes_requested and reviewer known', () => {
    mockUseStudyBrief.mockReturnValue({
      data: makeBrief({
        brief_status: 'changes_requested',
        study: {
          public_id: 'study-uuid-1', name: 'Claims Usability', status: 'active',
          brief_status: 'changes_requested', project_public_id: 'p1',
          created_at: new Date().toISOString(),
        },
        brief_change_feedback: 'Needs more detail on timeline.',
        brief_reviewer_display_name: 'Jordan Lee',
      }),
      isLoading: false,
      error: null,
    });
    renderWithProviders(<BriefDetail />);
    expect(screen.getByText(/Jordan Lee/)).toBeInTheDocument();
  });

  it('"Revise brief" links to the brief form', () => {
    mockUseStudyBrief.mockReturnValue({
      data: makeBrief({
        brief_status: 'changes_requested',
        study: {
          public_id: 'study-uuid-1', name: 'Claims Usability', status: 'active',
          brief_status: 'changes_requested', project_public_id: 'p1',
          created_at: new Date().toISOString(),
        },
        brief_change_feedback: 'Fix scope.',
      }),
      isLoading: false,
      error: null,
    });
    renderWithProviders(<BriefDetail />);
    const link = screen.getByText('Revise brief').closest('a');
    expect(link).toHaveAttribute('href', '/studies/study-uuid-1/brief/new');
  });

  it('does not show approval bar when changes_requested', () => {
    mockUseStudyBrief.mockReturnValue({
      data: makeBrief({
        brief_status: 'changes_requested',
        study: {
          public_id: 'study-uuid-1', name: 'Claims Usability', status: 'active',
          brief_status: 'changes_requested', project_public_id: 'p1',
          created_at: new Date().toISOString(),
        },
      }),
      isLoading: false,
      error: null,
    });
    renderWithProviders(<BriefDetail />);
    expect(screen.queryByText('Approve brief')).not.toBeInTheDocument();
  });
});
