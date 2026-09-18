/**
 * BriefDocument tests — document rendering, edit mode, review states.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { BriefDocument } from './BriefDocument';

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useParams: () => ({ studyPublicId: 'study-1' }), useNavigate: () => vi.fn() };
});

vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({
    me: { actor: { display_name: 'Test', public_id: 'a1' }, organization: { name: 'Org', public_id: 'o1' }, memberships: [] },
  }),
}));

const mockBrief = vi.fn();
vi.mock('@/api/queries/useStudy', () => ({
  useStudyBrief: () => mockBrief(),
}));

vi.mock('@/api/mutations/useApproveBrief', () => ({
  useApproveBrief: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRequestChanges: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/api/mutations/useSaveContent', () => ({
  useSaveBriefContent: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function makeBrief(overrides: any = {}) {
  return {
    study: { public_id: 'study-1', name: 'Test Study', status: 'active', brief_status: 'approved', project_public_id: 'p1', created_at: '2026-09-01' },
    brief_status: 'approved',
    brief_approved_at: '2026-09-10',
    brief_approved_by: null,
    brief_change_feedback: null,
    brief_reviewer_display_name: null,
    brief_url: 'https://github.com/org/repo/blob/main/brief.md',
    cascade_fields: {
      // Structured data stored as JSON strings (parsed by component)
      research_objectives: JSON.stringify([{ id: 'OBJ-001', objective: 'Understand scheduling' }]),
      research_questions: JSON.stringify([{ id: 'RQ-001', question: 'How do users find?', priority: 'Primary' }]),
      target_barriers: JSON.stringify([{ id: 'TB-001', barrier: 'Complex navigation', source: 'Desk research' }]),
      methodology_selection: 'usability_testing',
      timeline_preference: null,
      timeline_phases: null,
      start_date: '2026-10-01',
      decision_deadline: null,
      decision_deadline_context: null,
      participant_approach: '8 Veterans',
      participant_segments: null,
      recruitment_sources: null,
      session_format: null,
      session_duration: null,
      budget: '$800',
      budget_purpose: null,
      requestor_name: 'Jane Doe',
      discovery_sources: null,
    },
    ...overrides,
  };
}

describe('BriefDocument', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders full document with stable IDs', () => {
    mockBrief.mockReturnValue({ data: makeBrief(), isLoading: false, error: null });
    renderWithProviders(<BriefDocument />);
    expect(screen.getByText('Research Brief')).toBeInTheDocument();
    expect(screen.getByText('OBJ-001')).toBeInTheDocument();
    expect(screen.getByText('RQ-001')).toBeInTheDocument();
    expect(screen.getByText('TB-001')).toBeInTheDocument();
  });

  it('renders GitHub link', () => {
    mockBrief.mockReturnValue({ data: makeBrief(), isLoading: false, error: null });
    renderWithProviders(<BriefDocument />);
    expect(screen.getByText(/View on GitHub/)).toBeInTheDocument();
  });

  it('shows approved status', () => {
    mockBrief.mockReturnValue({ data: makeBrief(), isLoading: false, error: null });
    renderWithProviders(<BriefDocument />);
    expect(screen.getByText('Brief approved')).toBeInTheDocument();
  });

  it('shows pending approval with reviewer', () => {
    mockBrief.mockReturnValue({
      data: makeBrief({ brief_status: 'pending_approval', brief_reviewer_display_name: 'Alex' }),
      isLoading: false, error: null,
    });
    renderWithProviders(<BriefDocument />);
    // Multiple elements may display "Pending approval" (pill badge + alert title + review rail)
    const pendingElements = screen.getAllByText('Pending approval');
    expect(pendingElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Alex/)).toBeInTheDocument();
  });

  it('shows changes requested with feedback and revise action', () => {
    mockBrief.mockReturnValue({
      data: makeBrief({ brief_status: 'changes_requested', brief_change_feedback: 'Fix scope' }),
      isLoading: false, error: null,
    });
    renderWithProviders(<BriefDocument />);
    // Multiple elements may display "Changes requested" and feedback
    const changesElements = screen.getAllByText(/Changes requested/);
    expect(changesElements.length).toBeGreaterThanOrEqual(1);
    const feedbackElements = screen.getAllByText('Fix scope');
    expect(feedbackElements.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Revise')).toBeInTheDocument();
  });

  it('has Edit button in view mode', () => {
    mockBrief.mockReturnValue({ data: makeBrief(), isLoading: false, error: null });
    renderWithProviders(<BriefDocument />);
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('renders no raw JSON for structured fields', () => {
    mockBrief.mockReturnValue({ data: makeBrief(), isLoading: false, error: null });
    renderWithProviders(<BriefDocument />);
    expect(screen.queryByText('"id"')).not.toBeInTheDocument();
    expect(screen.queryByText('"objective"')).not.toBeInTheDocument();
  });

  it('shows artifact tabs with Brief selected', () => {
    mockBrief.mockReturnValue({ data: makeBrief(), isLoading: false, error: null });
    renderWithProviders(<BriefDocument />);
    const tabs = screen.getAllByRole('tab');
    const briefTab = tabs.find(t => t.textContent === 'Brief');
    expect(briefTab).toHaveAttribute('aria-selected', 'true');
  });

  it('shows error state on fetch failure', () => {
    mockBrief.mockReturnValue({ data: undefined, isLoading: false, error: new Error('Could not load brief') });
    renderWithProviders(<BriefDocument />);
    expect(screen.getByText(/Could not load brief/)).toBeInTheDocument();
  });

  // ─── Visual Parity Regression Tests ───────────────────────────────────────

  describe('visual parity (design reference)', () => {
    it('review sidebar is visible by default for approved briefs', () => {
      mockBrief.mockReturnValue({
        data: makeBrief({ brief_status: 'approved' }),
        isLoading: false, error: null,
      });
      renderWithProviders(<BriefDocument />);
      // Close review button should be present (rail is open by default)
      // May have multiple: one in header, one in rail
      const closeButtons = screen.getAllByRole('button', { name: 'Close review' });
      expect(closeButtons.length).toBeGreaterThanOrEqual(1);
      // Rail content should be visible (at least one ASIDE with aria-label="Review")
      const railLabels = screen.queryAllByLabelText('Review');
      expect(railLabels.filter(el => el.tagName === 'ASIDE').length).toBeGreaterThanOrEqual(1);
    });

    it('participants Quick Fact shows concise count/segments, never full prose', () => {
      mockBrief.mockReturnValue({
        data: makeBrief({
          cascade_fields: {
            ...makeBrief().cascade_fields,
            participant_approach: 'This is a long prose description',
            // participant_segments stored as JSON string
            participant_segments: JSON.stringify([
              { segment: 'Active users', count: 4, rationale: 'Main group' },
              { segment: 'First-time users', count: 2, rationale: 'New users' },
              { segment: 'Power users', count: 2, rationale: 'Expert group' },
            ]),
          },
        }),
        isLoading: false, error: null,
      });
      renderWithProviders(<BriefDocument />);
      // Should show concise participant count in Quick Facts (reference uses "residents")
      expect(screen.getByText('8 residents')).toBeInTheDocument();
      expect(screen.getByText('3 segments')).toBeInTheDocument();
      // Quick Facts Participants label should exist
      const participantsLabels = screen.getAllByText('Participants');
      expect(participantsLabels.length).toBeGreaterThanOrEqual(1);
    });

    it('method Approach appears exactly once — no duplication', () => {
      mockBrief.mockReturnValue({
        data: makeBrief({
          cascade_fields: { ...makeBrief().cascade_fields, methodology_selection: 'usability_testing' },
        }),
        isLoading: false, error: null,
      });
      renderWithProviders(<BriefDocument />);
      // The "Approach" label (as a bold term) should appear exactly once in the Method system block
      const approachLabels = screen.getAllByText('Approach');
      expect(approachLabels.length).toBe(1);
    });

    it('renders all five Quick Facts when data exists', () => {
      mockBrief.mockReturnValue({
        data: makeBrief({
          cascade_fields: {
            ...makeBrief().cascade_fields,
            methodology_selection: 'usability_testing',
            session_format: 'Remote',
            session_duration: '60 minutes',
            decision_deadline: 'Nov 2, 2026',
            budget: '$800',
            timeline_phases: JSON.stringify([
              { phase: 'Planning', dates: 'Sep 14 – Sep 25, 2026', duration: '2 weeks' },
              { phase: 'Fieldwork', dates: 'Sep 28 – Oct 9, 2026', duration: '2 weeks' },
            ]),
            participant_segments: JSON.stringify([
              { segment: 'Active users', count: 4, rationale: 'Main group' },
              { segment: 'First-time users', count: 4, rationale: 'New users' },
            ]),
          },
        }),
        isLoading: false, error: null,
      });
      renderWithProviders(<BriefDocument />);
      // All five Quick Fact labels should be present (use getAllByText since labels may appear in headings too)
      const methodLabels = screen.getAllByText('Method');
      const participantsLabels = screen.getAllByText('Participants');
      const timelineLabels = screen.getAllByText('Timeline');
      const deadlineLabels = screen.getAllByText('Decision deadline');
      const budgetLabels = screen.getAllByText('Budget');
      // Each Quick Fact label should appear at least once
      expect(methodLabels.length).toBeGreaterThanOrEqual(1);
      expect(participantsLabels.length).toBeGreaterThanOrEqual(1);
      expect(timelineLabels.length).toBeGreaterThanOrEqual(1);
      expect(deadlineLabels.length).toBeGreaterThanOrEqual(1);
      expect(budgetLabels.length).toBeGreaterThanOrEqual(1);
    });
  });
});
