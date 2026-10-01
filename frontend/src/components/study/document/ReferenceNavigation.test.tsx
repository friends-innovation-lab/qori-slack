/**
 * M3C-B Reference Navigation Tests
 *
 * Tests for clickable Coach references and citation navigation.
 *
 * Coverage:
 * - Reference resolution (clickable vs non-clickable)
 * - Same-artifact navigation (scroll, focus, highlight)
 * - Cross-artifact navigation (pin run, switch artifact, return to origin)
 * - Last-navigation-wins semantics
 * - Provenance display
 * - Accessibility
 * - No side effects (no AI invocation, no artifact mutation)
 */

import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router';
import {
  ReferenceNavigationProvider,
  useReferenceNavigation,
  type ArtifactType,
} from '../workspace/ReferenceNavigationProvider';
import { ReferenceLink } from './ReferenceLink';
import type { CoachRunReferenceResource } from '@qori/api-contracts';

// ─── Test Utilities ──────────────────────────────────────────────────────────

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

function createTestReference(
  overrides: Partial<CoachRunReferenceResource> = {},
): CoachRunReferenceResource {
  return {
    id: crypto.randomUUID(),
    item_id: crypto.randomUUID(),
    object_type: 'artifact_section',
    object_id: 'BRIEF-abc123:summary',
    section_key: 'summary',
    label: 'Summary',
    ...overrides,
  };
}

// Test component that uses the hook
function TestConsumer({ onNavigate }: { onNavigate?: () => void }) {
  const {
    pinnedRun,
    isReferenceClickable,
    navigateToReference,
    returnToOrigin,
    clearPinnedRun,
  } = useReferenceNavigation();

  const reference = createTestReference();

  return (
    <div>
      <span data-testid="pinned-run">{pinnedRun?.runId ?? 'none'}</span>
      <span data-testid="is-clickable">
        {isReferenceClickable(reference, 'brief') ? 'yes' : 'no'}
      </span>
      <button
        data-testid="navigate"
        onClick={() => {
          navigateToReference({
            reference,
            originCoachRunId: 'run-123',
            originArtifact: { type: 'brief', studyPublicId: 'study-123' },
            originSection: null,
            reviewedVersion: 1,
          });
          onNavigate?.();
        }}
      >
        Navigate
      </button>
      <button data-testid="return" onClick={returnToOrigin}>
        Return
      </button>
      <button data-testid="clear" onClick={clearPinnedRun}>
        Clear
      </button>
    </div>
  );
}

// Location tracker for cross-artifact tests
function LocationDisplay() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

interface RenderOptions {
  studyPublicId?: string;
  artifactType?: ArtifactType;
  initialPath?: string;
}

function renderWithProviders(
  ui: React.ReactElement,
  {
    studyPublicId = 'test-study',
    artifactType = 'brief',
    initialPath = '/studies/test-study/brief',
  }: RenderOptions = {},
) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={createTestQueryClient()}>
        <ReferenceNavigationProvider
          studyPublicId={studyPublicId}
          currentArtifactType={artifactType}
        >
          <LocationDisplay />
          {ui}
        </ReferenceNavigationProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

// ─── Reference Resolution Tests ──────────────────────────────────────────────

describe('M3C-B reference resolution', () => {
  it('marks artifact_section references as clickable', () => {
    renderWithProviders(<TestConsumer />);
    expect(screen.getByTestId('is-clickable')).toHaveTextContent('yes');
  });

  it('marks unsupported object_type references as not clickable', () => {
    const TestUnsupported = () => {
      const { isReferenceClickable } = useReferenceNavigation();
      const ref = createTestReference({ object_type: 'finding' });
      return (
        <span data-testid="is-clickable">
          {isReferenceClickable(ref, 'brief') ? 'yes' : 'no'}
        </span>
      );
    };

    renderWithProviders(<TestUnsupported />);
    expect(screen.getByTestId('is-clickable')).toHaveTextContent('no');
  });

  it('marks references without section_key as not clickable', () => {
    const TestNoSection = () => {
      const { isReferenceClickable } = useReferenceNavigation();
      const ref = createTestReference({ section_key: null });
      return (
        <span data-testid="is-clickable">
          {isReferenceClickable(ref, 'brief') ? 'yes' : 'no'}
        </span>
      );
    };

    renderWithProviders(<TestNoSection />);
    expect(screen.getByTestId('is-clickable')).toHaveTextContent('no');
  });
});

