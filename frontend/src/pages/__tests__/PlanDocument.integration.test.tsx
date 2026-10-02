/**
 * PlanDocument Integration Tests — M4A Comments + Coaching Co-existence
 *
 * Tests the interaction between Comments and Coaching rails in Plan workspace.
 *
 * LOCKED CONTRACT:
 * - Comments and Coaching operate independently
 * - No rail mode switch invokes AI automatically
 * - Plan has NO Review rail (no approval workflow)
 *
 * M4A: Integration test foundation per CLAUDE.md §Testing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { PlanDocument } from '../PlanDocument';

// ─── Mock Setup ──────────────────────────────────────────────────────────────

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => ({ studyPublicId: 'study-1' }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({
    me: {
      actor: { display_name: 'Test User', public_id: 'actor-1' },
      organization: { name: 'Test Org', public_id: 'org-1' },
      memberships: [],
    },
  }),
}));

const mockPlan = vi.fn();
vi.mock('@/api/queries/useStudy', () => ({
  useStudyPlan: () => mockPlan(),
}));

vi.mock('@/api/mutations/useSaveContent', () => ({
  useSavePlanContent: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

// Comments mock
vi.mock('@/api/comments', () => ({
  useCommentThreads: () => ({
    data: { threads: [] },
    isLoading: false,
    isError: false,
  }),
  deriveOpenThreadCount: () => 0,
  groupThreadsBySection: () => new Map(),
}));

// Coaching mock with mutation tracking
const mockCreateCoachRunMutation = vi.fn();
vi.mock('@/api/coaching', () => ({
  useCoachHistory: () => ({
    data: {
      runs: [],
      capabilities: {
        artifact_review: true,
        coachable_sections: [
          { section_key: 'plan_summary', label: 'Summary' },
          { section_key: 'plan_background', label: 'Background' },
        ],
      },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useCoachRun: () => ({ data: null, isLoading: false, isError: false }),
  useActiveCoachRun: () => ({ data: null, isLoading: false }),
  useCreateCoachRun: () => ({
    mutate: mockCreateCoachRunMutation,
    isPending: false,
  }),
  useRetryCoachRun: () => ({ mutate: vi.fn(), isPending: false }),
  isActiveRun: (r: { status: string }) => r.status === 'pending' || r.status === 'running',
  isTerminalRun: (r: { status: string }) => r.status === 'completed' || r.status === 'failed',
}));

// Reference navigation mock
vi.mock('@/components/study/workspace', async () => {
  const actual = await vi.importActual('@/components/study/workspace');
  return {
    ...actual,
    useReferenceNavigation: () => ({
      pinnedRun: null,
      navigateToReference: vi.fn(),
      returnToOrigin: vi.fn(),
      clearPinnedRun: vi.fn(),
      isReferenceClickable: () => false,
      resolveDestination: () => null,
      getReviewedVersionForReference: () => null,
      isNavigationActive: false,
    }),
  };
});

// ─── Test Data ───────────────────────────────────────────────────────────────

function makePlan() {
  return {
    study: {
      public_id: 'study-1',
      name: 'M4A Test Study',
      status: 'active',
      brief_status: 'approved',
      project_public_id: 'p1',
      created_at: '2026-09-01',
    },
    artifact_public_id: 'plan-art-1',
    artifact_version: 1,
    plan_url: 'https://github.com/org/repo/blob/main/plan.md',
    inherited_context: {
      research_objectives: [{ id: 'OBJ-001', objective: 'Test objective' }],
      research_questions: [{ id: 'RQ-001', question: 'Test question', priority: 'Primary' }],
      methodology_selection: 'usability_testing',
      participant_approach: '8 Veterans',
      start_date: '2026-10-01',
      decision_deadline: null,
      budget: '$800',
    },
    prose_sections: {
      plan_summary: 'Test plan summary.',
      plan_background: 'Test background.',
      plan_method_approach: 'Test method approach.',
      plan_participants_prose: 'Test participants prose.',
      plan_deliverables: 'Test deliverables.',
      plan_risks: 'Test risks.',
      plan_commitments: 'Test commitments.',
    },
    structured_fields: {
      participant_segments: [],
      session_topics: [],
      deliverables: [],
      risks: [],
      brief_commitments: [],
    },
  };
}

// ─── Integration Tests ───────────────────────────────────────────────────────

describe('M4A PlanDocument Comments + Coaching Integration', () => {
  beforeEach(() => {
    mockPlan.mockReturnValue({
      data: makePlan(),
      isLoading: false,
      error: null,
    });
    mockCreateCoachRunMutation.mockClear();
  });

  describe('State Isolation', () => {
    it('opening Coaching rail does NOT automatically invoke AI', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PlanDocument />);

      // Wait for document to render
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /summary/i })).toBeInTheDocument();
      });

      // Find and click the AI Coach toggle in header
      const coachingToggle = screen.getByRole('button', { name: /ai coach/i });
      await user.click(coachingToggle);

      // Wait for rail to be visible
      await waitFor(() => {
        expect(screen.getByText(/ai coach/i)).toBeInTheDocument();
      });

      // Critical assertion: NO AI was invoked just by opening the rail
      expect(mockCreateCoachRunMutation).not.toHaveBeenCalled();
    });

    it('switching between tabs does NOT invoke AI', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PlanDocument />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /summary/i })).toBeInTheDocument();
      });

      // Open Coaching rail
      const coachingToggle = screen.getByRole('button', { name: /ai coach/i });
      await user.click(coachingToggle);

      await waitFor(() => {
        expect(screen.getByRole('tablist')).toBeInTheDocument();
      });

      // Click all available tabs
      const tabs = screen.getAllByRole('tab');
      for (const tab of tabs) {
        await user.click(tab);
      }

      // Critical assertion: NO AI was invoked during any tab switch
      expect(mockCreateCoachRunMutation).not.toHaveBeenCalled();
    });
  });

  describe('Plan-Specific Behavior', () => {
    it('Plan has only Coaching and Comments tabs (no Review)', async () => {
      const user = userEvent.setup();
      renderWithProviders(<PlanDocument />);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /summary/i })).toBeInTheDocument();
      });

      // Open the rail
      const coachingToggle = screen.getByRole('button', { name: /ai coach/i });
      await user.click(coachingToggle);

      await waitFor(() => {
        expect(screen.getByRole('tablist')).toBeInTheDocument();
      });

      // Get all tabs and verify no Review tab
      const tabs = screen.getAllByRole('tab');
      const tabLabels = tabs.map((t) => t.textContent?.toLowerCase() || '');

      // Should have Coaching and Comments (with possible count suffix like "comments1")
      expect(tabLabels.some((l) => l.includes('coaching'))).toBe(true);
      expect(tabLabels.some((l) => l.includes('comment'))).toBe(true);
      expect(tabLabels.some((l) => l.includes('review'))).toBe(false);
    });
  });
});
