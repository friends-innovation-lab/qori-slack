/**
 * PlanDetail page tests — rendering, GitHub link, no approval controls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { PlanDetail } from './PlanDetail';
import type { StudyPlanResource } from '@qori/api-contracts';

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => ({ studyPublicId: 'study-uuid-1' }),
  };
});

const mockUseStudyPlan = vi.fn();
vi.mock('@/api/queries/useStudy', () => ({
  useStudyPlan: () => mockUseStudyPlan(),
}));

function makePlan(overrides: Partial<StudyPlanResource> = {}): StudyPlanResource {
  return {
    study: {
      public_id: 'study-uuid-1',
      name: 'Claims Usability',
      status: 'active',
      brief_status: 'approved',
      project_public_id: 'p1',
      created_at: new Date().toISOString(),
    },
    plan_url: 'https://github.com/org/repo/blob/main/study/plan.md',
    plan_created_at: '2026-09-10T00:00:00.000Z',
    inherited_context: {
      research_objectives: 'Understand scheduling pain points',
      research_questions: null,
      target_barriers: null,
      methodology_selection: 'usability_testing',
      timeline_phases: '4 weeks',
      participant_approach: '8 Veterans',
      compensation: '$50 per session',
      deliverables: null,
    },
    ...overrides,
  };
}

describe('PlanDetail page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders plan with GitHub link', () => {
    mockUseStudyPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
    renderWithProviders(<PlanDetail />);
    expect(screen.getByText(/View full plan on GitHub/)).toBeInTheDocument();
  });

  it('renders inherited context fields', () => {
    mockUseStudyPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
    renderWithProviders(<PlanDetail />);
    expect(screen.getByText('Understand scheduling pain points')).toBeInTheDocument();
    expect(screen.getByText('usability testing')).toBeInTheDocument();
    expect(screen.getByText('8 Veterans')).toBeInTheDocument();
  });

  it('shows empty state when no plan_url', () => {
    mockUseStudyPlan.mockReturnValue({
      data: makePlan({ plan_url: null }),
      isLoading: false,
      error: null,
    });
    renderWithProviders(<PlanDetail />);
    expect(screen.getByText(/No plan yet/)).toBeInTheDocument();
  });

  it('has no approval controls', () => {
    mockUseStudyPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
    renderWithProviders(<PlanDetail />);
    expect(screen.queryByText(/Approve/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Request changes/i)).not.toBeInTheDocument();
  });

  it('shows error state on fetch failure', () => {
    mockUseStudyPlan.mockReturnValue({ data: undefined, isLoading: false, error: new Error('fail') });
    renderWithProviders(<PlanDetail />);
    expect(screen.getByText(/Could not load plan/)).toBeInTheDocument();
  });
});