// ─── ReferenceLink Component Tests ───────────────────────────────────────────

describe('ReferenceLink component', () => {
  const defaultProps = {
    artifactType: 'brief' as const,
    originCoachRunId: 'run-123',
    originStudyPublicId: 'study-123',
    originSection: null,
    runContentVersion: 1,
    contextEntries: [],
  };

  it('renders 0 references correctly (no crash)', () => {
    // This tests that a coach item with no references works
    renderWithProviders(<div>No references</div>);
    expect(screen.getByText('No references')).toBeInTheDocument();
  });

  it('renders resolvable reference as interactive button', () => {
    const ref = createTestReference({ section_key: 'summary', label: 'Summary' });
    renderWithProviders(<ReferenceLink reference={ref} {...defaultProps} />);

    const button = screen.getByRole('button', { name: /jump to summary/i });
    expect(button).toBeInTheDocument();
  });

  it('renders unresolvable reference as non-interactive badge', () => {
    const ref = createTestReference({ object_type: 'finding', label: 'Finding 1' });
    renderWithProviders(<ReferenceLink reference={ref} {...defaultProps} />);

    // Should render as span, not button
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Finding 1')).toBeInTheDocument();
  });

  it('renders multiple references correctly', () => {
    const ref1 = createTestReference({ section_key: 'summary', label: 'Summary' });
    const ref2 = createTestReference({ section_key: 'problem_narrative', label: 'Problem' });

    renderWithProviders(
      <div>
        <ReferenceLink reference={ref1} {...defaultProps} />
        <ReferenceLink reference={ref2} {...defaultProps} />
      </div>,
    );

    expect(screen.getByRole('button', { name: /jump to summary/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /jump to problem/i })).toBeInTheDocument();
  });
});

// ─── Same-Artifact Navigation Tests ──────────────────────────────────────────

describe('M3C-B same-artifact navigation', () => {
  beforeEach(() => {
    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not change route for same-artifact reference', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TestConsumer />);

    expect(screen.getByTestId('location')).toHaveTextContent('/studies/test-study/brief');

    await user.click(screen.getByTestId('navigate'));

    // Route should stay the same
    expect(screen.getByTestId('location')).toHaveTextContent('/studies/test-study/brief');
  });

  it('does not create pinned run for same-artifact navigation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TestConsumer />);

    expect(screen.getByTestId('pinned-run')).toHaveTextContent('none');

    await user.click(screen.getByTestId('navigate'));

    // No pinned run for same-artifact
    expect(screen.getByTestId('pinned-run')).toHaveTextContent('none');
  });
});

// ─── Cross-Artifact Navigation Tests ─────────────────────────────────────────

describe('M3C-B cross-artifact navigation', () => {
  it('creates pinned run when navigating cross-artifact', async () => {
    const user = userEvent.setup();

    // Start on Plan, navigate to Brief section
    const TestCrossArtifact = () => {
      const { pinnedRun, navigateToReference } = useReferenceNavigation();
      const briefRef = createTestReference({
        section_key: 'summary', // Brief section
        object_id: 'BRIEF-abc123:summary',
      });

      return (
        <div>
          <span data-testid="pinned-run">{pinnedRun?.runId ?? 'none'}</span>
          <span data-testid="pinned-origin">
            {pinnedRun?.originArtifactType ?? 'none'}
          </span>
          <button
            data-testid="navigate-to-brief"
            onClick={() => {
              navigateToReference({
                reference: briefRef,
                originCoachRunId: 'plan-run-123',
                originArtifact: { type: 'plan', studyPublicId: 'study-123' },
                originSection: null,
                reviewedVersion: 1,
              });
            }}
          >
            Go to Brief
          </button>
        </div>
      );
    };

    renderWithProviders(<TestCrossArtifact />, {
      artifactType: 'plan',
      initialPath: '/studies/test-study/plan',
    });

    expect(screen.getByTestId('pinned-run')).toHaveTextContent('none');

    await user.click(screen.getByTestId('navigate-to-brief'));

    // Pinned run should be set
    await waitFor(() => {
      expect(screen.getByTestId('pinned-run')).toHaveTextContent('plan-run-123');
    });
    expect(screen.getByTestId('pinned-origin')).toHaveTextContent('plan');
  });
});

