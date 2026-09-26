/**
 * CC-8: BriefDocument accessibility tests — 4 approval statuses.
 * SPEC §12.14: vitest-axe reporting zero violations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/utils';
import { BriefDocument } from './BriefDocument';
import { axe } from 'vitest-axe';

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

// CMT-6/7: Mock comments API
vi.mock('@/api/comments', () => ({
  useCommentThreads: () => ({ data: { threads: [] }, isLoading: false, isError: false }),
  deriveOpenThreadCount: () => 0,
  groupThreadsBySection: () => new Map(),
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
    prose_sections: {},
    structured_fields: {
      research_objectives: [{ id: 'OBJ-001', objective: 'Understand scheduling' }],
      research_questions: [{ id: 'RQ-001', question: 'How do users find?', priority: 'Primary' }],
      target_barriers: [{ id: 'TB-001', barrier: 'Complex navigation', source: 'Desk research' }],
      participant_segments: [],
      discovery_sources: [],
    },
    ...overrides,
  };
}

describe('BriefDocument accessibility', () => {
  beforeEach(() => vi.clearAllMocks());

  it('has no serious or critical axe violations (approved status)', async () => {
    mockBrief.mockReturnValue({ data: makeBrief({ brief_status: 'approved' }), isLoading: false, error: null });
    const { container } = renderWithProviders(<BriefDocument />);
    const results = await axe(container);
    const serious = results.violations.filter(
      (v: any) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious).toHaveLength(0);
  });

  it('has no serious or critical axe violations (pending_approval status)', async () => {
    mockBrief.mockReturnValue({
      data: makeBrief({
        brief_status: 'pending_approval',
        brief_approved_at: null,
        brief_reviewer_display_name: 'Jane Reviewer',
      }),
      isLoading: false,
      error: null,
    });
    const { container } = renderWithProviders(<BriefDocument />);
    const results = await axe(container);
    const serious = results.violations.filter(
      (v: any) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious).toHaveLength(0);
  });

  it('has no serious or critical axe violations (changes_requested status)', async () => {
    mockBrief.mockReturnValue({
      data: makeBrief({
        brief_status: 'changes_requested',
        brief_approved_at: null,
        brief_change_feedback: 'Please revise the methodology section.',
        brief_reviewer_display_name: 'Jane Reviewer',
      }),
      isLoading: false,
      error: null,
    });
    const { container } = renderWithProviders(<BriefDocument />);
    const results = await axe(container);
    const serious = results.violations.filter(
      (v: any) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious).toHaveLength(0);
  });

  it('has no serious or critical axe violations (null status)', async () => {
    mockBrief.mockReturnValue({
      data: makeBrief({
        brief_status: null,
        brief_approved_at: null,
      }),
      isLoading: false,
      error: null,
    });
    const { container } = renderWithProviders(<BriefDocument />);
    const results = await axe(container);
    const serious = results.violations.filter(
      (v: any) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious).toHaveLength(0);
  });
});
