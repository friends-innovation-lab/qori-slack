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
      methodology_selection: 'usability_testing', timeline_preference: null,
      start_date: '2026-10-01', participant_approach: '8 Veterans', budget: '$800',
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
    expect(screen.getByText('Fix scope')).toBeInTheDocument();
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
});