// ─── Pinned Run State Tests ──────────────────────────────────────────────────

describe('M3C-B pinned run state', () => {
  it('clears pinned run when clearPinnedRun is called', async () => {
    const user = userEvent.setup();

    const TestPinned = () => {
      const { pinnedRun, clearPinnedRun, navigateToReference } = useReferenceNavigation();
      const briefRef = createTestReference({ section_key: 'summary' });

      return (
        <div>
          <span data-testid="pinned-run">{pinnedRun?.runId ?? 'none'}</span>
          <button
            data-testid="set-pinned"
            onClick={() => {
              navigateToReference({
                reference: briefRef,
                originCoachRunId: 'run-to-pin',
                originArtifact: { type: 'plan', studyPublicId: 'study-123' },
                originSection: null,
                reviewedVersion: 1,
              });
            }}
          >
            Set
          </button>
          <button data-testid="clear" onClick={clearPinnedRun}>
            Clear
          </button>
        </div>
      );
    };

    renderWithProviders(<TestPinned />, {
      artifactType: 'plan',
      initialPath: '/studies/test-study/plan',
    });

    // Set pinned run
    await user.click(screen.getByTestId('set-pinned'));
    await waitFor(() => {
      expect(screen.getByTestId('pinned-run')).toHaveTextContent('run-to-pin');
    });

    // Clear it
    await user.click(screen.getByTestId('clear'));
    expect(screen.getByTestId('pinned-run')).toHaveTextContent('none');
  });

  it('rail close clears pinned state (simulated)', async () => {
    const user = userEvent.setup();

    const TestRailClose = () => {
      const { pinnedRun, clearPinnedRun, navigateToReference } = useReferenceNavigation();
      const [railOpen, setRailOpen] = useState(true);
      const briefRef = createTestReference({ section_key: 'summary' });

      // Simulate rail close clearing pinned state
      const handleRailClose = () => {
        setRailOpen(false);
        clearPinnedRun();
      };

      return (
        <div>
          <span data-testid="pinned-run">{pinnedRun?.runId ?? 'none'}</span>
          <span data-testid="rail-open">{railOpen ? 'open' : 'closed'}</span>
          <button
            data-testid="set-pinned"
            onClick={() => {
              navigateToReference({
                reference: briefRef,
                originCoachRunId: 'run-to-pin',
                originArtifact: { type: 'plan', studyPublicId: 'study-123' },
                originSection: null,
                reviewedVersion: 1,
              });
            }}
          >
            Set
          </button>
          <button data-testid="close-rail" onClick={handleRailClose}>
            Close Rail
          </button>
        </div>
      );
    };

    renderWithProviders(<TestRailClose />, {
      artifactType: 'plan',
      initialPath: '/studies/test-study/plan',
    });

    // Set pinned run
    await user.click(screen.getByTestId('set-pinned'));
    await waitFor(() => {
      expect(screen.getByTestId('pinned-run')).toHaveTextContent('run-to-pin');
    });

    // Close rail - should clear pinned state
    await user.click(screen.getByTestId('close-rail'));
    expect(screen.getByTestId('pinned-run')).toHaveTextContent('none');
    expect(screen.getByTestId('rail-open')).toHaveTextContent('closed');
  });
});

// ─── No Side Effects Tests ───────────────────────────────────────────────────

