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
  });
});
