/**
 * DISC-3 + NAV-1b: DiscoveryHub page tests.
 *
 * Tests for:
 * - Empty state (no discovery data)
 * - Loading state
 * - Error state
 * - Populated state with runs and artifacts
 * - Add evidence menu
 * - NAV-1b: Legacy ?type= redirects
 * - NAV-1b: No Overview flash during redirect
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { DiscoveryHub } from '../DiscoveryHub';

// Mock all the API hooks
vi.mock('@/api/queries/useStudy', () => ({
  useStudy: vi.fn(),
}));

vi.mock('@/api/queries/useDiscovery', () => ({
  useDiscoveryRuns: vi.fn(),
  useDiscoveryArtifacts: vi.fn(),
  useKnowledgeGaps: vi.fn(),
  useDiscoveryCounts: vi.fn(),
}));

// NAV-1b: Track navigate calls for redirect tests
const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => ({ studyPublicId: 'study-123' }),
    useSearchParams: () => [mockSearchParams],
    useNavigate: () => mockNavigate,
  };
});

// NAV-1a + NAV-1b: Mock workspace context (provides nav state + activeDiscoveryType)
vi.mock('@/components/study/workspace', async () => {
  const actual = await vi.importActual('@/components/study/workspace');
  return {
    ...actual,
    useStudyWorkspace: () => ({
      studyPublicId: 'study-123',
      projectPublicId: 'proj-456',
      studyName: 'Test Study',
      briefStatus: null,
      lifecycleNodes: [],
      discoveryCounts: undefined,
      activeDiscoveryType: null,
      setActiveDiscoveryType: vi.fn(),
      navOpen: false,
      openNav: vi.fn(),
      closeNav: vi.fn(),
      toggleNav: vi.fn(),
      isLoading: false,
      error: null,
    }),
  };
});

import { useStudy } from '@/api/queries/useStudy';
import {
  useDiscoveryRuns,
  useDiscoveryArtifacts,
  useKnowledgeGaps,
  useDiscoveryCounts,
} from '@/api/queries/useDiscovery';

const mockedUseStudy = vi.mocked(useStudy);
const mockedUseDiscoveryRuns = vi.mocked(useDiscoveryRuns);
const mockedUseDiscoveryArtifacts = vi.mocked(useDiscoveryArtifacts);
const mockedUseKnowledgeGaps = vi.mocked(useKnowledgeGaps);
const mockedUseDiscoveryCounts = vi.mocked(useDiscoveryCounts);

const mockStudy = {
  public_id: 'study-123',
  name: 'Test Study',
  project_public_id: 'proj-456',
  status: 'active',
};

const mockRuns = [
  {
    publicId: 'run-1',
    discoveryType: 'desk_research',
    topic: 'Accessibility Research',
    topicSlug: 'accessibility-research',
    status: 'completed',
    sourceCount: 3,
    createdAt: '2026-01-15T10:00:00Z',
    marker: 'D1',
    sourceIntent: null,
    stage: null,
    attemptCount: 1,
    startedAt: '2026-01-15T10:00:00Z',
    completedAt: '2026-01-15T10:05:00Z',
    createdBy: 'user-1',
    currentArtifactPublicId: 'art-1',
    failureCode: null,
    failureMessage: null,
  },
];

const mockArtifacts = [
  {
    publicId: 'art-1',
    runPublicId: 'run-1',
    artifactType: 'desk_research',
    title: 'Accessibility Research Analysis',
    topicSlug: 'accessibility-research',
    version: 1,
    status: 'current',
    templateName: 'desk_research',
    templateVersion: '1.0',
    createdAt: '2026-01-15T10:05:00Z',
    githubPath: null,
    projectedAt: null,
    marker: 'D1',
  },
];

const mockKnowledgeGaps = {
  projectId: 1,
  count: 2,
  gaps: [
    {
      gap: 'How do screen reader users navigate complex forms?',
      itemId: 'gap-001',
      sourceArtifactPublicId: 'art-1',
      sourceMarker: 'D1',
      discoveryType: 'desk_research' as const,
      sourceVariableKey: 'knowledge_gaps',
      extractedAt: '2026-01-15T10:05:00Z',
    },
  ],
};

const mockCounts = {
  desk: 1,
  stakeholder: 0,
  survey: 0,
  needsReview: {
    desk: false,
    stakeholder: false,
    survey: false,
  },
};

function setupMocks(overrides: {
  study?: typeof mockStudy | null;
  studyLoading?: boolean;
  studyError?: Error | null;
  runs?: typeof mockRuns;
  runsLoading?: boolean;
  artifacts?: typeof mockArtifacts;
  knowledgeGaps?: typeof mockKnowledgeGaps | null;
  counts?: typeof mockCounts | null;
} = {}) {
  mockedUseStudy.mockReturnValue({
    data: 'study' in overrides ? overrides.study : mockStudy,
    isLoading: overrides.studyLoading ?? false,
    error: overrides.studyError ?? null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useStudy>);

  mockedUseDiscoveryRuns.mockReturnValue({
    data: overrides.runs ?? mockRuns,
    isLoading: overrides.runsLoading ?? false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useDiscoveryRuns>);

  mockedUseDiscoveryArtifacts.mockReturnValue({
    data: overrides.artifacts ?? mockArtifacts,
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useDiscoveryArtifacts>);

  mockedUseKnowledgeGaps.mockReturnValue({
    data: overrides.knowledgeGaps ?? mockKnowledgeGaps,
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useKnowledgeGaps>);

  mockedUseDiscoveryCounts.mockReturnValue({
    data: overrides.counts ?? mockCounts,
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useDiscoveryCounts>);
}

describe('DiscoveryHub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockNavigate.mockClear();
  });

  // NAV-1a: Study loading errors are now handled by StudyWorkspaceLayout
  // DiscoveryHub uses workspace context which provides already-loaded study data
  // Error states for study loading should be tested at the layout level

  describe('empty state', () => {
    it('shows empty explainer when no discovery data exists', () => {
      setupMocks({ runs: [], artifacts: [], knowledgeGaps: null });
      renderWithProviders(<DiscoveryHub />);

      // HubEmptyExplainer shows "What do we already know?"
      expect(screen.getByText(/What do we already know/i)).toBeInTheDocument();
    });

    it('does not show empty state when runs exist', () => {
      setupMocks();
      renderWithProviders(<DiscoveryHub />);

      expect(screen.queryByText(/What do we already know/i)).not.toBeInTheDocument();
    });
  });

  describe('populated state', () => {
    it('renders study name in header', () => {
      setupMocks();
      renderWithProviders(<DiscoveryHub />);

      expect(screen.getByRole('heading', { name: 'Test Study' })).toBeInTheDocument();
    });

    it('shows Discovery eyebrow', () => {
      setupMocks();
      renderWithProviders(<DiscoveryHub />);

      // Use getAllByText since "Discovery" appears in multiple places (eyebrow and nav)
      const discoveryTexts = screen.getAllByText('Discovery');
      expect(discoveryTexts.length).toBeGreaterThan(0);
    });

    it('shows "Add evidence" button', () => {
      setupMocks();
      renderWithProviders(<DiscoveryHub />);

      expect(screen.getByRole('button', { name: /Add evidence/i })).toBeInTheDocument();
    });

    it('opens add evidence menu on click', async () => {
      const user = userEvent.setup();
      setupMocks();
      renderWithProviders(<DiscoveryHub />);

      const addButton = screen.getByRole('button', { name: /Add evidence/i });
      await user.click(addButton);

      expect(screen.getByRole('menuitem', { name: /Documents/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /Stakeholder material/i })).toBeInTheDocument();
    });
  });

  describe('discovery runs section', () => {
    it('renders discovery runs section', () => {
      setupMocks();
      renderWithProviders(<DiscoveryHub />);

      expect(screen.getByText(/Discovery runs/)).toBeInTheDocument();
    });

    it('shows run topic', () => {
      setupMocks();
      renderWithProviders(<DiscoveryHub />);

      expect(screen.getByText('Accessibility Research')).toBeInTheDocument();
    });
  });

  describe('knowledge gaps section', () => {
    it('shows knowledge gaps when present', () => {
      setupMocks();
      renderWithProviders(<DiscoveryHub />);

      expect(screen.getByText(/What we don't know yet/i)).toBeInTheDocument();
      expect(screen.getByText(/How do screen reader users navigate complex forms/i)).toBeInTheDocument();
    });

    it('does not show knowledge gaps section when empty', () => {
      setupMocks({ knowledgeGaps: { projectId: 1, count: 0, gaps: [] } });
      renderWithProviders(<DiscoveryHub />);

      expect(screen.queryByText(/What we don't know yet/i)).not.toBeInTheDocument();
    });
  });

  describe('into the brief section', () => {
    it('shows "Into the brief" section when discovery exists', () => {
      setupMocks();
      renderWithProviders(<DiscoveryHub />);

      expect(screen.getByText(/Into the brief/i)).toBeInTheDocument();
    });
  });

  /**
   * NAV-1b: Legacy ?type= redirect tests.
   *
   * Requirements:
   * - ?type=desk -> /discovery/desk
   * - ?type=stakeholder -> /discovery/stakeholders
   * - ?type=survey -> /discovery/surveys
   * - preserve unrelated query parameters
   * - no visible Overview flash (returns null during redirect)
   */
  describe('NAV-1b: legacy ?type= redirects', () => {
    it('redirects ?type=desk to /discovery/desk', () => {
      mockSearchParams = new URLSearchParams('type=desk');
      setupMocks();
      renderWithProviders(<DiscoveryHub />);

      expect(mockNavigate).toHaveBeenCalledWith(
        '/studies/study-123/discovery/desk',
        { replace: true },
      );
    });

    it('redirects ?type=stakeholder to /discovery/stakeholders', () => {
      mockSearchParams = new URLSearchParams('type=stakeholder');
      setupMocks();
      renderWithProviders(<DiscoveryHub />);

      expect(mockNavigate).toHaveBeenCalledWith(
        '/studies/study-123/discovery/stakeholders',
        { replace: true },
      );
    });

    it('redirects ?type=survey to /discovery/surveys', () => {
      mockSearchParams = new URLSearchParams('type=survey');
      setupMocks();
      renderWithProviders(<DiscoveryHub />);

      expect(mockNavigate).toHaveBeenCalledWith(
        '/studies/study-123/discovery/surveys',
        { replace: true },
      );
    });

    it('preserves unrelated query parameters during redirect', () => {
      mockSearchParams = new URLSearchParams('type=desk&foo=bar&baz=123');
      setupMocks();
      renderWithProviders(<DiscoveryHub />);

      expect(mockNavigate).toHaveBeenCalledWith(
        '/studies/study-123/discovery/desk?foo=bar&baz=123',
        { replace: true },
      );
    });

    it('renders nothing during legacy redirect (no Overview flash)', () => {
      mockSearchParams = new URLSearchParams('type=desk');
      setupMocks();
      const { container } = renderWithProviders(<DiscoveryHub />);

      // Should render nothing (null) during redirect
      expect(container.firstChild).toBeNull();
    });

    it('does not redirect when no ?type= param', () => {
      mockSearchParams = new URLSearchParams();
      setupMocks();
      renderWithProviders(<DiscoveryHub />);

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('does not redirect for unknown ?type= values', () => {
      mockSearchParams = new URLSearchParams('type=unknown');
      setupMocks();
      renderWithProviders(<DiscoveryHub />);

      expect(mockNavigate).not.toHaveBeenCalled();
      // Should render the Overview page normally
      expect(screen.getByRole('heading', { name: 'Test Study' })).toBeInTheDocument();
    });

    it('renders Overview content when no redirect needed', () => {
      mockSearchParams = new URLSearchParams();
      setupMocks();
      renderWithProviders(<DiscoveryHub />);

      // Should render the Overview page
      expect(screen.getByRole('heading', { name: 'Test Study' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add evidence/i })).toBeInTheDocument();
    });
  });
});
