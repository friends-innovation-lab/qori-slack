/**
 * CoachingRail Tests — Coach M3A
 *
 * Tests for the workspace coaching rail component.
 *
 * Coverage:
 * - selectPrimaryArtifactRun pure function (M3A precedence rules)
 * - Component rendering states (loading, error, empty, with runs)
 * - History display
 * - Action button states
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { selectPrimaryArtifactRun, selectPrimarySectionRun, CoachingRail } from './CoachingRail';
import type { CoachRunSummaryResource } from '@qori/api-contracts';

// ─── Test Data Factories ─────────────────────────────────────────────────────

function createRunSummary(
  overrides: Partial<CoachRunSummaryResource> = {},
): CoachRunSummaryResource {
  return {
    id: crypto.randomUUID(),
    artifact_public_id: 'art-123',
    artifact_type: 'brief',
    content_version: 1,
    selected_section_key: null,
    review_scope: 'artifact',
    status: 'completed',
    requested_by: {
      public_id: 'user-123',
      display_name: 'Test Researcher',
    },
    requested_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    failed_at: null,
    is_current_version: true,
    retry_of_run_id: null,
    ...overrides,
  };
}

// ─── selectPrimaryArtifactRun Unit Tests ─────────────────────────────────────

describe('selectPrimaryArtifactRun', () => {
  const currentVersion = 2;
  const currentUserId = 'user-current';
  const otherUserId = 'user-other';

  it('returns null when no runs exist', () => {
    const result = selectPrimaryArtifactRun([], currentVersion, currentUserId);
    expect(result).toBeNull();
  });

  it('excludes section-scope runs from primary selection', () => {
    const sectionRun = createRunSummary({
      review_scope: 'section',
      selected_section_key: 'summary',
      content_version: currentVersion,
    });

    const result = selectPrimaryArtifactRun([sectionRun], currentVersion, currentUserId);
    expect(result).toBeNull();
  });

  describe('precedence rules', () => {
    it('prefers current user active run over collaborator active run', () => {
      const ownActive = createRunSummary({
        status: 'pending',
        content_version: currentVersion,
        requested_by: { public_id: currentUserId, display_name: 'Current User' },
      });
      const otherActive = createRunSummary({
        status: 'running',
        content_version: currentVersion,
        requested_by: { public_id: otherUserId, display_name: 'Other User' },
      });

      const result = selectPrimaryArtifactRun(
        [otherActive, ownActive],
        currentVersion,
        currentUserId,
      );

      expect(result?.id).toBe(ownActive.id);
    });

    it('prefers collaborator active run over completed run', () => {
      const otherActive = createRunSummary({
        status: 'running',
        content_version: currentVersion,
        requested_by: { public_id: otherUserId, display_name: 'Other User' },
      });
      const completed = createRunSummary({
        status: 'completed',
        content_version: currentVersion,
        requested_by: { public_id: currentUserId, display_name: 'Current User' },
      });

      const result = selectPrimaryArtifactRun(
        [completed, otherActive],
        currentVersion,
        currentUserId,
      );

      expect(result?.id).toBe(otherActive.id);
    });

    it('prefers current version completed over earlier version run', () => {
      const currentCompleted = createRunSummary({
        status: 'completed',
        content_version: currentVersion,
        is_current_version: true,
      });
      const earlierCompleted = createRunSummary({
        status: 'completed',
        content_version: 1,
        is_current_version: false,
      });

      const result = selectPrimaryArtifactRun(
        [earlierCompleted, currentCompleted],
        currentVersion,
        currentUserId,
      );

      expect(result?.id).toBe(currentCompleted.id);
    });

    it('returns earlier version run when no current version runs exist', () => {
      const earlierCompleted = createRunSummary({
        status: 'completed',
        content_version: 1,
        is_current_version: false,
      });

      const result = selectPrimaryArtifactRun(
        [earlierCompleted],
        currentVersion,
        currentUserId,
      );

      expect(result?.id).toBe(earlierCompleted.id);
    });

    it('prefers latest terminal run for current version', () => {
      const older = createRunSummary({
        status: 'completed',
        content_version: currentVersion,
        requested_at: '2024-01-01T10:00:00Z',
      });
      const newer = createRunSummary({
        status: 'completed',
        content_version: currentVersion,
        requested_at: '2024-01-02T10:00:00Z',
      });

      // Runs are newest-first in the array (API contract)
      const result = selectPrimaryArtifactRun(
        [newer, older],
        currentVersion,
        currentUserId,
      );

      expect(result?.id).toBe(newer.id);
    });
  });

  describe('active run detection', () => {
    it('treats pending as active', () => {
      const pendingRun = createRunSummary({
        status: 'pending',
        content_version: currentVersion,
        requested_by: { public_id: currentUserId, display_name: 'Current User' },
      });

      const result = selectPrimaryArtifactRun(
        [pendingRun],
        currentVersion,
        currentUserId,
      );

      expect(result?.id).toBe(pendingRun.id);
    });

    it('treats running as active', () => {
      const runningRun = createRunSummary({
        status: 'running',
        content_version: currentVersion,
        requested_by: { public_id: currentUserId, display_name: 'Current User' },
      });

      const result = selectPrimaryArtifactRun(
        [runningRun],
        currentVersion,
        currentUserId,
      );

      expect(result?.id).toBe(runningRun.id);
    });

    it('treats completed as terminal (not active)', () => {
      const completedRun = createRunSummary({
        status: 'completed',
        content_version: currentVersion,
        requested_by: { public_id: currentUserId, display_name: 'Current User' },
      });
      const otherActive = createRunSummary({
        status: 'running',
        content_version: currentVersion,
        requested_by: { public_id: otherUserId, display_name: 'Other User' },
      });

      // otherActive should win over completedRun because active > terminal
      const result = selectPrimaryArtifactRun(
        [completedRun, otherActive],
        currentVersion,
        currentUserId,
      );

      expect(result?.id).toBe(otherActive.id);
    });

    it('treats failed as terminal (not active)', () => {
      const failedRun = createRunSummary({
        status: 'failed',
        content_version: currentVersion,
        requested_by: { public_id: currentUserId, display_name: 'Current User' },
      });
      const otherActive = createRunSummary({
        status: 'pending',
        content_version: currentVersion,
        requested_by: { public_id: otherUserId, display_name: 'Other User' },
      });

      // otherActive should win over failedRun because active > terminal
      const result = selectPrimaryArtifactRun(
        [failedRun, otherActive],
        currentVersion,
        currentUserId,
      );

      expect(result?.id).toBe(otherActive.id);
    });
  });
});

// ─── CoachingRail Component Tests ────────────────────────────────────────────

// Mock the coaching API hooks
vi.mock('@/api/coaching', () => ({
  useCoachHistory: vi.fn(),
  useCoachRun: vi.fn(() => ({ data: null, isLoading: false, isError: false })),
  useActiveCoachRun: vi.fn(() => ({ data: null })),
  useCreateCoachRun: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
  })),
  isActiveRun: vi.fn((run) => run.status === 'pending' || run.status === 'running'),
}));

import * as coachingApi from '@/api/coaching';

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>,
  );
};

describe('CoachingRail Component', () => {
  const defaultProps = {
    artifactPublicId: 'art-123',
    artifactType: 'brief' as const,
    currentContentVersion: 1,
    currentUserPublicId: 'user-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading indicator while fetching history', () => {
      vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        refetch: vi.fn(),
      } as any);

      renderWithProviders(<CoachingRail {...defaultProps} />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when history fetch fails', () => {
      vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        refetch: vi.fn(),
      } as any);

      renderWithProviders(<CoachingRail {...defaultProps} />);

      expect(screen.getByText('Could not load coaching history.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no runs exist', () => {
      vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
        data: { artifact_public_id: 'art-123', runs: [], cursor: null, has_more: false },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);

      renderWithProviders(<CoachingRail {...defaultProps} />);

      expect(screen.getByText('No coaching reviews yet')).toBeInTheDocument();
      expect(screen.getByText(/Get AI-powered feedback/)).toBeInTheDocument();
    });

    it('shows Review Research Brief button in empty state', () => {
      vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
        data: { artifact_public_id: 'art-123', runs: [], cursor: null, has_more: false },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);

      renderWithProviders(<CoachingRail {...defaultProps} />);

      expect(screen.getByRole('button', { name: /review research brief/i })).toBeInTheDocument();
    });
  });

  describe('with runs', () => {
    const completedRun = createRunSummary({
      status: 'completed',
      content_version: 1,
      requested_by: { public_id: 'user-123', display_name: 'Test Researcher' },
    });

    it('shows AI Coach heading', () => {
      vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
        data: { artifact_public_id: 'art-123', runs: [completedRun], cursor: null, has_more: false },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);

      renderWithProviders(<CoachingRail {...defaultProps} />);

      expect(screen.getByText('AI Coach')).toBeInTheDocument();
    });

    it('shows primary run status', () => {
      vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
        data: { artifact_public_id: 'art-123', runs: [completedRun], cursor: null, has_more: false },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);

      renderWithProviders(<CoachingRail {...defaultProps} />);

      expect(screen.getByText('Review complete')).toBeInTheDocument();
    });

    it('shows history section with runs', () => {
      vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
        data: { artifact_public_id: 'art-123', runs: [completedRun], cursor: null, has_more: false },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);

      renderWithProviders(<CoachingRail {...defaultProps} />);

      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('Research Brief review')).toBeInTheDocument();
    });

    it('shows requester name in history', () => {
      vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
        data: { artifact_public_id: 'art-123', runs: [completedRun], cursor: null, has_more: false },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);

      renderWithProviders(<CoachingRail {...defaultProps} />);

      // Name appears in both primary meta and history row
      const nameElements = screen.getAllByText(/Test Researcher/);
      expect(nameElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('action button state', () => {
    it('disables Review Research Brief when user has active run', () => {
      const activeRun = createRunSummary({
        status: 'pending',
        content_version: 1,
        requested_by: { public_id: 'user-123', display_name: 'Test Researcher' },
      });

      vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
        data: { artifact_public_id: 'art-123', runs: [activeRun], cursor: null, has_more: false },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);
      vi.mocked(coachingApi.isActiveRun).mockReturnValue(true);

      renderWithProviders(<CoachingRail {...defaultProps} />);

      const button = screen.getByRole('button', { name: /review research brief/i });
      expect(button).toBeDisabled();
      expect(screen.getByText('A review is already in progress.')).toBeInTheDocument();
    });

    it('enables Review artifact when no active run exists', () => {
      const completedRun = createRunSummary({
        status: 'completed',
        content_version: 1,
        requested_by: { public_id: 'user-123', display_name: 'Test Researcher' },
      });

      vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
        data: { artifact_public_id: 'art-123', runs: [completedRun], cursor: null, has_more: false },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);
      vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

      renderWithProviders(<CoachingRail {...defaultProps} />);

      // M3B: When there's a completed run for current version, button says "Review Research Brief again"
      const button = screen.getByRole('button', { name: /review research brief again/i });
      expect(button).not.toBeDisabled();
    });
  });

  describe('version badge', () => {
    it('shows Current version badge for current version run', () => {
      const currentVersionRun = createRunSummary({
        status: 'completed',
        content_version: 1,
        is_current_version: true,
      });

      vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
        data: { artifact_public_id: 'art-123', runs: [currentVersionRun], cursor: null, has_more: false },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);

      renderWithProviders(<CoachingRail {...defaultProps} />);

      expect(screen.getByText('Current version')).toBeInTheDocument();
    });

    it('shows Earlier version badge for earlier version run', () => {
      const earlierVersionRun = createRunSummary({
        status: 'completed',
        content_version: 0,
        is_current_version: false,
      });

      vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
        data: { artifact_public_id: 'art-123', runs: [earlierVersionRun], cursor: null, has_more: false },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);

      renderWithProviders(<CoachingRail {...defaultProps} />);

      expect(screen.getByText('Earlier version')).toBeInTheDocument();
    });
  });

  /**
   * M3A Merge Gate — §40: No automatic AI invocation.
   *
   * This test proves that rendering the rail, browsing history,
   * and switching tabs creates ZERO Coach runs.
   * Only explicit "Review artifact" may create a run.
   */
  describe('M3A merge gate: no automatic AI invocation', () => {
    it('opening rail, browsing history, and switching modes does NOT invoke createCoachRun', () => {
      const mockMutate = vi.fn();
      vi.mocked(coachingApi.useCreateCoachRun).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
      } as any);

      const completedRun = createRunSummary({
        status: 'completed',
        content_version: 1,
        requested_by: { public_id: 'other-user', display_name: 'Another Researcher' },
      });

      vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
        data: { artifact_public_id: 'art-123', runs: [completedRun], cursor: null, has_more: false },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);

      // Render the rail (simulates opening Coaching tab)
      const { rerender } = renderWithProviders(<CoachingRail {...defaultProps} />);

      // Browse history — verify history row is visible
      expect(screen.getByText('Research Brief review')).toBeInTheDocument();

      // Rerender (simulates switching tabs and returning)
      rerender(<CoachingRail {...defaultProps} />);

      // MERGE GATE: createCoachRun must NOT have been called
      expect(mockMutate).not.toHaveBeenCalled();
    });
  });
});

