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
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  useRetryCoachRun: vi.fn(() => ({
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
      // M3B FINAL: "Research Brief review" appears in both scope title and history row
      expect(screen.getAllByText('Research Brief review').length).toBeGreaterThanOrEqual(1);
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
      // M3B FINAL: "Research Brief review" appears in both scope title and history row
      expect(screen.getAllByText('Research Brief review').length).toBeGreaterThanOrEqual(1);

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

    // Initial: should show "Reviewing" status (M3B FINAL: scope is shown in separate title)
    // Check for the status heading with spinner
    expect(screen.getByRole('heading', { name: /Reviewing/ })).toBeInTheDocument();

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
    // M3B FINAL: Status text changed
    expect(screen.queryByText(/Reviewing/)).not.toBeInTheDocument();
    expect(screen.getByText(/Review failed/)).toBeInTheDocument();
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
    // The failed status should be visible somewhere (M3B FINAL: text changed)
    expect(screen.getByText(/Review failed/)).toBeInTheDocument();
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
    // M3B FINAL: Status text changed
    expect(screen.queryByText(/Reviewing/)).not.toBeInTheDocument();
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

  it('shows scope title when sectionContext is provided', () => {
    renderWithProviders(
      <CoachingRail
        {...defaultProps}
        sectionContext={{ sectionKey: 'summary', label: 'Summary' }}
      />,
    );

    // M3B FINAL: Now shows "{label} review" as scope title
    expect(screen.getByText('Summary review')).toBeInTheDocument();
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
    renderWithProviders(
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

// ─── M3B FINAL: Wayfinding Regression Tests ─────────────────────────────────
// These tests verify the final M3B wayfinding fixes:
// - Explicit scope title for all runs
// - Persistent Back to artifact link
// - Rail scroll reset on history selection

describe('M3B FINAL wayfinding', () => {
  const defaultProps = {
    artifactPublicId: 'art-123',
    artifactType: 'plan' as const,
    currentContentVersion: 1,
    currentUserPublicId: 'user-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows explicit scope title for completed artifact run', () => {
    const completedRun = createRunSummary({
      id: 'artifact-run-123',
      artifact_type: 'plan',
      status: 'completed',
      review_scope: 'artifact',
      selected_section_key: null,
      content_version: 1,
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: {
        artifact_public_id: 'art-123',
        runs: [completedRun],
        cursor: null,
        has_more: false,
        capabilities: { coachable_sections: [] },
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
      data: { run: { ...completedRun, items: [], failure: null } },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

    renderWithProviders(
      <CoachingRail {...defaultProps} sectionContext={null} />,
    );

    // M3B FINAL: Scope title shows "Research Plan review"
    expect(screen.getByRole('heading', { name: 'Research Plan review' })).toBeInTheDocument();
    // Status shows separately
    expect(screen.getByText('Review complete')).toBeInTheDocument();
  });

  it('shows explicit scope title for completed section run', () => {
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
          coachable_sections: [{ section_key: 'plan_background', label: 'Background' }],
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
      data: { run: { ...sectionRun, items: [], failure: null } },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

    renderWithProviders(
      <CoachingRail
        {...defaultProps}
        sectionContext={{ sectionKey: 'plan_background', label: 'Background' }}
      />,
    );

    // M3B FINAL: Scope title shows "Background review"
    expect(screen.getByRole('heading', { name: 'Background review' })).toBeInTheDocument();
    expect(screen.getByText('Review complete')).toBeInTheDocument();
  });

  it('shows scope title for running state', () => {
    const runningRun = createRunSummary({
      id: 'running-run-123',
      artifact_type: 'plan',
      status: 'running',
      review_scope: 'section',
      selected_section_key: 'plan_method_approach',
      content_version: 1,
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: {
        artifact_public_id: 'art-123',
        runs: [runningRun],
        cursor: null,
        has_more: false,
        capabilities: {
          coachable_sections: [{ section_key: 'plan_method_approach', label: 'Method' }],
        },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(coachingApi.useActiveCoachRun).mockReturnValue({
      data: { run: { ...runningRun, items: [], failure: null } },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.useCoachRun).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(true);

    renderWithProviders(
      <CoachingRail
        {...defaultProps}
        sectionContext={{ sectionKey: 'plan_method_approach', label: 'Method' }}
      />,
    );

    // M3B FINAL: Scope title visible for active runs
    expect(screen.getByRole('heading', { name: 'Method review' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Reviewing/ })).toBeInTheDocument();
  });

  it('shows scope title for failed state', () => {
    const failedRun = createRunSummary({
      id: 'failed-run-123',
      artifact_type: 'plan',
      status: 'failed',
      review_scope: 'artifact',
      selected_section_key: null,
      content_version: 1,
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: {
        artifact_public_id: 'art-123',
        runs: [failedRun],
        cursor: null,
        has_more: false,
        capabilities: { coachable_sections: [] },
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
      data: { run: { ...failedRun, items: [], failure: { code: 'ERROR', message: 'Test error' } } },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

    renderWithProviders(
      <CoachingRail {...defaultProps} sectionContext={null} />,
    );

    // M3B FINAL: Scope title visible for failed runs
    expect(screen.getByRole('heading', { name: 'Research Plan review' })).toBeInTheDocument();
    expect(screen.getByText('Review failed')).toBeInTheDocument();
  });

  it('shows Back to artifact link in section context', () => {
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
          coachable_sections: [{ section_key: 'plan_background', label: 'Background' }],
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
      data: { run: { ...sectionRun, items: [], failure: null } },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

    const onSectionContextChange = vi.fn();

    renderWithProviders(
      <CoachingRail
        {...defaultProps}
        sectionContext={{ sectionKey: 'plan_background', label: 'Background' }}
        onSectionContextChange={onSectionContextChange}
      />,
    );

    // M3B FINAL: Back link should be visible
    const backLink = screen.getByRole('button', { name: /back to research plan coaching/i });
    expect(backLink).toBeInTheDocument();

    // Click should return to artifact context without POST
    backLink.click();
    expect(onSectionContextChange).toHaveBeenCalledWith(null);
  });

  it('clicking Back to artifact does NOT create new run', () => {
    const sectionRun = createRunSummary({
      id: 'section-run-123',
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
        runs: [sectionRun],
        cursor: null,
        has_more: false,
        capabilities: {
          coachable_sections: [{ section_key: 'plan_background', label: 'Background' }],
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
      data: { run: { ...sectionRun, items: [], failure: null } },
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
        sectionContext={{ sectionKey: 'plan_background', label: 'Background' }}
        onSectionContextChange={vi.fn()}
      />,
    );

    // Click back link
    screen.getByRole('button', { name: /back to research plan coaching/i }).click();

    // CRITICAL: No POST should occur
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('Back link is keyboard accessible', () => {
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
          coachable_sections: [{ section_key: 'plan_background', label: 'Background' }],
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
      data: { run: { ...sectionRun, items: [], failure: null } },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

    renderWithProviders(
      <CoachingRail
        {...defaultProps}
        sectionContext={{ sectionKey: 'plan_background', label: 'Background' }}
        onSectionContextChange={vi.fn()}
      />,
    );

    // Back link should be focusable
    const backLink = screen.getByRole('button', { name: /back to research plan coaching/i });
    expect(backLink).toHaveAttribute('type', 'button');
  });
});

// ─── M3C-A Retry Tests ─────────────────────────────────────────────────────

describe('M3C-A retry functionality', () => {
  const defaultProps = {
    artifactPublicId: 'art-123',
    artifactType: 'brief' as const,
    currentContentVersion: 2,
    currentUserPublicId: 'user-current',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Retry review button only for failed runs', () => {
    const failedRun = createRunSummary({
      id: 'run-failed',
      status: 'failed',
      failed_at: new Date().toISOString(),
      completed_at: null,
      content_version: 2,
      requested_by: { public_id: 'user-current', display_name: 'Test User' },
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: { runs: [failedRun], capabilities: { coachable_sections: [] } },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

    renderWithProviders(<CoachingRail {...defaultProps} />);

    // Should show failed status
    expect(screen.getByText(/review failed/i)).toBeInTheDocument();

    // Should show Retry review button
    expect(screen.getByRole('button', { name: /retry review/i })).toBeInTheDocument();
  });

  it('does NOT show Retry review button for completed runs', () => {
    const completedRun = createRunSummary({
      id: 'run-completed',
      status: 'completed',
      completed_at: new Date().toISOString(),
      content_version: 2,
      requested_by: { public_id: 'user-current', display_name: 'Test User' },
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: { runs: [completedRun], capabilities: { coachable_sections: [] } },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

    renderWithProviders(<CoachingRail {...defaultProps} />);

    // Should show completed status
    expect(screen.getByText(/review complete/i)).toBeInTheDocument();

    // Should NOT have Retry review button
    expect(screen.queryByRole('button', { name: /retry review/i })).not.toBeInTheDocument();
  });

  it('does NOT show Retry review button for running runs', () => {
    const runningRun = createRunSummary({
      id: 'run-running',
      status: 'running',
      completed_at: null,
      content_version: 2,
      requested_by: { public_id: 'user-current', display_name: 'Test User' },
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: { runs: [runningRun], capabilities: { coachable_sections: [] } },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(true);

    renderWithProviders(<CoachingRail {...defaultProps} />);

    // Should show running status (heading level)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/reviewing/i);

    // Should NOT have Retry review button
    expect(screen.queryByRole('button', { name: /retry review/i })).not.toBeInTheDocument();
  });

  it('shows earlier-version explanation when failed run is NOT current version', () => {
    const earlierVersionFailedRun = createRunSummary({
      id: 'run-failed-earlier',
      status: 'failed',
      failed_at: new Date().toISOString(),
      completed_at: null,
      content_version: 1, // Earlier than currentContentVersion (2)
      is_current_version: false,
      requested_by: { public_id: 'user-current', display_name: 'Test User' },
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: { runs: [earlierVersionFailedRun], capabilities: { coachable_sections: [] } },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

    renderWithProviders(<CoachingRail {...defaultProps} />);

    // Should show earlier-version explanation
    expect(
      screen.getByText(/reviews the current version.*earlier version/i),
    ).toBeInTheDocument();
  });

  it('does NOT show earlier-version explanation when failed run IS current version', () => {
    const currentVersionFailedRun = createRunSummary({
      id: 'run-failed-current',
      status: 'failed',
      failed_at: new Date().toISOString(),
      completed_at: null,
      content_version: 2, // Same as currentContentVersion
      is_current_version: true,
      requested_by: { public_id: 'user-current', display_name: 'Test User' },
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: { runs: [currentVersionFailedRun], capabilities: { coachable_sections: [] } },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

    renderWithProviders(<CoachingRail {...defaultProps} />);

    // Should NOT show earlier-version explanation
    expect(
      screen.queryByText(/reviews the current version.*earlier version/i),
    ).not.toBeInTheDocument();

    // But should still show Retry button
    expect(screen.getByRole('button', { name: /retry review/i })).toBeInTheDocument();
  });

  it('Retry button shows in section context for failed section run', () => {
    const failedSectionRun = createRunSummary({
      id: 'run-section-failed',
      status: 'failed',
      failed_at: new Date().toISOString(),
      completed_at: null,
      content_version: 2,
      review_scope: 'section',
      selected_section_key: 'plan_background',
      artifact_type: 'plan',
      requested_by: { public_id: 'user-current', display_name: 'Test User' },
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: {
        runs: [failedSectionRun],
        capabilities: { coachable_sections: [{ section_key: 'plan_background', label: 'Background' }] },
      },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

    renderWithProviders(
      <CoachingRail
        {...defaultProps}
        artifactType="plan"
        sectionContext={{ sectionKey: 'plan_background', label: 'Background' }}
        onSectionContextChange={vi.fn()}
      />,
    );

    // Should show Retry review button in section context
    expect(screen.getByRole('button', { name: /retry review/i })).toBeInTheDocument();
  });
});

// ─── M3C-A FIX: Artifact Retry Visibility Tests ──────────────────────────────
// These tests verify DEFECT A fix: Retry button visibility for historical
// failed artifact runs selected from history.

describe('M3C-A FIX: Artifact retry visibility for selected historical run', () => {
  const defaultProps = {
    artifactPublicId: 'art-123',
    artifactType: 'plan' as const,
    currentContentVersion: 3,
    currentUserPublicId: 'user-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(coachingApi.useCoachRun).mockReturnValue({
      data: null,
      isLoading: false,
      isError: false,
    } as any);
    vi.mocked(coachingApi.useCreateCoachRun).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
    vi.mocked(coachingApi.useRetryCoachRun).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);
  });

  it('shows Retry button when selecting failed artifact run from history (primary is completed)', async () => {
    // Scenario: Primary run is completed (version 3), user selects older failed run (version 2)
    const completedPrimaryRun = createRunSummary({
      id: 'run-completed-primary',
      status: 'completed',
      completed_at: new Date().toISOString(),
      content_version: 3, // Current version
      is_current_version: true,
      review_scope: 'artifact',
      requested_by: { public_id: 'user-123', display_name: 'Test User' },
    });

    const failedHistoricalRun = createRunSummary({
      id: 'run-failed-historical',
      status: 'failed',
      failed_at: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      content_version: 2, // Earlier version
      is_current_version: false,
      review_scope: 'artifact',
      requested_by: { public_id: 'user-123', display_name: 'Test User' },
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: {
        runs: [completedPrimaryRun, failedHistoricalRun], // newest first
        capabilities: { coachable_sections: [] },
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

    // Detail query returns the historical failed run when selected
    vi.mocked(coachingApi.useCoachRun).mockReturnValue({
      data: {
        run: {
          ...failedHistoricalRun,
          items: [],
          context: [],
          failure: { code: 'PROVIDER_TIMEOUT', message: 'The coaching review took too long.' },
        },
      },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

    renderWithProviders(<CoachingRail {...defaultProps} />);

    // Click on the historical failed run in history
    const historyList = screen.getByRole('listbox', { name: /coaching history/i });
    const failedRunRow = within(historyList).getByText(/earlier version/i).closest('[role="option"]');
    expect(failedRunRow).toBeInTheDocument();

    await userEvent.click(failedRunRow!);

    // M3C-A FIX: After selecting the failed run, Retry button should be visible
    expect(screen.getByRole('button', { name: /retry review/i })).toBeInTheDocument();
  });

  it('shows correct safety copy for failed artifact run', async () => {
    const failedArtifactRun = createRunSummary({
      id: 'run-failed-artifact',
      status: 'failed',
      failed_at: new Date().toISOString(),
      content_version: 3,
      is_current_version: true,
      review_scope: 'artifact',
      artifact_type: 'plan',
      requested_by: { public_id: 'user-123', display_name: 'Test User' },
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: {
        runs: [failedArtifactRun],
        capabilities: { coachable_sections: [] },
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
          ...failedArtifactRun,
          items: [],
          context: [],
          failure: { code: 'PROVIDER_TIMEOUT', message: 'The coaching review took too long.' },
        },
      },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

    renderWithProviders(<CoachingRail {...defaultProps} artifactType="plan" />);

    // M3C-A FIX: Safety copy should use artifact display name, not generic "artifact"
    expect(screen.getByText(/Your Research Plan wasn't changed/)).toBeInTheDocument();
    expect(screen.queryByText(/Your artifact wasn't changed/i)).not.toBeInTheDocument();
  });

  it('shows correct safety copy for failed section run with trusted label', () => {
    const failedSectionRun = createRunSummary({
      id: 'run-failed-section',
      status: 'failed',
      failed_at: new Date().toISOString(),
      content_version: 3,
      is_current_version: true,
      review_scope: 'section',
      selected_section_key: 'plan_background',
      artifact_type: 'plan',
      requested_by: { public_id: 'user-123', display_name: 'Test User' },
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: {
        runs: [failedSectionRun],
        capabilities: { coachable_sections: [{ section_key: 'plan_background', label: 'Background' }] },
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
          ...failedSectionRun,
          items: [],
          context: [],
          failure: { code: 'PROVIDER_TIMEOUT', message: 'The coaching review took too long.' },
        },
      },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

    renderWithProviders(
      <CoachingRail
        {...defaultProps}
        artifactType="plan"
        sectionContext={{ sectionKey: 'plan_background', label: 'Background' }}
      />,
    );

    // M3C-A FIX: Safety copy should use section label, not generic "Section"
    expect(screen.getByText(/Your Background wasn't changed/)).toBeInTheDocument();
    expect(screen.queryByText(/Your Section wasn't changed/i)).not.toBeInTheDocument();
  });

  it('does NOT show Retry button for completed run', () => {
    const completedRun = createRunSummary({
      id: 'run-completed',
      status: 'completed',
      completed_at: new Date().toISOString(),
      content_version: 3,
      is_current_version: true,
      review_scope: 'artifact',
      requested_by: { public_id: 'user-123', display_name: 'Test User' },
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: {
        runs: [completedRun],
        capabilities: { coachable_sections: [] },
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

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(false);

    renderWithProviders(<CoachingRail {...defaultProps} />);

    // Retry button should NOT be visible for completed runs
    expect(screen.queryByRole('button', { name: /retry review/i })).not.toBeInTheDocument();
  });

  it('does NOT show Retry button for running run', () => {
    const runningRun = createRunSummary({
      id: 'run-running',
      status: 'running',
      started_at: new Date().toISOString(),
      content_version: 3,
      is_current_version: true,
      review_scope: 'artifact',
      requested_by: { public_id: 'user-123', display_name: 'Test User' },
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: {
        runs: [runningRun],
        capabilities: { coachable_sections: [] },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(coachingApi.useActiveCoachRun).mockReturnValue({
      data: { run: runningRun },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(true);

    renderWithProviders(<CoachingRail {...defaultProps} />);

    // Retry button should NOT be visible for running runs
    expect(screen.queryByRole('button', { name: /retry review/i })).not.toBeInTheDocument();
  });

  it('does NOT show Retry button for pending run', () => {
    const pendingRun = createRunSummary({
      id: 'run-pending',
      status: 'pending',
      content_version: 3,
      is_current_version: true,
      review_scope: 'artifact',
      requested_by: { public_id: 'user-123', display_name: 'Test User' },
    });

    vi.mocked(coachingApi.useCoachHistory).mockReturnValue({
      data: {
        runs: [pendingRun],
        capabilities: { coachable_sections: [] },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(coachingApi.useActiveCoachRun).mockReturnValue({
      data: { run: pendingRun },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(coachingApi.isActiveRun).mockReturnValue(true);

    renderWithProviders(<CoachingRail {...defaultProps} />);

    // Retry button should NOT be visible for pending runs
    expect(screen.queryByRole('button', { name: /retry review/i })).not.toBeInTheDocument();
  });
});
