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
    artifact_version: 1,
    cascade_fields: {
      research_objectives: null, research_questions: null, target_barriers: null,
      methodology_selection: 'usability_testing', timeline_preference: null, timeline_phases: null,
      start_date: '2026-10-01', decision_deadline: null, participant_approach: '8 Veterans',
      participant_segments: null, recruitment_sources: null, session_format: null,
      session_duration: null, budget: '$800', requestor_name: null, discovery_sources: null,
    },
    structured_fields: {
      research_objectives: [{ id: 'OBJ-001', objective: 'Understand scheduling' }],
      research_questions: [{ id: 'RQ-001', question: 'How do users find?', priority: 'Primary' }],
      target_barriers: [{ id: 'TB-001', barrier: 'Complex navigation', source: 'Desk research' }],
    },
    prose_sections: { summary: '<p>Test summary prose</p>' },
    study_metadata: { study_name: 'Test Study', researcher_name: 'Jane Doe', created_at: '2026-09-01' },
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

  it('renders prose sections from artifact_sections', () => {
    mockBrief.mockReturnValue({ data: makeBrief(), isLoading: false, error: null });
    renderWithProviders(<BriefDocument />);
    expect(screen.getByText('Test summary prose')).toBeInTheDocument();
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
    expect(screen.getByText('Pending approval')).toBeInTheDocument();
    expect(screen.getByText(/Alex/)).toBeInTheDocument();
  });

  it('shows changes requested with feedback and revise action', () => {
    mockBrief.mockReturnValue({
      data: makeBrief({ brief_status: 'changes_requested', brief_change_feedback: 'Fix scope' }),
      isLoading: false, error: null,
    });
    renderWithProviders(<BriefDocument />);
    // Multiple elements may display the feedback (main alert + review rail)
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
    mockBrief.mockReturnValue({ data: undefined, isLoading: false, error: new Error('fail') });
    renderWithProviders(<BriefDocument />);
    expect(screen.getByText(/Could not load brief/)).toBeInTheDocument();
  });

  // ─── Visual Parity Regression Tests ───────────────────────────────────────

  describe('visual parity (design reference)', () => {
    it('review rail is closed by default — no rail content visible until Review clicked', () => {
      mockBrief.mockReturnValue({
        data: makeBrief({ brief_status: 'approved' }),
        isLoading: false, error: null,
      });
      renderWithProviders(<BriefDocument />);
      // Review button should be present
      expect(screen.getByRole('button', { name: 'Review' })).toBeInTheDocument();
      // Rail content should NOT be visible (rail is closed by default)
      const railLabels = screen.queryAllByLabelText('Review');
      // The aside with aria-label="Review" should not exist when rail is closed
      expect(railLabels.filter(el => el.tagName === 'ASIDE').length).toBe(0);
    });

    it('participants Quick Fact shows concise count/segments, never full prose', () => {
      mockBrief.mockReturnValue({
        data: makeBrief({
          cascade_fields: {
            ...makeBrief().cascade_fields,
            participant_approach: 'This is a long prose description',
          },
          structured_fields: {
            ...makeBrief().structured_fields,
            participant_segments: [
              { segment: 'Active users', count: 4, rationale: 'Main group' },
              { segment: 'First-time users', count: 2, rationale: 'New users' },
              { segment: 'Power users', count: 2, rationale: 'Expert group' },
            ],
          },
        }),
        isLoading: false, error: null,
      });
      renderWithProviders(<BriefDocument />);
      // Should show concise participant count in Quick Facts
      expect(screen.getByText('8 participants')).toBeInTheDocument();
      expect(screen.getByText('3 segments')).toBeInTheDocument();
      // Quick Facts Participants label should exist
      const participantsLabels = screen.getAllByText('Participants');
      expect(participantsLabels.length).toBeGreaterThanOrEqual(1);
    });

    it('method Approach appears exactly once — no duplication', () => {
      mockBrief.mockReturnValue({
        data: makeBrief({
          cascade_fields: { ...makeBrief().cascade_fields, methodology_selection: 'usability_testing' },
          prose_sections: { ...makeBrief().prose_sections, method_prose: 'Sessions combine think-aloud protocols...' },
        }),
        isLoading: false, error: null,
      });
      renderWithProviders(<BriefDocument />);
      // The "Approach" label (as a bold term) should appear exactly once in the Method system block
      // It should NOT appear in the method_prose editable content
      const approachLabels = screen.getAllByText('Approach');
      expect(approachLabels.length).toBe(1);
      // Verify the method prose is rendered (without duplication)
      expect(screen.getByText(/think-aloud protocols/)).toBeInTheDocument();
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
          },
          structured_fields: {
            ...makeBrief().structured_fields,
            participant_segments: [
              { segment: 'Active users', count: 4, rationale: 'Main group' },
              { segment: 'First-time users', count: 4, rationale: 'New users' },
            ],
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
