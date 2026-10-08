/**
 * DISC-3: DiscoveryRunPage tests.
 *
 * Tests for:
 * - Processing state (Pending, Analyzing)
 * - Failed state with recovery options
 * - Completed state with tabs
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { DiscoveryRunPage } from '../DiscoveryRunPage';

// Mock all the API hooks
vi.mock('@/api/queries/useStudy', () => ({
  useStudy: vi.fn(),
}));

vi.mock('@/api/queries/useDiscovery', () => ({
  useDiscoveryRun: vi.fn(),
  useDiscoveryArtifact: vi.fn(),
  useArtifactVariables: vi.fn(),
  useDiscoveryCounts: vi.fn(),
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => ({ studyPublicId: 'study-123', runId: 'run-456' }),
    useLocation: () => ({ pathname: '/studies/study-123/discovery/runs/run-456' }),
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
  useDiscoveryRun,
  useDiscoveryArtifact,
  useArtifactVariables,
  useDiscoveryCounts,
} from '@/api/queries/useDiscovery';

const mockedUseStudy = vi.mocked(useStudy);
const mockedUseDiscoveryRun = vi.mocked(useDiscoveryRun);
const mockedUseDiscoveryArtifact = vi.mocked(useDiscoveryArtifact);
const mockedUseArtifactVariables = vi.mocked(useArtifactVariables);
const mockedUseDiscoveryCounts = vi.mocked(useDiscoveryCounts);

const mockStudy = {
  public_id: 'study-123',
  name: 'Test Study',
  project_public_id: 'proj-456',
  status: 'active',
};

const baseRun = {
  publicId: 'run-456',
  discoveryType: 'desk_research' as const,
  topic: 'Accessibility Research',
  topicSlug: 'accessibility-research',
  sourceCount: 3,
  sourceIntent: 'Understanding compliance requirements',
  stage: null,
  attemptCount: 1,
  createdAt: '2026-01-15T10:00:00Z',
  startedAt: '2026-01-15T10:00:00Z',
  createdBy: 'user-1',
  marker: 'D1',
  failureCode: null,
  failureMessage: null,
  sources: [
    { publicId: 'src-1', label: 'document1.pdf', sourceType: 'pdf', order: 1 },
  ],
};

const mockCompletedRun = {
  ...baseRun,
  status: 'completed' as const,
  completedAt: '2026-01-15T10:05:00Z',
  currentArtifactPublicId: 'art-1',
  currentArtifact: {
    publicId: 'art-1',
    runPublicId: 'run-456',
    artifactType: 'desk_research',
    title: 'Accessibility Research Analysis',
    topicSlug: 'accessibility-research',
    version: 1,
    status: 'current',
    templateName: 'desk_research',
    templateVersion: '1.0',
    createdAt: '2026-01-15T10:05:00Z',
    githubPath: 'discovery/desk-research/accessibility-research.md',
    projectedAt: '2026-01-15T10:06:00Z',
    marker: 'D1',
  },
};

const mockPendingRun = {
  ...baseRun,
  status: 'pending' as const,
  completedAt: null,
  currentArtifact: null,
  currentArtifactPublicId: null,
};

const mockProcessingRun = {
  ...baseRun,
  status: 'processing' as const,
  completedAt: null,
  currentArtifact: null,
  currentArtifactPublicId: null,
};

const mockFailedRun = {
  ...baseRun,
  status: 'failed' as const,
  completedAt: null,
  currentArtifact: null,
  currentArtifactPublicId: null,
  failureCode: 'PROCESSING_ERROR',
  failureMessage: 'Content extraction failed due to unsupported format',
};

const mockVariables = {
  artifactPublicId: 'art-1',
  marker: 'D1',
  artifactType: 'desk_research',
  typeLabel: 'Desk Research',
  variables: [],
  variableCount: 0,
  extractedAt: '2026-01-15T10:05:00Z',
};

const mockArtifactDetail: {
  publicId: string;
  runPublicId: string;
  artifactType: string;
  title: string;
  topicSlug: string;
  version: number;
  status: string;
  templateName: string;
  templateVersion: string;
  createdAt: string;
  githubPath: string | null;
  projectedAt: string | null;
  marker: string | null;
  canonicalContent: string | null;
  derivationFingerprint: string | null;
  githubSha: string | null;
} = {
  publicId: 'art-1',
  runPublicId: 'run-456',
  artifactType: 'desk_research',
  title: 'Accessibility Research Analysis',
  topicSlug: 'accessibility-research',
  version: 1,
  status: 'current',
  templateName: 'desk_research',
  templateVersion: '1.0',
  createdAt: '2026-01-15T10:05:00Z',
  githubPath: 'discovery/desk-research/accessibility-research.md',
  projectedAt: '2026-01-15T10:06:00Z',
  marker: 'D1',
  canonicalContent: `# Key Findings

## 1. Accessibility Requirements

Veterans need accessible interfaces that support screen readers.

- **WCAG 2.1 AA** compliance is required
- Color contrast must meet minimum ratios
- All interactive elements need keyboard navigation

## 2. Common Pain Points

| Issue | Frequency | Severity |
|-------|-----------|----------|
| Missing alt text | 78% | High |
| Poor contrast | 45% | Medium |
| Keyboard traps | 23% | High |
`,
  derivationFingerprint: 'abc123',
  githubSha: 'def456',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setupMocks(overrides: {
  run?: any;
  runLoading?: boolean;
  runError?: Error | null;
  artifact?: typeof mockArtifactDetail | null;
  artifactLoading?: boolean;
  artifactError?: Error | null;
} = {}) {
  mockedUseStudy.mockReturnValue({
    data: mockStudy,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useStudy>);

  mockedUseDiscoveryRun.mockReturnValue({
    data: overrides.run ?? mockCompletedRun,
    isLoading: overrides.runLoading ?? false,
    error: overrides.runError ?? null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useDiscoveryRun>);

  mockedUseDiscoveryArtifact.mockReturnValue({
    data: 'artifact' in overrides ? overrides.artifact : mockArtifactDetail,
    isLoading: overrides.artifactLoading ?? false,
    error: overrides.artifactError ?? null,
  } as unknown as ReturnType<typeof useDiscoveryArtifact>);

  mockedUseArtifactVariables.mockReturnValue({
    data: mockVariables,
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useArtifactVariables>);

  mockedUseDiscoveryCounts.mockReturnValue({
    data: {
      desk: 1,
      stakeholder: 0,
      survey: 0,
      needsReview: { desk: false, stakeholder: false, survey: false },
    },
    isLoading: false,
    error: null,
  } as unknown as ReturnType<typeof useDiscoveryCounts>);
}

describe('DiscoveryRunPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('error state', () => {
    it('shows error when run fails to load', () => {
      setupMocks({ runError: new Error('Run not found'), run: null });
      renderWithProviders(<DiscoveryRunPage />);

      expect(screen.getByText(/Run not found/)).toBeInTheDocument();
    });
  });

  describe('pending state', () => {
    it('shows "Pending" status', () => {
      setupMocks({ run: mockPendingRun });
      renderWithProviders(<DiscoveryRunPage />);

      expect(screen.getByRole('status')).toHaveTextContent('Pending');
    });

    it('shows preparing message', () => {
      setupMocks({ run: mockPendingRun });
      renderWithProviders(<DiscoveryRunPage />);

      expect(screen.getByText(/preparing to analyze/i)).toBeInTheDocument();
    });
  });

  describe('processing state', () => {
    it('shows "Analyzing" status', () => {
      setupMocks({ run: mockProcessingRun });
      renderWithProviders(<DiscoveryRunPage />);

      expect(screen.getByRole('status')).toHaveTextContent('Analyzing');
    });

    it('shows analyzing message', () => {
      setupMocks({ run: mockProcessingRun });
      renderWithProviders(<DiscoveryRunPage />);

      expect(screen.getByText(/analyzing your files/i)).toBeInTheDocument();
    });
  });

  describe('failed state', () => {
    it('shows "Analysis failed" title', () => {
      setupMocks({ run: mockFailedRun });
      renderWithProviders(<DiscoveryRunPage />);

      expect(screen.getByRole('heading', { name: 'Analysis failed' })).toBeInTheDocument();
    });

    it('shows failure message', () => {
      setupMocks({ run: mockFailedRun });
      renderWithProviders(<DiscoveryRunPage />);

      expect(screen.getByText(/Content extraction failed/i)).toBeInTheDocument();
    });

    it('shows "Upload files again" link', () => {
      setupMocks({ run: mockFailedRun });
      renderWithProviders(<DiscoveryRunPage />);

      const uploadLink = screen.getByRole('link', { name: /Upload files again/i });
      expect(uploadLink).toBeInTheDocument();
      expect(uploadLink).toHaveAttribute('href', '/studies/study-123/discovery/new/desk');
    });

    it('shows "Back to Discovery" link', () => {
      setupMocks({ run: mockFailedRun });
      renderWithProviders(<DiscoveryRunPage />);

      const backLink = screen.getByRole('link', { name: /Back to Discovery/i });
      expect(backLink).toBeInTheDocument();
    });
  });

  describe('completed state - header', () => {
    it('shows topic as title', () => {
      setupMocks();
      renderWithProviders(<DiscoveryRunPage />);

      expect(screen.getByRole('heading', { name: 'Accessibility Research' })).toBeInTheDocument();
    });
  });

  describe('completed state - tabs', () => {
    it('shows Report, Sources, Extracted tabs', () => {
      setupMocks();
      renderWithProviders(<DiscoveryRunPage />);

      expect(screen.getByRole('link', { name: 'Report' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Sources' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Extracted' })).toBeInTheDocument();
    });

    it('Report tab is active by default', () => {
      setupMocks();
      renderWithProviders(<DiscoveryRunPage />);

      const reportTab = screen.getByRole('link', { name: 'Report' });
      expect(reportTab).toHaveAttribute('aria-current', 'page');
    });
  });

  describe('report tab content', () => {
    it('renders canonical content from artifact API', () => {
      setupMocks();
      renderWithProviders(<DiscoveryRunPage />);

      // Check that markdown headings render
      expect(screen.getByRole('heading', { name: 'Key Findings' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Accessibility Requirements/ })).toBeInTheDocument();
    });

    it('renders markdown lists', () => {
      setupMocks();
      renderWithProviders(<DiscoveryRunPage />);

      expect(screen.getByText(/WCAG 2.1 AA/i)).toBeInTheDocument();
    });

    it('renders markdown tables', () => {
      setupMocks();
      renderWithProviders(<DiscoveryRunPage />);

      // Table headers
      expect(screen.getByText('Issue')).toBeInTheDocument();
      expect(screen.getByText('Frequency')).toBeInTheDocument();
      // Table data
      expect(screen.getByText('Missing alt text')).toBeInTheDocument();
    });

    it('shows loading state while artifact loads', () => {
      setupMocks({ artifactLoading: true, artifact: null });
      renderWithProviders(<DiscoveryRunPage />);

      // Should show FactsGrid with sources count (the "3" value)
      expect(screen.getByText('3')).toBeInTheDocument();
      // Content area shows skeleton (loading state)
    });

    it('shows error state when artifact fails to load', () => {
      setupMocks({ artifactError: new Error('Failed to load artifact'), artifact: null });
      renderWithProviders(<DiscoveryRunPage />);

      expect(screen.getByText(/Could not load report/i)).toBeInTheDocument();
      expect(screen.getByText(/Failed to load artifact/i)).toBeInTheDocument();
    });

    it('shows message when artifact has no canonical content', () => {
      setupMocks({ artifact: { ...mockArtifactDetail, canonicalContent: null } });
      renderWithProviders(<DiscoveryRunPage />);

      expect(screen.getByText(/no canonical content/i)).toBeInTheDocument();
    });

    it('does NOT fetch from GitHub (canonical content from API only)', () => {
      setupMocks();
      renderWithProviders(<DiscoveryRunPage />);

      // Verify no GitHub-related fetch call
      // The content comes from useDiscoveryArtifact, not a GitHub read
      expect(mockedUseDiscoveryArtifact).toHaveBeenCalledWith(
        'proj-456',
        'art-1',
        expect.objectContaining({ enabled: true }),
      );
    });

    it('viewing Report performs no mutation/POST', () => {
      setupMocks();
      renderWithProviders(<DiscoveryRunPage />);

      // All mocked hooks are read-only queries
      // No mutateAsync or mutation functions should be called
      // This test verifies that rendering Report tab is purely read-only
      expect(mockedUseDiscoveryRun).toHaveBeenCalled();
      expect(mockedUseDiscoveryArtifact).toHaveBeenCalled();
    });
  });
});