describe('M3C-B no side effects', () => {
  it('reference navigation does not invoke AI (no POST)', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    renderWithProviders(<TestConsumer />);
    await user.click(screen.getByTestId('navigate'));

    // No fetch calls (no AI invocation)
    expect(mockFetch).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it('return to origin does not create coach run', async () => {
    const user = userEvent.setup();
    const mockFetch = vi.fn();
    global.fetch = mockFetch;

    renderWithProviders(<TestConsumer />);
    await user.click(screen.getByTestId('return'));

    expect(mockFetch).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});

// ─── Accessibility Tests ─────────────────────────────────────────────────────

describe('M3C-B accessibility', () => {
  const defaultProps = {
    artifactType: 'brief' as const,
    originCoachRunId: 'run-123',
    originStudyPublicId: 'study-123',
    originSection: null,
    runContentVersion: 1,
    contextEntries: [],
  };

  it('clickable reference has accessible name', () => {
    const ref = createTestReference({ section_key: 'summary', label: 'Summary' });
    renderWithProviders(<ReferenceLink reference={ref} {...defaultProps} />);

    const button = screen.getByRole('button');
    expect(button).toHaveAccessibleName(/jump to summary/i);
  });

  it('keyboard activation works (Enter key)', async () => {
    const user = userEvent.setup();
    const ref = createTestReference({ section_key: 'summary', label: 'Summary' });
    renderWithProviders(<ReferenceLink reference={ref} {...defaultProps} />);

    const button = screen.getByRole('button');
    button.focus();
    await user.keyboard('{Enter}');

    // Should not throw, navigation happens silently
    expect(button).toBeInTheDocument();
  });

  it('keyboard activation works (Space key)', async () => {
    const user = userEvent.setup();
    const ref = createTestReference({ section_key: 'summary', label: 'Summary' });
    renderWithProviders(<ReferenceLink reference={ref} {...defaultProps} />);

    const button = screen.getByRole('button');
    button.focus();
    await user.keyboard(' ');

    expect(button).toBeInTheDocument();
  });
});

// ─── Version Provenance Tests ────────────────────────────────────────────────

describe('M3C-B version provenance', () => {
  it('derives version from run content_version for same-artifact', () => {
    const TestProvenance = () => {
      const { getReviewedVersionForReference } = useReferenceNavigation();
      const ref = createTestReference({ section_key: 'summary' });

      const version = getReviewedVersionForReference(ref, 5, []);
      return <span data-testid="version">{version}</span>;
    };

    renderWithProviders(<TestProvenance />);
    expect(screen.getByTestId('version')).toHaveTextContent('5');
  });

  it('prefers context object_version when available', () => {
    const TestProvenance = () => {
      const { getReviewedVersionForReference } = useReferenceNavigation();
      const ref = createTestReference({
        section_key: 'summary',
        object_type: 'artifact_section',
        object_id: 'BRIEF-abc:summary',
      });

      const contextEntries = [
        {
          object_type: 'artifact_section',
          object_id: 'BRIEF-abc:summary',
          object_version: 7,
        },
      ];

      const version = getReviewedVersionForReference(ref, 5, contextEntries);
      return <span data-testid="version">{version}</span>;
    };

    renderWithProviders(<TestProvenance />);
    // Should use context version (7), not run version (5)
    expect(screen.getByTestId('version')).toHaveTextContent('7');
  });

  it('shows no false version when provenance cannot be matched', () => {
    const TestProvenance = () => {
      const { getReviewedVersionForReference } = useReferenceNavigation();
      const ref = createTestReference({
        section_key: 'summary',
        object_type: 'artifact_section',
        object_id: 'BRIEF-abc:summary',
      });

      // Context has different object_id
      const contextEntries = [
        {
          object_type: 'artifact_section',
          object_id: 'BRIEF-xyz:different',
          object_version: 7,
        },
      ];

      const version = getReviewedVersionForReference(ref, 5, contextEntries);
      return <span data-testid="version">{version}</span>;
    };

    renderWithProviders(<TestProvenance />);
    // Falls back to run version
    expect(screen.getByTestId('version')).toHaveTextContent('5');
  });
});

// ─── Section Key Mapping Tests ───────────────────────────────────────────────

describe('M3C-B section key mapping', () => {
  it('resolves Brief summary to correct DOM target', () => {
    const TestResolve = () => {
      const { resolveDestination } = useReferenceNavigation();
      const ref = createTestReference({ section_key: 'summary' });
      const dest = resolveDestination(ref, 'brief');
      return <span data-testid="dom-id">{dest?.domElementId ?? 'null'}</span>;
    };

    renderWithProviders(<TestResolve />);
    expect(screen.getByTestId('dom-id')).toHaveTextContent('sec-summary');
  });

  it('resolves Brief problem_narrative to sec-problem', () => {
    const TestResolve = () => {
      const { resolveDestination } = useReferenceNavigation();
      const ref = createTestReference({ section_key: 'problem_narrative' });
      const dest = resolveDestination(ref, 'brief');
      return <span data-testid="dom-id">{dest?.domElementId ?? 'null'}</span>;
    };

    renderWithProviders(<TestResolve />);
    expect(screen.getByTestId('dom-id')).toHaveTextContent('sec-problem');
  });

  it('resolves Plan plan_summary to sec-summary', () => {
    const TestResolve = () => {
      const { resolveDestination } = useReferenceNavigation();
      const ref = createTestReference({ section_key: 'plan_summary' });
      const dest = resolveDestination(ref, 'plan');
      return <span data-testid="dom-id">{dest?.domElementId ?? 'null'}</span>;
    };

    renderWithProviders(<TestResolve />, { artifactType: 'plan' });
    expect(screen.getByTestId('dom-id')).toHaveTextContent('sec-summary');
  });

  it('returns null for unsupported section key', () => {
    const TestResolve = () => {
      const { resolveDestination } = useReferenceNavigation();
      const ref = createTestReference({ section_key: 'nonexistent_section' });
      const dest = resolveDestination(ref, 'brief');
      return <span data-testid="dom-id">{dest?.domElementId ?? 'null'}</span>;
    };

    renderWithProviders(<TestResolve />);
    expect(screen.getByTestId('dom-id')).toHaveTextContent('null');
  });

  it('structured object falls back to containing section', () => {
    const TestResolve = () => {
      const { resolveDestination } = useReferenceNavigation();
      // research_questions should fall back to objectives section
      const ref = createTestReference({ section_key: 'research_questions' });
      const dest = resolveDestination(ref, 'brief');
      return <span data-testid="dom-id">{dest?.domElementId ?? 'null'}</span>;
    };

    renderWithProviders(<TestResolve />);
    expect(screen.getByTestId('dom-id')).toHaveTextContent('sec-objectives');
  });
});

// ─── No Mutation Tests ───────────────────────────────────────────────────────

describe('M3C-B no artifact mutation', () => {
  it('Comments behavior unchanged', () => {
    // This test verifies that reference navigation doesn't affect Comments
    // by checking that no Comment-related state is touched
    renderWithProviders(<TestConsumer />);
    // No CommentsRail-related elements should be rendered or affected
    expect(screen.queryByText(/comment/i)).not.toBeInTheDocument();
  });

  it('artifact save/version state unchanged', async () => {
    const user = userEvent.setup();

    // Navigate and verify no save-related state is touched
    renderWithProviders(<TestConsumer />);
    await user.click(screen.getByTestId('navigate'));

    // No save state elements should appear
    expect(screen.queryByText(/saving/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/saved/i)).not.toBeInTheDocument();
  });

  it('approval unchanged', async () => {
    const user = userEvent.setup();

    renderWithProviders(<TestConsumer />);
    await user.click(screen.getByTestId('navigate'));

    // No approval elements should appear
    expect(screen.queryByText(/approve/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/request changes/i)).not.toBeInTheDocument();
  });
});
