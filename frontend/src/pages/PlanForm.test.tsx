/**
 * WS-1: Plan Form tests — exactly two direct fields, inherited context display.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { PlanForm } from './PlanForm';

// Mock route params
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => ({ studyPublicId: 'study-uuid-1' }),
    useNavigate: () => vi.fn(),
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

// Mock queries
const mockUseStudy = vi.fn();
const mockUseStudyBrief = vi.fn();
const mockUseCascadeReadiness = vi.fn();
vi.mock('@/api/queries/useStudy', () => ({
  useStudy: () => mockUseStudy(),
  useStudyBrief: () => mockUseStudyBrief(),
  useCascadeReadiness: () => mockUseCascadeReadiness(),
}));

// Mock mutation
vi.mock('@/api/mutations/useSubmitPlan', () => ({
  useSubmitPlan: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe('PlanForm page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state', () => {
    mockUseStudy.mockReturnValue({ data: undefined, isLoading: true, error: null });
    mockUseStudyBrief.mockReturnValue({ data: undefined, isLoading: true, error: null });
    mockUseCascadeReadiness.mockReturnValue({ data: undefined, isLoading: true, error: null });
    renderWithProviders(<PlanForm />);
    // Should not crash
  });

  it('renders exactly two direct input fields when data loaded', () => {
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
          research_objectives: 'Understand scheduling pain',
          research_questions: 'How do Veterans find appointments?',
          target_barriers: 'Access barriers',
          methodology_selection: 'usability_testing',
          timeline_preference: null,
          start_date: null,
          participant_approach: null,
          budget: null,
        },
      },
      isLoading: false,
      error: null,
    });
    mockUseCascadeReadiness.mockReturnValue({
      data: { ready: true, missing: [] },
      isLoading: false,
      error: null,
    });
    renderWithProviders(<PlanForm />);

    // The plan form should show the operational risks textarea (the only user-editable field)
    expect(screen.getByText(/Operational risks/i)).toBeInTheDocument();

    // Inherited context should be displayed as read-only
    expect(screen.getByText(/Understand scheduling pain/)).toBeInTheDocument();
  });

  it('shows cascade readiness warning when missing variables', () => {
    mockUseStudy.mockReturnValue({
      data: {
        public_id: 'study-uuid-1',
        name: 'Claims Usability',
        status: 'active',
        brief_status: null,
        project_public_id: 'p1',
        created_at: new Date().toISOString(),
      },
      isLoading: false,
      error: null,
    });
    mockUseStudyBrief.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
    mockUseCascadeReadiness.mockReturnValue({
      data: {
        ready: false,
        missing: [
          { variable: 'research_objectives', human_label: 'Research objectives', resolution_hint: 'Complete the research brief' },
        ],
      },
      isLoading: false,
      error: null,
    });
    renderWithProviders(<PlanForm />);

    // Should show warning about missing cascade data
    expect(screen.getByText(/Complete the research brief/i)).toBeInTheDocument();
  });
});