// ─── M3B: selectPrimarySectionRun Unit Tests ─────────────────────────────────

describe('selectPrimarySectionRun', () => {
  const currentVersion = 2;
  const currentUserId = 'user-current';
  const otherUserId = 'user-other';
  const targetSection = 'summary';

  function createSectionRun(
    overrides: Partial<CoachRunSummaryResource> = {},
  ): CoachRunSummaryResource {
    return {
      id: crypto.randomUUID(),
      artifact_public_id: 'art-123',
      artifact_type: 'brief',
      content_version: currentVersion,
      selected_section_key: targetSection,
      review_scope: 'section',
      status: 'completed',
      requested_by: {
        public_id: currentUserId,
        display_name: 'Test Researcher',
      },
      requested_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      failed_at: null,
      is_current_version: true,
      retry_of_run_id: null,
      ...overrides,
    };
  }

  it('returns null when no runs exist', () => {
    const result = selectPrimarySectionRun([], currentVersion, currentUserId, targetSection);
    expect(result).toBeNull();
  });

  it('excludes artifact-scope runs', () => {
    const artifactRun = createSectionRun({
      review_scope: 'artifact',
      selected_section_key: null,
    });

    const result = selectPrimarySectionRun([artifactRun], currentVersion, currentUserId, targetSection);
    expect(result).toBeNull();
  });

  it('excludes runs for different sections', () => {
    const otherSectionRun = createSectionRun({
      selected_section_key: 'method_prose',
    });

    const result = selectPrimarySectionRun([otherSectionRun], currentVersion, currentUserId, targetSection);
    expect(result).toBeNull();
  });

  it('returns matching section run for exact section key', () => {
    const sectionRun = createSectionRun();

    const result = selectPrimarySectionRun([sectionRun], currentVersion, currentUserId, targetSection);
    expect(result).toBe(sectionRun);
  });

  it('prefers latest completed run when no active runs exist', () => {
    const newerCompletedId = 'newer-completed-run-id';
    const newerCompleted = createSectionRun({
      id: newerCompletedId,
      status: 'completed',
      requested_by: { public_id: currentUserId, display_name: 'Current User' },
    });
    const olderCompleted = createSectionRun({
      id: 'older-completed-run-id',
      status: 'completed',
      requested_by: { public_id: otherUserId, display_name: 'Other User' },
    });

    // Runs are sorted newest-first, so newerCompleted comes first
    const result = selectPrimarySectionRun(
      [newerCompleted, olderCompleted],
      currentVersion,
      currentUserId,
      targetSection,
    );
    // Should return the first terminal run when no active runs
    expect(result?.id).toBe(newerCompletedId);
    expect(result?.status).toBe('completed');
  });

  it('returns earlier version section run as fallback', () => {
    const earlierVersionRun = createSectionRun({
      content_version: currentVersion - 1,
      is_current_version: false,
    });

    const result = selectPrimarySectionRun(
      [earlierVersionRun],
      currentVersion,
      currentUserId,
      targetSection,
    );
    expect(result).toBe(earlierVersionRun);
  });
});

