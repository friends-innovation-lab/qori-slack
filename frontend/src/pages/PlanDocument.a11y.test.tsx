/**
 * CC-8: PlanDocument accessibility tests — view, edit, empty states.
 * SPEC §12.14: vitest-axe reporting zero violations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { PlanDocument } from './PlanDocument';
import { axe } from 'vitest-axe';

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => ({ studyPublicId: 'study-1' }),
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/studies/study-1/plan', search: '', hash: '' }),
    Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [key: string]: unknown }) => (
      <a href={to} {...rest}>{children}</a>
    ),
    NavLink: ({ children, to, className, ...rest }: { children: React.ReactNode; to: string; className?: ((args: { isActive: boolean }) => string) | string; [key: string]: unknown }) => (
      <a href={to} className={typeof className === 'function' ? className({ isActive: false }) : className} {...rest}>{children}</a>
    ),
  };
});

const mockPlan = vi.fn();
vi.mock('@/api/queries/useStudy', () => ({
  useStudyPlan: () => mockPlan(),
}));

vi.mock('@/api/mutations/useSaveContent', () => ({
  useSavePlanContent: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function makePlan(overrides: Record<string, unknown> = {}) {
  return {
    study: {
      public_id: 'study-1',
      name: 'Test Study',
      status: 'active',
      brief_status: 'approved',
      project_public_id: 'p1',
      created_at: '2026-09-01',
    },
    plan_url: 'https://github.com/org/repo/blob/main/plan.md',
    plan_created_at: '2026-09-10T10:00:00.000Z',
    artifact_version: 1,
    artifact_public_id: 'art-123',
    artifact_metadata: {
      created_at: '2026-09-10T10:00:00.000Z',
      template_id: 'research_plan',
      template_version: 'v7.2',
      content_version: 1,
      path: 'test-study/02-plan/research-plan.md',
      model: 'claude-sonnet-4-6',
    },
    inherited_context: {
      research_objectives: JSON.stringify([
        { id: 'OBJ-001', objective: 'Test objective' },
      ]),
      research_questions: JSON.stringify([
        { id: 'RQ-001', question: 'Test question', priority: 'Primary' },
      ]),
      target_barriers: JSON.stringify([
        { id: 'TB-001', barrier: 'Test barrier' },
      ]),
      methodology_selection: 'usability_testing',
      timeline_phases: JSON.stringify([
        { phase: 'Planning', dates: 'Sep 14 – Sep 18', duration: '1 week' },
        { phase: 'Fieldwork', dates: 'Sep 21 – Oct 2', duration: '2 weeks' },
      ]),
      participant_approach: '8 Veterans across segments',
      session_format: '60-minute remote sessions',
      session_duration: '60 minutes',
      compensation: '$50 per session',
      deliverables: JSON.stringify([
        { deliverable_name: 'Research readout', format: 'Presentation' },
      ]),
      budget: '$400',
    },
    structured_fields: {
      research_objectives: [{ id: 'OBJ-001', objective: 'Test objective' }],
      research_questions: [{ id: 'RQ-001', question: 'Test question', priority: 'Primary' }],
      target_barriers: [{ id: 'TB-001', barrier: 'Test barrier' }],
    },
    prose_sections: {
      plan_summary: 'Plan summary text for testing.',
      plan_background: 'Background context for the study.',
      plan_method_approach: 'We will conduct moderated usability sessions.',
      plan_session_format: '60-minute remote sessions via video conference.',
      plan_data_collection: 'Think-aloud protocol with screen recording.',
      plan_participants_prose: 'Recruit 8 Veterans across 3 segments.',
      plan_deliverables: '- Research readout\n- Session summaries',
      plan_risks: JSON.stringify([
        { risk: 'Participant no-shows', likelihood: 'Medium', mitigation: 'Over-recruit by 2' },
      ]),
      plan_commitments: JSON.stringify([
        { commitment: 'Objectives', address: 'All OBJ IDs carried through' },
      ]),
    },
    study_metadata: {
      study_name: 'Test Study',
      researcher_name: 'Jane Doe',
      study_path: 'test-study',
      created_at: '2026-09-01',
    },
    ...overrides,
  };
}

describe('PlanDocument accessibility', () => {
  beforeEach(() => vi.clearAllMocks());

  it('has no serious or critical axe violations (view mode)', async () => {
    mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
    const { container } = renderWithProviders(<PlanDocument />);
    const results = await axe(container);
    const serious = results.violations.filter(
      (v: any) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious).toHaveLength(0);
  });

  it('has no serious or critical axe violations (edit mode)', async () => {
    mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
    const { container } = renderWithProviders(<PlanDocument />);

    // Enter edit mode
    const editButton = screen.getByRole('button', { name: 'Edit' });
    fireEvent.click(editButton);

    const results = await axe(container);
    const serious = results.violations.filter(
      (v: any) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious).toHaveLength(0);
  });

  it('has no serious or critical axe violations (empty state)', async () => {
    mockPlan.mockReturnValue({
      data: makePlan({ plan_url: null }),
      isLoading: false,
      error: null,
    });
    const { container } = renderWithProviders(<PlanDocument />);
    const results = await axe(container);
    const serious = results.violations.filter(
      (v: any) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious).toHaveLength(0);
  });
});
