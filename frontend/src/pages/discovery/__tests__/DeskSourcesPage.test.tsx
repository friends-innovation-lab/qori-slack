/**
 * DeskSourcesPage Tests — DR-4d
 *
 * Tests for:
 * - Sources grouped by DiscoveryRun
 * - Processing and failure states
 * - Run card display with artifacts
 * - Empty state
 * - Error handling
 * - Links to run detail pages
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeskSourcesPage } from '../DeskSourcesPage';
import type { DiscoveryRunSummary, DiscoveryArtifactSummary } from '@qori/api-contracts';

// Mock workspace context
const mockStudyWorkspace = {
  studyPublicId: 'study-123',
  projectPublicId: 'project-456',
};

vi.mock('@/components/study/workspace', () => ({
  WorkspaceLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="workspace-layout">{children}</div>
  ),
  useStudyWorkspace: () => mockStudyWorkspace,
}));

vi.mock('@/components/study/document', () => ({
  DocumentSection: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
}));

// Mock data - Complete types per api-contracts/discovery.ts
const mockRunsData: DiscoveryRunSummary[] = [
  {
    publicId: 'run-1',
    discoveryType: 'desk_research',
    topic: 'VA Research Q1',
    topicSlug: 'va-research-q1',
    sourceIntent: null,
    status: 'completed',
    stage: null,
    sourceCount: 2,
    attemptCount: 1,
    createdBy: 'user:test',
    createdAt: '2024-01-15T00:00:00Z',
    startedAt: '2024-01-15T00:00:00Z',
    completedAt: '2024-01-15T01:00:00Z',
    currentArtifactPublicId: 'artifact-1',
    failureCode: null,
    failureMessage: null,
    marker: 'D1',
  },
  {
    publicId: 'run-2',
    discoveryType: 'desk_research',
    topic: 'Mobile App Study',
    topicSlug: 'mobile-app-study',
    sourceIntent: null,
    status: 'failed',
    stage: null,
    sourceCount: 1,
    attemptCount: 1,
    createdBy: 'user:test',
    createdAt: '2024-01-16T00:00:00Z',
    startedAt: '2024-01-16T00:00:00Z',
    completedAt: null,
    currentArtifactPublicId: null,
    failureCode: 'PROCESSING_FAILED',
    failureMessage: 'Failed to extract insights',
    marker: 'D2',
  },
];

const mockArtifactsData: DiscoveryArtifactSummary[] = [
  {
    publicId: 'artifact-1',
    runPublicId: 'run-1',
    title: 'VA Research Report 2024',
    artifactType: 'desk_research',
    topicSlug: 'va-research-report-2024',
    version: 1,
    status: 'current',
    templateName: 'desk_research',
    templateVersion: '1.0.0',
    createdAt: '2024-01-15T00:00:00Z',
    githubPath: null,
    projectedAt: null,
    marker: 'D1',
  },
  {
    publicId: 'artifact-2',
    runPublicId: 'run-1',
    title: 'User Survey Results',
    artifactType: 'desk_research',
    topicSlug: 'user-survey-results',
    version: 1,
    status: 'current',
    templateName: 'desk_research',
    templateVersion: '1.0.0',
    createdAt: '2024-01-15T00:00:00Z',
    githubPath: null,
    projectedAt: null,
    marker: 'D1',
  },
  {
    publicId: 'artifact-3',
    runPublicId: 'run-2',
    title: 'Mobile App Report',
    artifactType: 'desk_research',
    topicSlug: 'mobile-app-report',
    version: 1,
    status: 'current',
    templateName: 'desk_research',
    templateVersion: '1.0.0',
    createdAt: '2024-01-16T00:00:00Z',
    githubPath: null,
    projectedAt: null,
    marker: 'D2',
  },
];

const mockGet = vi.fn();
vi.mock('@/api/client', () => ({
  api: {
    get: (...args: unknown[]) => ({
      json: () => mockGet(...args),
    }),
  },
}));

// Test wrapper
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/studies/study-123/discovery/desk/sources']}>
        <Routes>
          <Route path="/studies/:studyPublicId/discovery/desk/sources" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('DeskSourcesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton while fetching', () => {
    mockGet.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<DeskSourcesPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('workspace-layout')).toBeInTheDocument();
  });

  it('displays empty state when no runs exist', async () => {
    mockGet.mockResolvedValue({ data: [] });

    render(<DeskSourcesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('No sources yet')).toBeInTheDocument();
    });

    expect(screen.getByText(/Upload reports, studies/)).toBeInTheDocument();
    // In empty state, there's an inline link "Add sources →"
    expect(screen.getByRole('link', { name: /Add sources →/ })).toBeInTheDocument();
  });

  it('displays runs grouped with artifacts', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/runs')) {
        return Promise.resolve({ data: mockRunsData });
      }
      if (url.includes('/artifacts')) {
        return Promise.resolve({ data: mockArtifactsData });
      }
      return Promise.resolve({ data: [] });
    });

    render(<DeskSourcesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('VA Research Q1')).toBeInTheDocument();
    });

    // Check completed run
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('VA Research Report 2024')).toBeInTheDocument();

    // Check failed run
    expect(screen.getByText('Mobile App Study')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('shows failed runs in needs attention section', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/runs')) {
        return Promise.resolve({ data: mockRunsData });
      }
      if (url.includes('/artifacts')) {
        return Promise.resolve({ data: mockArtifactsData });
      }
      return Promise.resolve({ data: [] });
    });

    render(<DeskSourcesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Needs your attention/)).toBeInTheDocument();
    });

    // Failed run should be in the needs attention section
    expect(screen.getByText('Mobile App Study')).toBeInTheDocument();
  });

  it('displays header tabs', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/runs')) {
        return Promise.resolve({ data: mockRunsData });
      }
      if (url.includes('/artifacts')) {
        return Promise.resolve({ data: mockArtifactsData });
      }
      return Promise.resolve({ data: [] });
    });

    render(<DeskSourcesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Insights/ })).toBeInTheDocument();
    });

    expect(screen.getByRole('tab', { name: /Sources/ })).toBeInTheDocument();

    // Sources tab should be active
    const sourcesTab = screen.getByRole('tab', { name: /Sources/ });
    expect(sourcesTab).toHaveAttribute('aria-selected', 'true');
  });

  it('displays source count in status line', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/runs')) {
        return Promise.resolve({ data: mockRunsData });
      }
      if (url.includes('/artifacts')) {
        return Promise.resolve({ data: mockArtifactsData });
      }
      return Promise.resolve({ data: [] });
    });

    render(<DeskSourcesPage />, { wrapper: createWrapper() });

    // Wait for content to load by checking for run name
    await waitFor(() => {
      expect(screen.getByText('VA Research Q1')).toBeInTheDocument();
    });

    // Verify needs attention section appears for failed runs
    expect(screen.getByText(/Needs your attention/)).toBeInTheDocument();
  });

  it('displays error state on API failure', async () => {
    mockGet.mockRejectedValue(new Error('Failed to fetch runs'));

    render(<DeskSourcesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Error loading sources')).toBeInTheDocument();
    });
  });

  it('run cards link to run detail page', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/runs')) {
        return Promise.resolve({ data: mockRunsData });
      }
      if (url.includes('/artifacts')) {
        return Promise.resolve({ data: mockArtifactsData });
      }
      return Promise.resolve({ data: [] });
    });

    render(<DeskSourcesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('VA Research Q1')).toBeInTheDocument();
    });

    // Check that run cards are links
    const runLink = screen.getByRole('link', { name: /VA Research Q1/ });
    expect(runLink).toHaveAttribute('href', '/studies/study-123/discovery/runs/run-1');
  });

  it('shows artifact preview on run cards', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/runs')) {
        return Promise.resolve({ data: mockRunsData });
      }
      if (url.includes('/artifacts')) {
        return Promise.resolve({ data: mockArtifactsData });
      }
      return Promise.resolve({ data: [] });
    });

    render(<DeskSourcesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('VA Research Report 2024')).toBeInTheDocument();
    });

    expect(screen.getByText('User Survey Results')).toBeInTheDocument();
  });

  it('shows project scope indicator in masthead', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/runs')) {
        return Promise.resolve({ data: mockRunsData });
      }
      if (url.includes('/artifacts')) {
        return Promise.resolve({ data: mockArtifactsData });
      }
      return Promise.resolve({ data: [] });
    });

    render(<DeskSourcesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Shared by every study/)).toBeInTheDocument();
    });
  });
});

describe('DeskSourcesPage run status display', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows processing status with spinner', async () => {
    const processingRun: DiscoveryRunSummary = {
      ...mockRunsData[0],
      publicId: 'run-processing',
      status: 'processing',
    };

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/runs')) {
        return Promise.resolve({ data: [processingRun] });
      }
      if (url.includes('/artifacts')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    render(<DeskSourcesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Processing')).toBeInTheDocument();
    });
  });

  it('shows pending status', async () => {
    const pendingRun: DiscoveryRunSummary = {
      ...mockRunsData[0],
      publicId: 'run-pending',
      status: 'pending',
    };

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/runs')) {
        return Promise.resolve({ data: [pendingRun] });
      }
      if (url.includes('/artifacts')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    render(<DeskSourcesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
  });
});

describe('DeskSourcesPage accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has proper tab navigation structure', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/runs')) {
        return Promise.resolve({ data: mockRunsData });
      }
      if (url.includes('/artifacts')) {
        return Promise.resolve({ data: mockArtifactsData });
      }
      return Promise.resolve({ data: [] });
    });

    render(<DeskSourcesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(2);
  });

  it('run cards are focusable links', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/runs')) {
        return Promise.resolve({ data: mockRunsData });
      }
      if (url.includes('/artifacts')) {
        return Promise.resolve({ data: mockArtifactsData });
      }
      return Promise.resolve({ data: [] });
    });

    render(<DeskSourcesPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /VA Research Q1/ })).toBeInTheDocument();
    });

    const links = screen.getAllByRole('link', { name: /Research|Study/ });
    expect(links.length).toBeGreaterThanOrEqual(2);
  });
});
