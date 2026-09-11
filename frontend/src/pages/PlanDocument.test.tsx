/**
 * PlanDocument tests — document rendering, edit mode, no approval controls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { PlanDocument } from './PlanDocument';

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useParams: () => ({ studyPublicId: 'study-1' }), useNavigate: () => vi.fn() };
});

const mockPlan = vi.fn();
vi.mock('@/api/queries/useStudy', () => ({
  useStudyPlan: () => mockPlan(),
}));

vi.mock('@/api/mutations/useSaveContent', () => ({
  useSavePlanContent: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function makePlan(overrides: any = {}) {
  return {
    study: { public_id: 'study-1', name: 'Test Study', status: 'active', brief_status: 'approved', project_public_id: 'p1', created_at: '2026-09-01' },
    plan_url: 'https://github.com/org/repo/blob/main/plan.md',
    plan_created_at: '2026-09-10',
    artifact_version: 1,
    inherited_context: {
      research_objectives: JSON.stringify([{ id: 'OBJ-001', objective: 'Test objective' }]),
      research_questions: JSON.stringify([{ id: 'RQ-001', question: 'Test question', priority: 'Primary' }]),
      target_barriers: null, methodology_selection: 'usability_testing',
      timeline_phases: null, participant_approach: '8 Veterans', compensation: null, deliverables: null,
    },
    structured_fields: {
      research_objectives: [{ id: 'OBJ-001', objective: 'Test objective' }],
      research_questions: [{ id: 'RQ-001', question: 'Test question', priority: 'Primary' }],
      target_barriers: [],
    },
    prose_sections: { plan_summary: '<p>Plan summary text</p>' },
    study_metadata: { study_name: 'Test Study', researcher_name: 'Jane Doe', created_at: '2026-09-01' },
    ...overrides,
  };
}

describe('PlanDocument', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders full document with inherited stable IDs', () => {
    mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
    renderWithProviders(<PlanDocument />);
    expect(screen.getByRole('heading', { level: 1, name: 'Research Plan' })).toBeInTheDocument();
    expect(screen.getByText('OBJ-001')).toBeInTheDocument();
    expect(screen.getByText('RQ-001')).toBeInTheDocument();
  });

  it('marks inherited sections as read-only', () => {
    mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
    renderWithProviders(<PlanDocument />);
    const inheritedTags = screen.getAllByText(/Inherited/);
    expect(inheritedTags.length).toBeGreaterThanOrEqual(1);
  });

  it('has no approval controls', () => {
    mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
    renderWithProviders(<PlanDocument />);
    expect(screen.queryByText('Approve brief')).not.toBeInTheDocument();
    expect(screen.queryByText('Submit feedback')).not.toBeInTheDocument();
  });

  it('has Edit button', () => {
    mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
    renderWithProviders(<PlanDocument />);
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('renders GitHub link', () => {
    mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
    renderWithProviders(<PlanDocument />);
    expect(screen.getByText(/View on GitHub/)).toBeInTheDocument();
  });

  it('shows empty state when no plan_url', () => {
    mockPlan.mockReturnValue({ data: makePlan({ plan_url: null }), isLoading: false, error: null });
    renderWithProviders(<PlanDocument />);
    expect(screen.getByText(/No plan yet/)).toBeInTheDocument();
  });

  it('renders no raw JSON', () => {
    mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
    renderWithProviders(<PlanDocument />);
    expect(screen.queryByText('"id"')).not.toBeInTheDocument();
  });

  it('shows Plan tab as active', () => {
    mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
    renderWithProviders(<PlanDocument />);
    const tabs = screen.getAllByRole('tab');
    const planTab = tabs.find(t => t.textContent === 'Research Plan');
    expect(planTab).toHaveAttribute('aria-selected', 'true');
  });
});