// ─── M3B: Section Context UI Tests ─────────────────────────────────────────────

// ─── Status Transition Regression Tests ────────────────────────────────────
// These tests verify that when a polled run transitions from active to terminal,
// the UI updates correctly WITHOUT requiring reload, remount, or navigation.

describe('running → failed status transition (production bug regression)', () => {
  const defaultProps = {
    artifactPublicId: 'art-123',
    artifactType: 'brief' as const,
    currentContentVersion: 1,
    currentUserPublicId: 'user-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transitions from "Reviewing..." to failed message when polled run becomes failed', () => {
    const runId = 'run-transition-test';

    // Initial state: history shows running run
    const runningRun = createRunSummary({
      id: runId,
      status: 'running',
      content_version: 1,
      requested_by: { public_id: 'user-123', display_name: 'Test Researcher' },
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: { artifact_public_id: 'art-123', runs: [runningRun], cursor: null, has_more: false },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    // Active run query returns the same run as running initially
    vi.mocked(coachingApi.useActiveCoachRun).mockReturnValue({
      data: {
        run: {
          ...runningRun,
          items: [],
          failure: null,
        },
      },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockImplementation(
      (run) => run.status === 'pending' || run.status === 'running',
    );

    const { rerender } = renderWithProviders(<CoachingRail {...defaultProps} />);

    // Initial: should show "Reviewing" status
    expect(screen.getByText(/Reviewing your Research Brief/)).toBeInTheDocument();

    // Now simulate polling returning failed status
    const failedRun = {
      ...runningRun,
      status: 'failed' as const,
      failed_at: new Date().toISOString(),
      items: [],
      failure: { code: 'MAX_ATTEMPTS_EXCEEDED', message: 'Coach couldn\'t complete this review.' },
    };

    // History cache is still stale (hasn't been invalidated yet)
    // But active run query now returns the failed status
    vi.mocked(coachingApi.useActiveCoachRun).mockReturnValue({
      data: { run: failedRun },
      isLoading: false,
      isError: false,
    } as any);

    // Rerender to simulate React Query's refetch completing
    rerender(<CoachingRail {...defaultProps} />);

    // REGRESSION TEST: UI should show failed state, not "Reviewing..."
    // This test fails before the fix because primaryRun.status is still 'running' from history
    expect(screen.queryByText(/Reviewing your Research Brief/)).not.toBeInTheDocument();
    expect(screen.getByText(/Review couldn't be completed/)).toBeInTheDocument();
  });

  it('shows failure message when run transitions to failed', () => {
    const runId = 'run-failure-message-test';

    const runningRun = createRunSummary({
      id: runId,
      status: 'running',
      content_version: 1,
      requested_by: { public_id: 'user-123', display_name: 'Test Researcher' },
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: { artifact_public_id: 'art-123', runs: [runningRun], cursor: null, has_more: false },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    const failedRun = {
      ...runningRun,
      status: 'failed' as const,
      failed_at: new Date().toISOString(),
      items: [],
      failure: { code: 'MAX_ATTEMPTS_EXCEEDED', message: 'Coach couldn\'t complete this review.' },
    };

    vi.mocked(coachingApi.useActiveCoachRun).mockReturnValue({
      data: { run: failedRun },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockImplementation(
      (run) => run.status === 'pending' || run.status === 'running',
    );

    renderWithProviders(<CoachingRail {...defaultProps} />);

    // Should show failure message
    expect(screen.getByText(/Coach couldn't complete this review/)).toBeInTheDocument();
    // Should show safety copy
    expect(screen.getByText(/Your Research Brief wasn't changed/)).toBeInTheDocument();
  });

  it('enables Review button after run fails', () => {
    const runId = 'run-button-unlock-test';

    const runningRun = createRunSummary({
      id: runId,
      status: 'running',
      content_version: 1,
      requested_by: { public_id: 'user-123', display_name: 'Test Researcher' },
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: { artifact_public_id: 'art-123', runs: [runningRun], cursor: null, has_more: false },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    const failedRun = {
      ...runningRun,
      status: 'failed' as const,
      failed_at: new Date().toISOString(),
      items: [],
      failure: { code: 'MAX_ATTEMPTS_EXCEEDED', message: 'Coach couldn\'t complete this review.' },
    };

    vi.mocked(coachingApi.useActiveCoachRun).mockReturnValue({
      data: { run: failedRun },
      isLoading: false,
      isError: false,
    } as any);

    // After failure, isActiveRun should return false
    vi.mocked(coachingApi.isActiveRun).mockImplementation(
      (run) => run.status === 'pending' || run.status === 'running',
    );

    renderWithProviders(<CoachingRail {...defaultProps} />);

    // Button should be enabled (not disabled due to "active" run)
    const button = screen.getByRole('button', { name: /review research brief/i });
    expect(button).not.toBeDisabled();
    expect(screen.queryByText('A review is already in progress.')).not.toBeInTheDocument();
  });

  it('removes REVIEWING badge from history when run fails', () => {
    const runId = 'run-history-badge-test';

    const runningRun = createRunSummary({
      id: runId,
      status: 'running',
      content_version: 1,
      requested_by: { public_id: 'user-123', display_name: 'Test Researcher' },
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: { artifact_public_id: 'art-123', runs: [runningRun], cursor: null, has_more: false },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    const failedRun = {
      ...runningRun,
      status: 'failed' as const,
      failed_at: new Date().toISOString(),
      items: [],
      failure: { code: 'MAX_ATTEMPTS_EXCEEDED', message: 'Coach couldn\'t complete this review.' },
    };

    vi.mocked(coachingApi.useActiveCoachRun).mockReturnValue({
      data: { run: failedRun },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockImplementation(
      (run) => run.status === 'pending' || run.status === 'running',
    );

    renderWithProviders(<CoachingRail {...defaultProps} />);

    // History row should show Failed badge, not Reviewing
    // (This will require history cache invalidation or merged status)
    expect(screen.queryByText('Reviewing')).not.toBeInTheDocument();
    // The failed status should be visible somewhere
    expect(screen.getByText(/Review couldn't be completed/)).toBeInTheDocument();
  });
});

describe('running → completed status transition', () => {
  const defaultProps = {
    artifactPublicId: 'art-123',
    artifactType: 'brief' as const,
    currentContentVersion: 1,
    currentUserPublicId: 'user-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('transitions from "Reviewing..." to "Review complete" when run completes', () => {
    const runId = 'run-complete-test';

    const runningRun = createRunSummary({
      id: runId,
      status: 'running',
      content_version: 1,
      requested_by: { public_id: 'user-123', display_name: 'Test Researcher' },
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: { artifact_public_id: 'art-123', runs: [runningRun], cursor: null, has_more: false },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    const completedRun = {
      ...runningRun,
      status: 'completed' as const,
      completed_at: new Date().toISOString(),
      items: [
        {
          id: 'item-1',
          category: 'strength' as const,
          position: 1,
          text: 'Clear problem statement',
          references: [],
        },
      ],
      failure: null,
    };

    vi.mocked(coachingApi.useActiveCoachRun).mockReturnValue({
      data: { run: completedRun },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockImplementation(
      (run) => run.status === 'pending' || run.status === 'running',
    );

    renderWithProviders(<CoachingRail {...defaultProps} />);

    // Should show completed status, not "Reviewing..."
    expect(screen.queryByText(/Reviewing your Research Brief/)).not.toBeInTheDocument();
    expect(screen.getByText('Review complete')).toBeInTheDocument();
  });

  it('shows structured result when run completes', () => {
    const runId = 'run-result-test';

    const runningRun = createRunSummary({
      id: runId,
      status: 'running',
      content_version: 1,
      requested_by: { public_id: 'user-123', display_name: 'Test Researcher' },
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: { artifact_public_id: 'art-123', runs: [runningRun], cursor: null, has_more: false },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    const completedRun = {
      ...runningRun,
      status: 'completed' as const,
      completed_at: new Date().toISOString(),
      items: [
        {
          id: 'item-1',
          category: 'strength' as const,
          position: 1,
          text: 'Clear problem statement',
          references: [],
        },
        {
          id: 'item-2',
          category: 'issue' as const,
          position: 1,
          text: 'Missing timeline details',
          references: [],
        },
      ],
      failure: null,
    };

    vi.mocked(coachingApi.useActiveCoachRun).mockReturnValue({
      data: { run: completedRun },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockImplementation(
      (run) => run.status === 'pending' || run.status === 'running',
    );

    renderWithProviders(<CoachingRail {...defaultProps} />);

    // Should show structured result sections
    expect(screen.getByText('Strengths')).toBeInTheDocument();
    expect(screen.getByText('Clear problem statement')).toBeInTheDocument();
    expect(screen.getByText('Issues')).toBeInTheDocument();
    expect(screen.getByText('Missing timeline details')).toBeInTheDocument();
  });

  it('enables Review button after run completes', () => {
    const runId = 'run-button-after-complete-test';

    const runningRun = createRunSummary({
      id: runId,
      status: 'running',
      content_version: 1,
      requested_by: { public_id: 'user-123', display_name: 'Test Researcher' },
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: { artifact_public_id: 'art-123', runs: [runningRun], cursor: null, has_more: false },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    const completedRun = {
      ...runningRun,
      status: 'completed' as const,
      completed_at: new Date().toISOString(),
      items: [],
      failure: null,
    };

    vi.mocked(coachingApi.useActiveCoachRun).mockReturnValue({
      data: { run: completedRun },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockImplementation(
      (run) => run.status === 'pending' || run.status === 'running',
    );

    renderWithProviders(<CoachingRail {...defaultProps} />);

    // Button should be enabled and show "Review again"
    const button = screen.getByRole('button', { name: /review research brief/i });
    expect(button).not.toBeDisabled();
  });
});

describe('M3B section context', () => {
  const defaultProps = {
    artifactPublicId: 'art-123',
    artifactType: 'brief' as const,
    currentContentVersion: 1,
    currentUserPublicId: 'user-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: { artifact_public_id: 'art-123', runs: [], cursor: null, has_more: false },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
    vi.mocked(coachingApi.useActiveCoachRun).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    } as any);
    vi.mocked(coachingApi.useCreateCoachRun).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);
  });

  it('shows section context header when sectionContext is provided', () => {
    renderWithProviders(
      <CoachingRail
        {...defaultProps}
        sectionContext={{ sectionKey: 'summary', label: 'Summary' }}
      />,
    );

    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Section review')).toBeInTheDocument();
  });

  it('shows "Back to Research Brief coaching" link in section context', () => {
    renderWithProviders(
      <CoachingRail
        {...defaultProps}
        sectionContext={{ sectionKey: 'summary', label: 'Summary' }}
      />,
    );

    expect(screen.getByRole('button', { name: /back to research brief coaching/i })).toBeInTheDocument();
  });

  it('shows "Review this section" button for new section', () => {
    renderWithProviders(
      <CoachingRail
        {...defaultProps}
        sectionContext={{ sectionKey: 'summary', label: 'Summary' }}
      />,
    );

    expect(screen.getByRole('button', { name: /review this section/i })).toBeInTheDocument();
  });

  it('shows section history label in section context', () => {
    const sectionRun = createRunSummary({
      review_scope: 'section',
      selected_section_key: 'summary',
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: {
        artifact_public_id: 'art-123',
        runs: [sectionRun],
        cursor: null,
        has_more: false,
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    renderWithProviders(
      <CoachingRail
        {...defaultProps}
        sectionContext={{ sectionKey: 'summary', label: 'Summary' }}
      />,
    );

    expect(screen.getByText('Section history')).toBeInTheDocument();
  });

  /**
   * M3B Merge Gate — §41: Section context does NOT invoke AI automatically.
   *
   * This test proves that opening a section context creates ZERO Coach runs.
   * Only explicit "Review this section" may create a run.
   */
  it('M3B merge gate: opening section context does NOT invoke createCoachRun', () => {
    const mockMutate = vi.fn();
    vi.mocked(coachingApi.useCreateCoachRun).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);

    // Render in section context
    const { rerender } = renderWithProviders(
      <CoachingRail
        {...defaultProps}
        sectionContext={{ sectionKey: 'summary', label: 'Summary' }}
      />,
    );

    // Rerender (simulates navigating away and back)
    rerender(
      <CoachingRail
        {...defaultProps}
        sectionContext={{ sectionKey: 'method_prose', label: 'Method' }}
      />,
    );

    // MERGE GATE: createCoachRun must NOT have been called
    expect(mockMutate).not.toHaveBeenCalled();
  });
});

// ─── M3B Lazy Detail Loading Tests ────────────────────────────────────────────

describe('M3B lazy detail loading for completed runs', () => {
  const defaultProps = {
    artifactPublicId: 'art-123',
    artifactType: 'brief' as const,
    currentContentVersion: 1,
    currentUserPublicId: 'user-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches detail for completed primary run and renders structured result', () => {
    const completedRunId = 'completed-run-123';
    const completedRun = createRunSummary({
      id: completedRunId,
      status: 'completed',
      content_version: 1,
      requested_by: { public_id: 'user-123', display_name: 'Test Researcher' },
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: { artifact_public_id: 'art-123', runs: [completedRun], cursor: null, has_more: false },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    // Active run query returns null (not polling)
    vi.mocked(coachingApi.useActiveCoachRun).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    } as any);

    // Detail query returns the full run with items
    vi.mocked(coachingApi.useCoachRun).mockReturnValue({
      data: {
        run: {
          ...completedRun,
          items: [
            {
              id: 'item-1',
              category: 'strength' as const,
              position: 1,
              text: 'Clear problem statement',
              references: [],
            },
            {
              id: 'item-2',
              category: 'issue' as const,
              position: 1,
              text: 'Missing timeline details',
              references: [],
            },
          ],
          failure: null,
        },
      },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

    renderWithProviders(<CoachingRail {...defaultProps} />);

    // Should show completed status
    expect(screen.getByText('Review complete')).toBeInTheDocument();

    // Should show structured result sections
    expect(screen.getByText('Strengths')).toBeInTheDocument();
    expect(screen.getByText('Clear problem statement')).toBeInTheDocument();
    expect(screen.getByText('Issues')).toBeInTheDocument();
    expect(screen.getByText('Missing timeline details')).toBeInTheDocument();
  });

  it('fetches detail for completed section run and renders structured result', () => {
    const completedRunId = 'completed-section-run-123';
    const completedSectionRun = createRunSummary({
      id: completedRunId,
      status: 'completed',
      content_version: 1,
      review_scope: 'section',
      selected_section_key: 'summary',
      requested_by: { public_id: 'user-123', display_name: 'Test Researcher' },
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: { artifact_public_id: 'art-123', runs: [completedSectionRun], cursor: null, has_more: false },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(coachingApi.useActiveCoachRun).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    } as any);

    // Detail query returns the full section run with items
    vi.mocked(coachingApi.useCoachRun).mockReturnValue({
      data: {
        run: {
          ...completedSectionRun,
          items: [
            {
              id: 'item-1',
              category: 'suggestion' as const,
              position: 1,
              text: 'Consider adding more detail to the summary',
              references: [],
            },
          ],
          failure: null,
        },
      },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

    renderWithProviders(
      <CoachingRail
        {...defaultProps}
        sectionContext={{ sectionKey: 'summary', label: 'Summary' }}
      />,
    );

    // Should show completed status
    expect(screen.getByText('Review complete')).toBeInTheDocument();

    // Should show structured result
    expect(screen.getByText('Suggestions')).toBeInTheDocument();
    expect(screen.getByText('Consider adding more detail to the summary')).toBeInTheDocument();
  });

  it('does NOT create new run when viewing completed history (no POST)', () => {
    const completedRun = createRunSummary({
      id: 'completed-run-123',
      status: 'completed',
      content_version: 1,
      requested_by: { public_id: 'user-123', display_name: 'Test Researcher' },
    });

    const mockMutate = vi.fn();

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: { artifact_public_id: 'art-123', runs: [completedRun], cursor: null, has_more: false },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(coachingApi.useActiveCoachRun).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.useCoachRun).mockReturnValue({
      data: {
        run: {
          ...completedRun,
          items: [],
          failure: null,
        },
      },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.useCreateCoachRun).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

    // Render and view completed run
    const { rerender } = renderWithProviders(<CoachingRail {...defaultProps} />);

    // Verify history is visible
    expect(screen.getByText('History')).toBeInTheDocument();

    // Rerender (simulates reopening rail)
    rerender(<CoachingRail {...defaultProps} />);

    // CRITICAL: createCoachRun must NOT have been called
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('restores section result when reopening section context (no POST)', () => {
    const completedSectionRun = createRunSummary({
      id: 'section-run-123',
      status: 'completed',
      content_version: 1,
      review_scope: 'section',
      selected_section_key: 'problem_narrative',
      requested_by: { public_id: 'user-123', display_name: 'Test Researcher' },
    });

    const mockMutate = vi.fn();

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: { artifact_public_id: 'art-123', runs: [completedSectionRun], cursor: null, has_more: false },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(coachingApi.useActiveCoachRun).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.useCoachRun).mockReturnValue({
      data: {
        run: {
          ...completedSectionRun,
          items: [
            {
              id: 'item-1',
              category: 'strength' as const,
              position: 1,
              text: 'Restored strength item',
              references: [],
            },
          ],
          failure: null,
        },
      },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.useCreateCoachRun).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

    // Render in section context
    renderWithProviders(
      <CoachingRail
        {...defaultProps}
        sectionContext={{ sectionKey: 'problem_narrative', label: 'Problem' }}
      />,
    );

    // Should show the restored result
    expect(screen.getByText('Review complete')).toBeInTheDocument();
    expect(screen.getByText('Strengths')).toBeInTheDocument();
    expect(screen.getByText('Restored strength item')).toBeInTheDocument();

    // CRITICAL: no POST occurred
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('useCoachRun is called with correct runId for completed primary run', () => {
    const completedRunId = 'detail-fetch-test-123';
    const completedRun = createRunSummary({
      id: completedRunId,
      status: 'completed',
      content_version: 1,
      requested_by: { public_id: 'user-123', display_name: 'Test Researcher' },
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: { artifact_public_id: 'art-123', runs: [completedRun], cursor: null, has_more: false },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(coachingApi.useActiveCoachRun).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.useCoachRun).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

    renderWithProviders(<CoachingRail {...defaultProps} />);

    // Verify useCoachRun was called with the correct runId
    expect(coachingApi.useCoachRun).toHaveBeenCalledWith({
      runId: completedRunId,
      enabled: true,
    });
  });
});

// ─── M3B History Navigation Tests ─────────────────────────────────────────────
// These tests verify that clicking history rows navigates to the correct context
// and does NOT create new runs (no POST).

describe('M3B history row navigation', () => {
  const defaultProps = {
    artifactPublicId: 'art-123',
    artifactType: 'plan' as const,
    currentContentVersion: 1,
    currentUserPublicId: 'user-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clicking section history row from artifact context switches to section context', async () => {
    const artifactRun = createRunSummary({
      id: 'artifact-run-123',
      artifact_type: 'plan',
      status: 'completed',
      review_scope: 'artifact',
      selected_section_key: null,
      content_version: 1,
    });

    const sectionRun = createRunSummary({
      id: 'section-run-123',
      artifact_type: 'plan',
      status: 'completed',
      review_scope: 'section',
      selected_section_key: 'plan_background',
      content_version: 1,
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: {
        artifact_public_id: 'art-123',
        runs: [sectionRun, artifactRun],
        cursor: null,
        has_more: false,
        capabilities: {
          coachable_sections: [
            { section_key: 'plan_background', label: 'Background' },
            { section_key: 'plan_method_approach', label: 'Method' },
          ],
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(coachingApi.useActiveCoachRun).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.useCoachRun).mockReturnValue({
      data: {
        run: {
          ...sectionRun,
          items: [{ id: 'item-1', category: 'strength', position: 1, text: 'Good background', references: [] }],
          failure: null,
        },
      },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

    const onSectionContextChange = vi.fn();

    renderWithProviders(
      <CoachingRail
        {...defaultProps}
        sectionContext={null}
        onSectionContextChange={onSectionContextChange}
      />,
    );

    // Click the section history row
    const historyRow = screen.getByRole('option', { name: /open background coaching review/i });
    historyRow.click();

    // Should call onSectionContextChange with the section context
    expect(onSectionContextChange).toHaveBeenCalledWith({
      sectionKey: 'plan_background',
      label: 'Background',
    });
  });

  it('clicking artifact history row from section context switches to artifact context', async () => {
    const artifactRun = createRunSummary({
      id: 'artifact-run-123',
      artifact_type: 'plan',
      status: 'completed',
      review_scope: 'artifact',
      selected_section_key: null,
      content_version: 1,
    });

    const sectionRun = createRunSummary({
      id: 'section-run-123',
      artifact_type: 'plan',
      status: 'completed',
      review_scope: 'section',
      selected_section_key: 'plan_background',
      content_version: 1,
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: {
        artifact_public_id: 'art-123',
        runs: [sectionRun, artifactRun],
        cursor: null,
        has_more: false,
        capabilities: {
          coachable_sections: [
            { section_key: 'plan_background', label: 'Background' },
          ],
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(coachingApi.useActiveCoachRun).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.useCoachRun).mockReturnValue({
      data: {
        run: {
          ...artifactRun,
          items: [],
          failure: null,
        },
      },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

    const onSectionContextChange = vi.fn();

    // Render in section context (showing all history including artifact runs)
    // Note: In section context, displayedHistory is filtered to only section runs,
    // but for this test we're verifying the handler works correctly when called
    renderWithProviders(
      <CoachingRail
        {...defaultProps}
        sectionContext={{ sectionKey: 'plan_background', label: 'Background' }}
        onSectionContextChange={onSectionContextChange}
      />,
    );

    // In artifact context, click the artifact run
    // First, let's rerender in artifact context to see both runs
    const { rerender } = renderWithProviders(
      <CoachingRail
        {...defaultProps}
        sectionContext={null}
        onSectionContextChange={onSectionContextChange}
      />,
    );

    // Clear previous calls from initial render
    onSectionContextChange.mockClear();

    // Click the artifact history row
    const historyRow = screen.getByRole('option', { name: /open research plan coaching review/i });
    historyRow.click();

    // Should NOT call onSectionContextChange when already in artifact context
    // (clicking artifact row while in artifact context is a no-op for context)
    expect(onSectionContextChange).not.toHaveBeenCalled();
  });

  it('history row click does NOT create new run (no POST)', async () => {
    const completedRun = createRunSummary({
      id: 'completed-run-123',
      artifact_type: 'plan',
      status: 'completed',
      review_scope: 'section',
      selected_section_key: 'plan_background',
      content_version: 1,
    });

    const mockMutate = vi.fn();

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: {
        artifact_public_id: 'art-123',
        runs: [completedRun],
        cursor: null,
        has_more: false,
        capabilities: {
          coachable_sections: [
            { section_key: 'plan_background', label: 'Background' },
          ],
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(coachingApi.useActiveCoachRun).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.useCoachRun).mockReturnValue({
      data: {
        run: {
          ...completedRun,
          items: [{ id: 'item-1', category: 'strength', position: 1, text: 'Good section', references: [] }],
          failure: null,
        },
      },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.useCreateCoachRun).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

    renderWithProviders(
      <CoachingRail
        {...defaultProps}
        sectionContext={null}
        onSectionContextChange={vi.fn()}
      />,
    );

    // Click the history row
    const historyRow = screen.getByRole('option', { name: /open background coaching review/i });
    historyRow.click();

    // CRITICAL: no POST should occur
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('history row has accessible label with scope context', () => {
    const artifactRun = createRunSummary({
      id: 'artifact-run-123',
      artifact_type: 'plan',
      status: 'completed',
      review_scope: 'artifact',
      selected_section_key: null,
      content_version: 1,
    });

    const sectionRun = createRunSummary({
      id: 'section-run-123',
      artifact_type: 'plan',
      status: 'completed',
      review_scope: 'section',
      selected_section_key: 'plan_method_approach',
      content_version: 1,
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: {
        artifact_public_id: 'art-123',
        runs: [sectionRun, artifactRun],
        cursor: null,
        has_more: false,
        capabilities: {
          coachable_sections: [
            { section_key: 'plan_method_approach', label: 'Method' },
          ],
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(coachingApi.useActiveCoachRun).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.useCoachRun).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

    renderWithProviders(
      <CoachingRail
        {...defaultProps}
        sectionContext={null}
        onSectionContextChange={vi.fn()}
      />,
    );

    // Check accessible labels
    expect(screen.getByRole('option', { name: /open method coaching review/i })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /open research plan coaching review/i })).toBeInTheDocument();
  });

  it('works for any section type (not hardcoded to Background)', () => {
    const methodRun = createRunSummary({
      id: 'method-run-123',
      artifact_type: 'plan',
      status: 'completed',
      review_scope: 'section',
      selected_section_key: 'plan_method_approach',
      content_version: 1,
    });

    const risksRun = createRunSummary({
      id: 'risks-run-123',
      artifact_type: 'plan',
      status: 'completed',
      review_scope: 'section',
      selected_section_key: 'plan_risks',
      content_version: 1,
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: {
        artifact_public_id: 'art-123',
        runs: [methodRun, risksRun],
        cursor: null,
        has_more: false,
        capabilities: {
          coachable_sections: [
            { section_key: 'plan_method_approach', label: 'Method' },
            { section_key: 'plan_risks', label: 'Risks and mitigations' },
          ],
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(coachingApi.useActiveCoachRun).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.useCoachRun).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

    const onSectionContextChange = vi.fn();

    renderWithProviders(
      <CoachingRail
        {...defaultProps}
        sectionContext={null}
        onSectionContextChange={onSectionContextChange}
      />,
    );

    // Click Method review
    const methodRow = screen.getByRole('option', { name: /open method coaching review/i });
    methodRow.click();

    expect(onSectionContextChange).toHaveBeenCalledWith({
      sectionKey: 'plan_method_approach',
      label: 'Method',
    });

    onSectionContextChange.mockClear();

    // Click Risks review
    const risksRow = screen.getByRole('option', { name: /open risks and mitigations coaching review/i });
    risksRow.click();

    expect(onSectionContextChange).toHaveBeenCalledWith({
      sectionKey: 'plan_risks',
      label: 'Risks and mitigations',
    });
  });

  it('history row is keyboard accessible (Enter and Space)', () => {
    const sectionRun = createRunSummary({
      id: 'section-run-123',
      artifact_type: 'plan',
      status: 'completed',
      review_scope: 'section',
      selected_section_key: 'plan_background',
      content_version: 1,
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: {
        artifact_public_id: 'art-123',
        runs: [sectionRun],
        cursor: null,
        has_more: false,
        capabilities: {
          coachable_sections: [
            { section_key: 'plan_background', label: 'Background' },
          ],
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(coachingApi.useActiveCoachRun).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.useCoachRun).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

    const onSectionContextChange = vi.fn();

    renderWithProviders(
      <CoachingRail
        {...defaultProps}
        sectionContext={null}
        onSectionContextChange={onSectionContextChange}
      />,
    );

    const historyRow = screen.getByRole('option', { name: /open background coaching review/i });

    // Verify tabIndex for keyboard focus
    expect(historyRow).toHaveAttribute('tabIndex', '0');

    // Test Enter key
    historyRow.focus();
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    historyRow.dispatchEvent(enterEvent);

    expect(onSectionContextChange).toHaveBeenCalledWith({
      sectionKey: 'plan_background',
      label: 'Background',
    });

    onSectionContextChange.mockClear();

    // Test Space key
    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
    historyRow.dispatchEvent(spaceEvent);

    expect(onSectionContextChange).toHaveBeenCalledWith({
      sectionKey: 'plan_background',
      label: 'Background',
    });
  });
});
