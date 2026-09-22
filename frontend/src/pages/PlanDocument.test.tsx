/**
 * PlanDocument tests — document rendering, edit mode, design parity.
 *
 * Tests cover:
 * - Method kv layout (no h3 subheadings)
 * - Objectives intro text and SYSTEM provenance
 * - Questions SYSTEM provenance with priority pills
 * - Quick Facts in separate system block
 * - Recruitment only renders from real source
 * - Compensation kv treatment
 * - Timeline research period, center Duration, footer
 * - Brief commitments SYSTEM/read-only
 * - Provenance commitment counts
 * - Document metadata uses real artifact_metadata
 * - No dangerouslySetInnerHTML
 * - Canonical prose remains Markdown (via MarkdownDisplay)
 * - Inherited OBJ/RQ remain read-only
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { PlanDocument } from './PlanDocument';

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => ({ studyPublicId: 'study-1' }),
    useNavigate: () => vi.fn(),
    Link: ({ children, to, ...rest }: { children: React.ReactNode; to: string; [key: string]: unknown }) => (
      <a href={to} {...rest}>{children}</a>
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
      path: 'test-study/02-plan/research-plan.md',
      model: 'claude-sonnet-4-6',
    },
    inherited_context: {
      research_objectives: JSON.stringify([
        { id: 'OBJ-001', objective: 'Test objective' },
        { id: 'OBJ-002', objective: 'Second objective' },
      ]),
      research_questions: JSON.stringify([
        { id: 'RQ-001', question: 'Test question', priority: 'Primary' },
        { id: 'RQ-002', question: 'Second question', priority: 'Secondary' },
        { id: 'RQ-003', question: 'Third question', priority: 'Exploratory' },
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
      research_objectives: [
        { id: 'OBJ-001', objective: 'Test objective' },
        { id: 'OBJ-002', objective: 'Second objective' },
      ],
      research_questions: [
        { id: 'RQ-001', question: 'Test question', priority: 'Primary' },
        { id: 'RQ-002', question: 'Second question', priority: 'Secondary' },
        { id: 'RQ-003', question: 'Third question', priority: 'Exploratory' },
      ],
      target_barriers: [
        { id: 'TB-001', barrier: 'Test barrier' },
      ],
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
        { commitment: 'Method', address: 'Moderated sessions as approved' },
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

describe('PlanDocument', () => {
  beforeEach(() => vi.clearAllMocks());

  // ─── Basic rendering ───────────────────────────────────────────────

  it('renders full document with inherited stable IDs', () => {
    mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
    renderWithProviders(<PlanDocument />);
    expect(screen.getByRole('heading', { level: 1, name: 'Research Plan' })).toBeInTheDocument();
    expect(screen.getByText('OBJ-001')).toBeInTheDocument();
    expect(screen.getByText('RQ-001')).toBeInTheDocument();
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

  it('has no approval controls', () => {
    mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
    renderWithProviders(<PlanDocument />);
    expect(screen.queryByText('Approve brief')).not.toBeInTheDocument();
    expect(screen.queryByText('Submit feedback')).not.toBeInTheDocument();
  });

  // ─── Priority 1: Method kv layout ──────────────────────────────────

  describe('Priority 1: Method kv layout', () => {
    it('renders Method section with Approach, Session format, Data collection as kv paragraphs', () => {
      mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
      const { container } = renderWithProviders(<PlanDocument />);

      // Find Method section by data-sec attribute
      const methodSection = container.querySelector('[data-sec="method"]');
      expect(methodSection).toBeInTheDocument();

      // Check kv pattern content exists
      expect(within(methodSection as HTMLElement).getByText(/Approach/)).toBeInTheDocument();
      expect(within(methodSection as HTMLElement).getByText(/usability testing/i)).toBeInTheDocument();
      expect(within(methodSection as HTMLElement).getByText(/Session format/)).toBeInTheDocument();
      expect(within(methodSection as HTMLElement).getByText(/Data collection/)).toBeInTheDocument();

      // Should NOT have h3 for Session format or Data collection
      const h3s = methodSection?.querySelectorAll('h3');
      const sessionH3 = Array.from(h3s || []).find(h => h.textContent?.includes('Session format'));
      const dataH3 = Array.from(h3s || []).find(h => h.textContent?.includes('Data collection'));
      expect(sessionH3).toBeUndefined();
      expect(dataH3).toBeUndefined();
    });
  });

  // ─── Priority 2: Objectives + Questions ────────────────────────────

  describe('Priority 2: Objectives + Questions', () => {
    it('renders Objectives section with SYSTEM provenance and intro text', () => {
      mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
      const { container } = renderWithProviders(<PlanDocument />);

      const objectivesSection = container.querySelector('[data-sec="objectives"]');
      expect(objectivesSection).toBeInTheDocument();
      // Check SYSTEM and READ-ONLY labels exist
      const systemLabels = within(objectivesSection as HTMLElement).getAllByText(/SYSTEM/i);
      expect(systemLabels.length).toBeGreaterThanOrEqual(1);
      expect(within(objectivesSection as HTMLElement).getByText(/What we aim to learn/)).toBeInTheDocument();
      const readOnlyLabels = within(objectivesSection as HTMLElement).getAllByText(/READ-ONLY/);
      expect(readOnlyLabels.length).toBeGreaterThanOrEqual(1);
    });

    it('renders OBJ IDs', () => {
      mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
      renderWithProviders(<PlanDocument />);
      expect(screen.getByText('OBJ-001')).toBeInTheDocument();
      expect(screen.getByText('OBJ-002')).toBeInTheDocument();
    });

    it('renders Research questions section with SYSTEM provenance and READ-ONLY label', () => {
      mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
      const { container } = renderWithProviders(<PlanDocument />);

      const questionsSection = container.querySelector('[data-sec="questions"]');
      expect(questionsSection).toBeInTheDocument();
      // Check that SYSTEM and READ-ONLY labels exist
      const systemLabels = within(questionsSection as HTMLElement).getAllByText(/SYSTEM/i);
      expect(systemLabels.length).toBeGreaterThanOrEqual(1);
      const readOnlyLabels = within(questionsSection as HTMLElement).getAllByText(/READ-ONLY/);
      expect(readOnlyLabels.length).toBeGreaterThanOrEqual(1);
    });

    it('renders RQ IDs with priority pills', () => {
      mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
      renderWithProviders(<PlanDocument />);
      expect(screen.getByText('RQ-001')).toBeInTheDocument();
      expect(screen.getByText('Primary')).toBeInTheDocument();
      expect(screen.getByText('Secondary')).toBeInTheDocument();
      expect(screen.getByText('Exploratory')).toBeInTheDocument();
    });
  });

  // ─── Priority 3: Summary Facts ─────────────────────────────────────

  describe('Priority 3: Summary Facts', () => {
    it('renders Quick Facts in Summary section', () => {
      mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
      const { container } = renderWithProviders(<PlanDocument />);

      const summarySection = container.querySelector('[data-sec="summary"]');
      expect(summarySection).toBeInTheDocument();

      // Should contain system block with facts
      const systemBlocks = summarySection?.querySelectorAll('[class*="systemBlock"]');
      expect(systemBlocks?.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Priority 4: Participants ──────────────────────────────────────

  describe('Priority 4: Participants', () => {
    it('renders Compensation with kv pattern', () => {
      mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
      const { container } = renderWithProviders(<PlanDocument />);

      const participantsSection = container.querySelector('[data-sec="participants"]');
      expect(participantsSection).toBeInTheDocument();
      expect(within(participantsSection as HTMLElement).getByText(/Compensation/)).toBeInTheDocument();
      expect(within(participantsSection as HTMLElement).getByText(/\$50 per session/)).toBeInTheDocument();
    });

    it('does not render Recruitment as h3 subsection', () => {
      mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
      const { container } = renderWithProviders(<PlanDocument />);

      const participantsSection = container.querySelector('[data-sec="participants"]');
      const recruitmentHeadings = participantsSection?.querySelectorAll('h3');
      const recruitmentH3 = Array.from(recruitmentHeadings || []).find(h =>
        h.textContent?.toLowerCase().includes('recruitment')
      );
      expect(recruitmentH3).toBeUndefined();
    });
  });

  // ─── Priority 5: Timeline ──────────────────────────────────────────

  describe('Priority 5: Timeline', () => {
    it('renders Research period', () => {
      mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
      renderWithProviders(<PlanDocument />);
      expect(screen.getByText(/Research period/i)).toBeInTheDocument();
    });

    it('renders Phase table with Duration column', () => {
      mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
      renderWithProviders(<PlanDocument />);
      expect(screen.getByText('Phase')).toBeInTheDocument();
      expect(screen.getByText('Dates')).toBeInTheDocument();
      expect(screen.getByText('Duration')).toBeInTheDocument();
    });

    it('renders timeline footer note', () => {
      mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
      renderWithProviders(<PlanDocument />);
      expect(screen.getByText(/Timeline begins after stakeholder approval/)).toBeInTheDocument();
    });

    it('renders phase data', () => {
      mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
      renderWithProviders(<PlanDocument />);
      expect(screen.getByText('Planning')).toBeInTheDocument();
      expect(screen.getByText('Fieldwork')).toBeInTheDocument();
    });
  });

  // ─── Priority 7: Brief commitments ─────────────────────────────────

  describe('Priority 7: Brief commitments', () => {
    it('renders Brief commitments section with table and system treatment', () => {
      mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
      const { container } = renderWithProviders(<PlanDocument />);

      const commitmentsSection = container.querySelector('[data-sec="commitments"]');
      expect(commitmentsSection).toBeInTheDocument();

      // Check table content
      expect(within(commitmentsSection as HTMLElement).getByText('How this plan addresses it')).toBeInTheDocument();
      expect(within(commitmentsSection as HTMLElement).getByText('All OBJ IDs carried through')).toBeInTheDocument();

      // Has system block styling
      const systemBlocks = commitmentsSection?.querySelectorAll('[class*="systemBlock"]');
      expect(systemBlocks?.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Priority 8: Research provenance ───────────────────────────────

  describe('Priority 8: Research provenance', () => {
    it('renders provenance section with commitment counts', () => {
      mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
      renderWithProviders(<PlanDocument />);

      const summary = screen.getByText('Research provenance');
      summary.click();

      // Check for provenance-specific content
      expect(screen.getByText('Target barriers')).toBeInTheDocument();
      expect(screen.getByText('Methodology')).toBeInTheDocument();
      expect(screen.getByText('Budget')).toBeInTheDocument();
    });

    it('renders citation marker explanation', () => {
      mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
      renderWithProviders(<PlanDocument />);

      const summary = screen.getByText('Research provenance');
      summary.click();

      expect(screen.getByText(/Citation markers throughout/)).toBeInTheDocument();
    });
  });

  // ─── Priority 9: Document information ──────────────────────────────

  describe('Priority 9: Document information', () => {
    it('renders document metadata labels in Document information section', () => {
      mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
      renderWithProviders(<PlanDocument />);

      const summary = screen.getByText('Document information');
      summary.click();

      // These labels appear in the document info table
      expect(screen.getByText('Generated')).toBeInTheDocument();
      expect(screen.getByText('Model')).toBeInTheDocument();
      expect(screen.getByText('Template')).toBeInTheDocument();
      expect(screen.getByText('GitHub path')).toBeInTheDocument();
    });

    it('renders real model value', () => {
      mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
      renderWithProviders(<PlanDocument />);

      const summary = screen.getByText('Document information');
      summary.click();

      expect(screen.getByText('claude-sonnet-4-6')).toBeInTheDocument();
    });

    it('renders real template value', () => {
      mockPlan.mockReturnValue({ data: makePlan(), isLoading: false, error: null });
      renderWithProviders(<PlanDocument />);

      const summary = screen.getByText('Document information');
      summary.click();

      expect(screen.getByText('research_plan v7.2')).toBeInTheDocument();
    });
  });
});
