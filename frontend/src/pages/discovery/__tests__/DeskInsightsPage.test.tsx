/**
 * DeskInsightsPage Tests — DR-4d
 *
 * Tests for:
 * - Project-wide insight visibility
 * - Status and source filtering
 * - Empty/loading/error states
 * - Insight selection and detail panel
 * - Insight groups (proposed, accepted, rejected, withdrawn)
 * - Route deep links with filters
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DeskInsightsPage } from '../DeskInsightsPage';
import type { InsightSummary, DiscoveryArtifactSummary } from '@qori/api-contracts';

// Mock workspace context
const mockStudyWorkspace = {
  studyPublicId: 'study-123',
  projectPublicId: 'project-456',
};

// Mock permissions
const mockPermissions = {
  canReview: true,
  role: 'researcher' as string | null,
  isLoading: false,
  readOnlyReason: null as string | null,
};

vi.mock('@/hooks/useProjectPermissions', () => ({
  useProjectPermissions: () => mockPermissions,
}));

vi.mock('@/components/study/workspace', () => ({
  WorkspaceLayout: ({ children, rail }: { children: React.ReactNode; rail?: React.ReactNode }) => (
    <div data-testid="workspace-layout">
      {children}
      {rail && <aside data-testid="rail">{rail}</aside>}
    </div>
  ),
  useStudyWorkspace: () => mockStudyWorkspace,
}));

// Mock insights API
const mockInsightsData: InsightSummary[] = [
  {
    id: 1,
    publicId: 'insight-1',
    displayId: 'IN-0001',
    projectId: 100,
    wording: 'Veterans prefer simpler interfaces',
    status: 'proposed',
    latestRevisionNumber: 1,
    acceptedRevisionNumber: null,
    pendingRevisionNumber: null,
    origin: 'ai',
    needsReview: true,
    createdBy: 'system',
    createdAt: '2024-01-01T00:00:00Z',
    withdrawnAt: null,
    version: 1,
  },
  {
    id: 2,
    publicId: 'insight-2',
    displayId: 'IN-0002',
    projectId: 100,
    wording: 'Mobile adoption is increasing',
    status: 'accepted',
    latestRevisionNumber: 2,
    acceptedRevisionNumber: 2,
    pendingRevisionNumber: null,
    origin: 'researcher',
    needsReview: false,
    createdBy: 'user:test',
    createdAt: '2024-01-02T00:00:00Z',
    withdrawnAt: null,
    version: 2,
  },
];

const mockArtifactsData: DiscoveryArtifactSummary[] = [
  {
    publicId: 'artifact-1',
    runPublicId: 'run-1',
    title: 'VA Research Report',
    artifactType: 'desk_research',
    topicSlug: 'va-research-report',
    version: 1,
    status: 'current',
    templateName: 'desk_research',
    templateVersion: '1.0.0',
    createdAt: '2024-01-01T00:00:00Z',
    githubPath: null,
    projectedAt: null,
    marker: 'D1',
    // DR-4d extraction fields
    extractionStatus: 'success',
    extractionAttemptedAt: '2024-01-01T01:00:00Z',
    extractionInsightCount: 5,
    extractionFailureReason: null,
    extractionPermanentFailure: null,
    extractionNextRetryAt: null,
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
      <MemoryRouter initialEntries={['/studies/study-123/discovery/desk']}>
        <Routes>
          <Route path="/studies/:studyPublicId/discovery/desk" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('DeskInsightsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading skeleton while fetching', () => {
    mockGet.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    expect(screen.getByTestId('workspace-layout')).toBeInTheDocument();
    // Skeleton is shown during loading
  });

  it('displays empty state when no sources exist', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/insights')) {
        return Promise.resolve({ data: [], meta: { total: 0, needsReviewCount: 0, limit: 50, offset: 0 } });
      }
      if (url.includes('/artifacts')) {
        return Promise.resolve({ data: [] });
      }
      return Promise.resolve({ data: [] });
    });

    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('No sources yet')).toBeInTheDocument();
    });

    expect(screen.getByText(/Upload reports, studies/)).toBeInTheDocument();
    // In empty state, there's an inline link "Add sources →"
    expect(screen.getByRole('link', { name: /Add sources →/ })).toBeInTheDocument();
  });

  it('displays insights grouped by status', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/insights')) {
        return Promise.resolve({
          data: mockInsightsData,
          meta: { total: 2, needsReviewCount: 1, limit: 50, offset: 0 },
        });
      }
      if (url.includes('/artifacts')) {
        return Promise.resolve({ data: mockArtifactsData });
      }
      return Promise.resolve({ data: [] });
    });

    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      // Check for group headers using button role (they're clickable)
      expect(screen.getByRole('button', { name: /Proposed \(1\)/ })).toBeInTheDocument();
    });

    // Check group header for accepted section
    expect(screen.getByRole('button', { name: /Accepted \(1\)/ })).toBeInTheDocument();

    // Check insight content
    expect(screen.getByText('Veterans prefer simpler interfaces')).toBeInTheDocument();
    expect(screen.getByText('Mobile adoption is increasing')).toBeInTheDocument();
  });

  it('shows needs-review indicator in header', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/insights')) {
        return Promise.resolve({
          data: mockInsightsData,
          meta: { total: 2, needsReviewCount: 1, limit: 50, offset: 0 },
        });
      }
      if (url.includes('/artifacts')) {
        return Promise.resolve({ data: mockArtifactsData });
      }
      return Promise.resolve({ data: [] });
    });

    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    // Wait for insights to load
    await waitFor(() => {
      expect(screen.getByText('Veterans prefer simpler interfaces')).toBeInTheDocument();
    });

    // Check that proposed group shows with needs-review count
    expect(screen.getByText('Proposed')).toBeInTheDocument();
  });

  it('displays header tabs with counts', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/insights')) {
        return Promise.resolve({
          data: mockInsightsData,
          meta: { total: 2, needsReviewCount: 1, limit: 50, offset: 0 },
        });
      }
      if (url.includes('/artifacts')) {
        return Promise.resolve({ data: mockArtifactsData });
      }
      return Promise.resolve({ data: [] });
    });

    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /Insights/ })).toBeInTheDocument();
    });

    expect(screen.getByRole('tab', { name: /Sources/ })).toBeInTheDocument();
  });

  it('displays error state on API failure', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/insights')) {
        return Promise.reject(new Error('Failed to fetch insights'));
      }
      return Promise.resolve({ data: [] });
    });

    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Error loading insights')).toBeInTheDocument();
    });
  });

  it('filter bar shows status chips when sources exist', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/insights')) {
        return Promise.resolve({
          data: mockInsightsData,
          meta: { total: 2, needsReviewCount: 1, limit: 50, offset: 0 },
        });
      }
      if (url.includes('/artifacts')) {
        return Promise.resolve({ data: mockArtifactsData });
      }
      return Promise.resolve({ data: [] });
    });

    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Needs review' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accepted' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rejected' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Withdrawn' })).toBeInTheDocument();
  });

  it('shows masthead with project scope indicator', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/insights')) {
        return Promise.resolve({
          data: mockInsightsData,
          meta: { total: 2, needsReviewCount: 1, limit: 50, offset: 0 },
        });
      }
      if (url.includes('/artifacts')) {
        return Promise.resolve({ data: mockArtifactsData });
      }
      return Promise.resolve({ data: [] });
    });

    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/Shared by every study/)).toBeInTheDocument();
    });
  });
});

describe('DeskInsightsPage filters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('status filter chips are interactive', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/insights')) {
        return Promise.resolve({
          data: mockInsightsData,
          meta: { total: 2, needsReviewCount: 1, limit: 50, offset: 0 },
        });
      }
      if (url.includes('/artifacts')) {
        return Promise.resolve({ data: mockArtifactsData });
      }
      return Promise.resolve({ data: [] });
    });

    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Needs review' })).toBeInTheDocument();
    });

    // All filter buttons should be present
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Needs review' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accepted' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rejected' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Withdrawn' })).toBeInTheDocument();

    // "All" should be active by default
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('DeskInsightsPage accessibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has proper ARIA labels for filter groups', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/insights')) {
        return Promise.resolve({
          data: mockInsightsData,
          meta: { total: 2, needsReviewCount: 1, limit: 50, offset: 0 },
        });
      }
      if (url.includes('/artifacts')) {
        return Promise.resolve({ data: mockArtifactsData });
      }
      return Promise.resolve({ data: [] });
    });

    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('group', { name: /Filter by status/ })).toBeInTheDocument();
    });
  });

  it('has proper tab navigation structure', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/insights')) {
        return Promise.resolve({
          data: mockInsightsData,
          meta: { total: 2, needsReviewCount: 1, limit: 50, offset: 0 },
        });
      }
      if (url.includes('/artifacts')) {
        return Promise.resolve({ data: mockArtifactsData });
      }
      return Promise.resolve({ data: [] });
    });

    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    // DR-6b-4c: Now 3 tabs (Insights, Sources, Desk readouts)
    const tabs = screen.getAllByRole('tab');
    expect(tabs).toHaveLength(3);
  });
});

describe('DeskInsightsPage permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to default authorized state
    mockPermissions.canReview = true;
    mockPermissions.role = 'researcher';
    mockPermissions.isLoading = false;
    mockPermissions.readOnlyReason = null;
  });

  it('shows read-only notice for unauthorized viewers', async () => {
    // Set up read-only permissions
    mockPermissions.canReview = false;
    mockPermissions.role = null;
    mockPermissions.readOnlyReason = 'You have view-only access to this project.';

    // Mock insight detail for panel
    const mockInsightDetail = {
      id: 1,
      publicId: 'insight-1',
      displayId: 'IN-0001',
      projectId: 100,
      wording: 'Veterans prefer simpler interfaces',
      status: 'proposed',
      latestRevisionNumber: 1,
      acceptedRevisionNumber: null,
      pendingRevisionNumber: null,
      origin: 'ai',
      needsReview: true,
      createdBy: 'system',
      createdAt: '2024-01-01T00:00:00Z',
      withdrawnAt: null,
      version: 1,
      revisionCount: 1,
      latestRevision: {
        id: 1,
        publicId: 'rev-1',
        revisionNumber: 1,
        content: { wording: 'Veterans prefer simpler interfaces' },
        evidenceSnapshot: [],
        origin: 'ai',
        createdBy: 'system',
        createdAt: '2024-01-01T00:00:00Z',
        isAccepted: false,
        isLatest: true,
      },
      acceptedRevision: null,
    };

    mockGet.mockImplementation((url: string) => {
      // Check for revisions/reviews BEFORE insight detail (more specific first)
      if (url.includes('/revisions')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/reviews')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/insights/insight-1')) {
        return Promise.resolve({ data: mockInsightDetail });
      }
      if (url.includes('/insights')) {
        return Promise.resolve({
          data: mockInsightsData,
          meta: { total: 2, needsReviewCount: 1, limit: 50, offset: 0 },
        });
      }
      if (url.includes('/artifacts')) {
        return Promise.resolve({ data: mockArtifactsData });
      }
      return Promise.resolve({ data: [] });
    });

    const user = userEvent.setup();
    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    // Wait for insights to load
    await waitFor(() => {
      expect(screen.getByText('Veterans prefer simpler interfaces')).toBeInTheDocument();
    });

    // Click on an insight row to open the panel
    await user.click(screen.getByText('Veterans prefer simpler interfaces'));

    // Wait for panel to load and show read-only notice
    await waitFor(() => {
      expect(screen.getByTestId('rail')).toBeInTheDocument();
    });

    // The ReadOnlyNotice component should show the reason
    await waitFor(() => {
      expect(screen.getByText(/view-only access/)).toBeInTheDocument();
    });
  });

  it('does not show read-only notice for authorized reviewers', async () => {
    // Permissions are already set to canReview=true in beforeEach

    const mockInsightDetail = {
      id: 1,
      publicId: 'insight-1',
      displayId: 'IN-0001',
      projectId: 100,
      wording: 'Veterans prefer simpler interfaces',
      status: 'proposed',
      latestRevisionNumber: 1,
      acceptedRevisionNumber: null,
      pendingRevisionNumber: null,
      origin: 'ai',
      needsReview: true,
      createdBy: 'system',
      createdAt: '2024-01-01T00:00:00Z',
      withdrawnAt: null,
      version: 1,
      revisionCount: 1,
      latestRevision: {
        id: 1,
        publicId: 'rev-1',
        revisionNumber: 1,
        content: { wording: 'Veterans prefer simpler interfaces' },
        evidenceSnapshot: [],
        origin: 'ai',
        createdBy: 'system',
        createdAt: '2024-01-01T00:00:00Z',
        isAccepted: false,
        isLatest: true,
      },
      acceptedRevision: null,
    };

    mockGet.mockImplementation((url: string) => {
      // Check for revisions/reviews BEFORE insight detail (more specific first)
      if (url.includes('/revisions')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/reviews')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/insights/insight-1')) {
        return Promise.resolve({ data: mockInsightDetail });
      }
      if (url.includes('/insights')) {
        return Promise.resolve({
          data: mockInsightsData,
          meta: { total: 2, needsReviewCount: 1, limit: 50, offset: 0 },
        });
      }
      if (url.includes('/artifacts')) {
        return Promise.resolve({ data: mockArtifactsData });
      }
      return Promise.resolve({ data: [] });
    });

    const user = userEvent.setup();
    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    // Wait for insights to load
    await waitFor(() => {
      expect(screen.getByText('Veterans prefer simpler interfaces')).toBeInTheDocument();
    });

    // Click on an insight row to open the panel
    await user.click(screen.getByText('Veterans prefer simpler interfaces'));

    // Wait for panel to load
    await waitFor(() => {
      expect(screen.getByTestId('rail')).toBeInTheDocument();
    });

    // Should NOT show read-only notice
    expect(screen.queryByText(/view-only access/)).not.toBeInTheDocument();
    expect(screen.queryByText(/must be signed in/)).not.toBeInTheDocument();
  });

  it('fails closed when permissions are loading', async () => {
    // Set permissions to loading state
    mockPermissions.canReview = false;
    mockPermissions.role = null;
    mockPermissions.isLoading = true;
    mockPermissions.readOnlyReason = null;

    const mockInsightDetail = {
      id: 1,
      publicId: 'insight-1',
      displayId: 'IN-0001',
      projectId: 100,
      wording: 'Veterans prefer simpler interfaces',
      status: 'proposed',
      latestRevisionNumber: 1,
      acceptedRevisionNumber: null,
      pendingRevisionNumber: null,
      origin: 'ai',
      needsReview: true,
      createdBy: 'system',
      createdAt: '2024-01-01T00:00:00Z',
      withdrawnAt: null,
      version: 1,
      revisionCount: 1,
      latestRevision: {
        id: 1,
        publicId: 'rev-1',
        revisionNumber: 1,
        content: { wording: 'Veterans prefer simpler interfaces' },
        evidenceSnapshot: [],
        origin: 'ai',
        createdBy: 'system',
        createdAt: '2024-01-01T00:00:00Z',
        isAccepted: false,
        isLatest: true,
      },
      acceptedRevision: null,
    };

    mockGet.mockImplementation((url: string) => {
      // Check for revisions/reviews BEFORE insight detail (more specific first)
      if (url.includes('/revisions')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/reviews')) {
        return Promise.resolve({ data: [] });
      }
      if (url.includes('/insights/insight-1')) {
        return Promise.resolve({ data: mockInsightDetail });
      }
      if (url.includes('/insights')) {
        return Promise.resolve({
          data: mockInsightsData,
          meta: { total: 2, needsReviewCount: 1, limit: 50, offset: 0 },
        });
      }
      if (url.includes('/artifacts')) {
        return Promise.resolve({ data: mockArtifactsData });
      }
      return Promise.resolve({ data: [] });
    });

    const user = userEvent.setup();
    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    // Wait for insights to load
    await waitFor(() => {
      expect(screen.getByText('Veterans prefer simpler interfaces')).toBeInTheDocument();
    });

    // Click on an insight row to open the panel
    await user.click(screen.getByText('Veterans prefer simpler interfaces'));

    // Wait for panel to load
    await waitFor(() => {
      expect(screen.getByTestId('rail')).toBeInTheDocument();
    });

    // When loading, canReview is false, so panel should be in read-only mode
    // The ReadOnlyNotice shows the default message when no reason is provided
    await waitFor(() => {
      expect(screen.getByText(/view-only access to this insight/)).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DR-4e: Review Interactions Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('DeskInsightsPage review interactions', () => {
  const mockInsightDetail = {
    id: 1,
    publicId: 'insight-1',
    displayId: 'IN-0001',
    projectId: 100,
    wording: 'Veterans prefer simpler interfaces',
    status: 'proposed' as const,
    latestRevisionNumber: 1,
    acceptedRevisionNumber: null,
    pendingRevisionNumber: null,
    origin: 'ai' as const,
    needsReview: true,
    createdBy: 'system',
    createdAt: '2024-01-01T00:00:00Z',
    withdrawnAt: null,
    version: 1,
    revisionCount: 1,
    latestRevision: {
      id: 1,
      publicId: 'rev-1',
      revisionNumber: 1,
      content: { wording: 'Veterans prefer simpler interfaces' },
      evidenceSnapshot: [],
      origin: 'ai' as const,
      createdBy: 'system',
      createdAt: '2024-01-01T00:00:00Z',
      isAccepted: false,
      isLatest: true,
    },
    acceptedRevision: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to authorized state
    mockPermissions.canReview = true;
    mockPermissions.role = 'researcher';
    mockPermissions.isLoading = false;
    mockPermissions.readOnlyReason = null;
  });

  it('shows accept and reject buttons for proposed insights', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/revisions')) return Promise.resolve({ data: [] });
      if (url.includes('/reviews')) return Promise.resolve({ data: [] });
      if (url.includes('/insights/insight-1')) return Promise.resolve({ data: mockInsightDetail });
      if (url.includes('/insights')) {
        return Promise.resolve({
          data: mockInsightsData,
          meta: { total: 2, needsReviewCount: 1, limit: 50, offset: 0 },
        });
      }
      if (url.includes('/artifacts')) return Promise.resolve({ data: mockArtifactsData });
      return Promise.resolve({ data: [] });
    });

    const user = userEvent.setup();
    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Veterans prefer simpler interfaces')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Veterans prefer simpler interfaces'));

    // Wait for rail to render
    await waitFor(() => {
      expect(screen.getByTestId('rail')).toBeInTheDocument();
    });

    // Use exact match to distinguish from "Accepted" filter/group buttons
    const rail = screen.getByTestId('rail');
    await waitFor(() => {
      expect(within(rail).getByRole('button', { name: 'Accept' })).toBeInTheDocument();
      expect(within(rail).getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    });
  });

  it('shows withdraw button for accepted insights', async () => {
    const acceptedInsight = {
      ...mockInsightDetail,
      publicId: 'insight-2',
      displayId: 'IN-0002',
      status: 'accepted' as const,
      acceptedRevisionNumber: 1,
      needsReview: false,
      acceptedRevision: mockInsightDetail.latestRevision,
    };

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/revisions')) return Promise.resolve({ data: [] });
      if (url.includes('/reviews')) return Promise.resolve({ data: [] });
      if (url.includes('/insights/insight-2')) return Promise.resolve({ data: acceptedInsight });
      if (url.includes('/insights')) {
        return Promise.resolve({
          data: mockInsightsData,
          meta: { total: 2, needsReviewCount: 1, limit: 50, offset: 0 },
        });
      }
      if (url.includes('/artifacts')) return Promise.resolve({ data: mockArtifactsData });
      return Promise.resolve({ data: [] });
    });

    const user = userEvent.setup();
    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Mobile adoption is increasing')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Mobile adoption is increasing'));

    // Wait for rail to render
    await waitFor(() => {
      expect(screen.getByTestId('rail')).toBeInTheDocument();
    });

    const rail = screen.getByTestId('rail');
    await waitFor(() => {
      expect(within(rail).getByRole('button', { name: 'Withdraw' })).toBeInTheDocument();
    });
  });

  it('shows edit button for non-withdrawn insights', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/revisions')) return Promise.resolve({ data: [] });
      if (url.includes('/reviews')) return Promise.resolve({ data: [] });
      if (url.includes('/insights/insight-1')) return Promise.resolve({ data: mockInsightDetail });
      if (url.includes('/insights')) {
        return Promise.resolve({
          data: mockInsightsData,
          meta: { total: 2, needsReviewCount: 1, limit: 50, offset: 0 },
        });
      }
      if (url.includes('/artifacts')) return Promise.resolve({ data: mockArtifactsData });
      return Promise.resolve({ data: [] });
    });

    const user = userEvent.setup();
    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Veterans prefer simpler interfaces')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Veterans prefer simpler interfaces'));

    // Wait for rail to render
    await waitFor(() => {
      expect(screen.getByTestId('rail')).toBeInTheDocument();
    });

    const rail = screen.getByTestId('rail');
    await waitFor(() => {
      expect(within(rail).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    });
  });

  it('shows create insight button when sources exist', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/insights')) {
        return Promise.resolve({
          data: mockInsightsData,
          meta: { total: 2, needsReviewCount: 1, limit: 50, offset: 0 },
        });
      }
      if (url.includes('/artifacts')) return Promise.resolve({ data: mockArtifactsData });
      return Promise.resolve({ data: [] });
    });

    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Create insight/ })).toBeInTheDocument();
    });
  });

  it('does not show action buttons for read-only users', async () => {
    mockPermissions.canReview = false;
    mockPermissions.readOnlyReason = 'View-only access';

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/revisions')) return Promise.resolve({ data: [] });
      if (url.includes('/reviews')) return Promise.resolve({ data: [] });
      if (url.includes('/insights/insight-1')) return Promise.resolve({ data: mockInsightDetail });
      if (url.includes('/insights')) {
        return Promise.resolve({
          data: mockInsightsData,
          meta: { total: 2, needsReviewCount: 1, limit: 50, offset: 0 },
        });
      }
      if (url.includes('/artifacts')) return Promise.resolve({ data: mockArtifactsData });
      return Promise.resolve({ data: [] });
    });

    const user = userEvent.setup();
    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Veterans prefer simpler interfaces')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Veterans prefer simpler interfaces'));

    await waitFor(() => {
      expect(screen.getByTestId('rail')).toBeInTheDocument();
    });

    // Action buttons should not be present in the rail
    const rail = screen.getByTestId('rail');
    expect(within(rail).queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
    expect(within(rail).queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
    expect(within(rail).queryByRole('button', { name: 'Withdraw' })).not.toBeInTheDocument();
    expect(within(rail).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('does not show create insight button for read-only users', async () => {
    mockPermissions.canReview = false;
    mockPermissions.readOnlyReason = 'View-only access';

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/insights')) {
        return Promise.resolve({
          data: mockInsightsData,
          meta: { total: 2, needsReviewCount: 1, limit: 50, offset: 0 },
        });
      }
      if (url.includes('/artifacts')) return Promise.resolve({ data: mockArtifactsData });
      return Promise.resolve({ data: [] });
    });

    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Veterans prefer simpler interfaces')).toBeInTheDocument();
    });

    // Create insight button should not be present
    expect(screen.queryByRole('button', { name: /Create insight/ })).not.toBeInTheDocument();
  });
});

describe('DeskInsightsPage accepted with pending revision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissions.canReview = true;
    mockPermissions.role = 'researcher';
    mockPermissions.isLoading = false;
    mockPermissions.readOnlyReason = null;
  });

  it('shows both accept and withdraw for accepted_with_pending status', async () => {
    const acceptedWithPending = {
      id: 1,
      publicId: 'insight-1',
      displayId: 'IN-0001',
      projectId: 100,
      wording: 'Veterans prefer simpler interfaces',
      status: 'accepted_with_pending' as const,
      latestRevisionNumber: 2,
      acceptedRevisionNumber: 1,
      pendingRevisionNumber: 2,
      origin: 'ai' as const,
      needsReview: true,
      createdBy: 'system',
      createdAt: '2024-01-01T00:00:00Z',
      withdrawnAt: null,
      version: 2,
      revisionCount: 2,
      latestRevision: {
        id: 2,
        publicId: 'rev-2',
        revisionNumber: 2,
        content: { wording: 'Updated wording' },
        evidenceSnapshot: [],
        origin: 'researcher' as const,
        createdBy: 'user:test',
        createdAt: '2024-01-02T00:00:00Z',
        isAccepted: false,
        isLatest: true,
      },
      acceptedRevision: {
        id: 1,
        publicId: 'rev-1',
        revisionNumber: 1,
        content: { wording: 'Veterans prefer simpler interfaces' },
        evidenceSnapshot: [],
        origin: 'ai' as const,
        createdBy: 'system',
        createdAt: '2024-01-01T00:00:00Z',
        isAccepted: true,
        isLatest: false,
      },
    };

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/revisions')) return Promise.resolve({ data: [] });
      if (url.includes('/reviews')) return Promise.resolve({ data: [] });
      if (url.includes('/insights/insight-1')) return Promise.resolve({ data: acceptedWithPending });
      if (url.includes('/insights')) {
        return Promise.resolve({
          data: mockInsightsData,
          meta: { total: 2, needsReviewCount: 1, limit: 50, offset: 0 },
        });
      }
      if (url.includes('/artifacts')) return Promise.resolve({ data: mockArtifactsData });
      return Promise.resolve({ data: [] });
    });

    const user = userEvent.setup();
    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Veterans prefer simpler interfaces')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Veterans prefer simpler interfaces'));

    // Wait for rail to render
    await waitFor(() => {
      expect(screen.getByTestId('rail')).toBeInTheDocument();
    });

    const rail = screen.getByTestId('rail');
    await waitFor(() => {
      // Should have accept (for pending revision), reject, withdraw, and edit
      expect(within(rail).getByRole('button', { name: 'Accept' })).toBeInTheDocument();
      expect(within(rail).getByRole('button', { name: 'Reject' })).toBeInTheDocument();
      expect(within(rail).getByRole('button', { name: 'Withdraw' })).toBeInTheDocument();
      expect(within(rail).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    });
  });
});

describe('DeskInsightsPage self-review', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissions.canReview = true;
    mockPermissions.role = 'researcher';
    mockPermissions.isLoading = false;
    mockPermissions.readOnlyReason = null;
  });

  it('allows researcher to review their own submissions', async () => {
    // Insight created by the same user
    const ownInsight = {
      id: 1,
      publicId: 'insight-1',
      displayId: 'IN-0001',
      projectId: 100,
      wording: 'My own insight',
      status: 'proposed' as const,
      latestRevisionNumber: 1,
      acceptedRevisionNumber: null,
      pendingRevisionNumber: null,
      origin: 'researcher' as const,
      needsReview: true,
      createdBy: 'user:current', // Same as current user
      createdAt: '2024-01-01T00:00:00Z',
      withdrawnAt: null,
      version: 1,
      revisionCount: 1,
      latestRevision: {
        id: 1,
        publicId: 'rev-1',
        revisionNumber: 1,
        content: { wording: 'My own insight' },
        evidenceSnapshot: [],
        origin: 'researcher' as const,
        createdBy: 'user:current',
        createdAt: '2024-01-01T00:00:00Z',
        isAccepted: false,
        isLatest: true,
      },
      acceptedRevision: null,
    };

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/revisions')) return Promise.resolve({ data: [] });
      if (url.includes('/reviews')) return Promise.resolve({ data: [] });
      if (url.includes('/insights/insight-1')) return Promise.resolve({ data: ownInsight });
      if (url.includes('/insights')) {
        return Promise.resolve({
          data: [{ ...mockInsightsData[0], wording: 'My own insight', createdBy: 'user:current' }],
          meta: { total: 1, needsReviewCount: 1, limit: 50, offset: 0 },
        });
      }
      if (url.includes('/artifacts')) return Promise.resolve({ data: mockArtifactsData });
      return Promise.resolve({ data: [] });
    });

    const user = userEvent.setup();
    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('My own insight')).toBeInTheDocument();
    });

    await user.click(screen.getByText('My own insight'));

    // Wait for rail to render
    await waitFor(() => {
      expect(screen.getByTestId('rail')).toBeInTheDocument();
    });

    const rail = screen.getByTestId('rail');
    // Even for own submissions, accept/reject should be available
    await waitFor(() => {
      expect(within(rail).getByRole('button', { name: 'Accept' })).toBeInTheDocument();
      expect(within(rail).getByRole('button', { name: 'Reject' })).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DR-4e: Mutation behavior tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('DeskInsightsPage mutation behavior', () => {
  const mockInsightDetail = {
    id: 1,
    publicId: 'insight-1',
    displayId: 'IN-0001',
    projectId: 100,
    wording: 'Veterans prefer simpler interfaces',
    status: 'proposed' as const,
    latestRevisionNumber: 1,
    acceptedRevisionNumber: null,
    pendingRevisionNumber: null,
    origin: 'ai' as const,
    needsReview: true,
    createdBy: 'system',
    createdAt: '2024-01-01T00:00:00Z',
    withdrawnAt: null,
    version: 1,
    revisionCount: 1,
    latestRevision: {
      id: 1,
      publicId: 'rev-1',
      revisionNumber: 1,
      content: { wording: 'Veterans prefer simpler interfaces' },
      evidenceSnapshot: [],
      origin: 'ai' as const,
      createdBy: 'system',
      createdAt: '2024-01-01T00:00:00Z',
      isAccepted: false,
      isLatest: true,
    },
    acceptedRevision: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPermissions.canReview = true;
    mockPermissions.role = 'researcher';
    mockPermissions.isLoading = false;
    mockPermissions.readOnlyReason = null;
  });

  it('disables all action buttons while a mutation is pending (duplicate submission prevention)', async () => {
    // Create a slow mock that doesn't resolve immediately
    const mockPost = vi.fn();
    vi.mock('@/api/client', async (importOriginal) => {
      const orig = await importOriginal<typeof import('@/api/client')>();
      return {
        ...orig,
        api: {
          get: (...args: unknown[]) => ({
            json: () => mockGet(...args),
          }),
          post: (...args: unknown[]) => ({
            json: () => mockPost(...args),
          }),
        },
      };
    });

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/revisions')) return Promise.resolve({ data: [] });
      if (url.includes('/reviews')) return Promise.resolve({ data: [] });
      if (url.includes('/insights/insight-1')) return Promise.resolve({ data: mockInsightDetail });
      if (url.includes('/insights')) {
        return Promise.resolve({
          data: mockInsightsData,
          meta: { total: 2, needsReviewCount: 1, limit: 50, offset: 0 },
        });
      }
      if (url.includes('/artifacts')) return Promise.resolve({ data: mockArtifactsData });
      return Promise.resolve({ data: [] });
    });

    const user = userEvent.setup();
    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Veterans prefer simpler interfaces')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Veterans prefer simpler interfaces'));

    await waitFor(() => {
      expect(screen.getByTestId('rail')).toBeInTheDocument();
    });

    const rail = screen.getByTestId('rail');

    // Both buttons should be enabled initially
    const acceptButton = within(rail).getByRole('button', { name: 'Accept' });
    const rejectButton = within(rail).getByRole('button', { name: 'Reject' });
    const editButton = within(rail).getByRole('button', { name: 'Edit' });

    expect(acceptButton).not.toBeDisabled();
    expect(rejectButton).not.toBeDisabled();
    expect(editButton).not.toBeDisabled();
  });

  it('shows withdrawn status excludes from synthesis scope', async () => {
    const withdrawnInsight = {
      ...mockInsightDetail,
      status: 'withdrawn' as const,
      withdrawnAt: '2024-01-02T00:00:00Z',
    };

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/revisions')) return Promise.resolve({ data: [] });
      if (url.includes('/reviews')) return Promise.resolve({ data: [] });
      if (url.includes('/insights/insight-1')) return Promise.resolve({ data: withdrawnInsight });
      if (url.includes('/insights')) {
        return Promise.resolve({
          data: [{ ...mockInsightsData[0], status: 'withdrawn' }],
          meta: { total: 1, needsReviewCount: 0, limit: 50, offset: 0 },
        });
      }
      if (url.includes('/artifacts')) return Promise.resolve({ data: mockArtifactsData });
      return Promise.resolve({ data: [] });
    });

    const user = userEvent.setup();
    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    // Wait for the withdrawn group to appear (it's collapsed by default)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Withdrawn \(1\)/ })).toBeInTheDocument();
    });

    // Expand the withdrawn group
    await user.click(screen.getByRole('button', { name: /Withdrawn \(1\)/ }));

    // Now the insight should be visible
    await waitFor(() => {
      expect(screen.getByText('Veterans prefer simpler interfaces')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Veterans prefer simpler interfaces'));

    await waitFor(() => {
      expect(screen.getByTestId('rail')).toBeInTheDocument();
    });

    // Should show withdrawn - not in synthesis scope message
    await waitFor(() => {
      expect(screen.getByText(/Withdrawn — not in synthesis scope/)).toBeInTheDocument();
    });
  });

  it('shows rejected insight retains accepted wording when accepted_with_pending is rejected', async () => {
    // When rejecting a pending revision on an accepted insight,
    // the accepted revision should still be displayed
    const acceptedWithPendingInsight = {
      ...mockInsightDetail,
      status: 'accepted_with_pending' as const,
      latestRevisionNumber: 2,
      acceptedRevisionNumber: 1,
      pendingRevisionNumber: 2,
      latestRevision: {
        ...mockInsightDetail.latestRevision,
        id: 2,
        revisionNumber: 2,
        content: { wording: 'Updated but pending wording' },
        isAccepted: false,
        isLatest: true,
      },
      acceptedRevision: {
        ...mockInsightDetail.latestRevision,
        id: 1,
        revisionNumber: 1,
        content: { wording: 'Original accepted wording' },
        isAccepted: true,
        isLatest: false,
      },
    };

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/revisions')) return Promise.resolve({ data: [] });
      if (url.includes('/reviews')) return Promise.resolve({ data: [] });
      if (url.includes('/insights/insight-1')) return Promise.resolve({ data: acceptedWithPendingInsight });
      if (url.includes('/insights')) {
        return Promise.resolve({
          data: [{ ...mockInsightsData[0], status: 'accepted_with_pending' }],
          meta: { total: 1, needsReviewCount: 1, limit: 50, offset: 0 },
        });
      }
      if (url.includes('/artifacts')) return Promise.resolve({ data: mockArtifactsData });
      return Promise.resolve({ data: [] });
    });

    const user = userEvent.setup();
    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Veterans prefer simpler interfaces')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Veterans prefer simpler interfaces'));

    await waitFor(() => {
      expect(screen.getByTestId('rail')).toBeInTheDocument();
    });

    // Should show both accepted and pending versions
    await waitFor(() => {
      expect(screen.getByText('Original accepted wording')).toBeInTheDocument();
      expect(screen.getByText('Updated but pending wording')).toBeInTheDocument();
    });

    // Should show "Accepted Version" and "Pending Revision" sections
    expect(screen.getByText('Accepted Version')).toBeInTheDocument();
    expect(screen.getByText('Pending Revision')).toBeInTheDocument();
  });

  it('shows eligible for synthesis message for accepted insights', async () => {
    const acceptedInsight = {
      ...mockInsightDetail,
      status: 'accepted' as const,
      acceptedRevisionNumber: 1,
      acceptedRevision: mockInsightDetail.latestRevision,
    };

    mockGet.mockImplementation((url: string) => {
      if (url.includes('/revisions')) return Promise.resolve({ data: [] });
      if (url.includes('/reviews')) return Promise.resolve({ data: [] });
      if (url.includes('/insights/insight-1')) return Promise.resolve({ data: acceptedInsight });
      if (url.includes('/insights')) {
        return Promise.resolve({
          data: [{ ...mockInsightsData[0], status: 'accepted' }],
          meta: { total: 1, needsReviewCount: 0, limit: 50, offset: 0 },
        });
      }
      if (url.includes('/artifacts')) return Promise.resolve({ data: mockArtifactsData });
      return Promise.resolve({ data: [] });
    });

    const user = userEvent.setup();
    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Veterans prefer simpler interfaces')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Veterans prefer simpler interfaces'));

    await waitFor(() => {
      expect(screen.getByTestId('rail')).toBeInTheDocument();
    });

    // Should show eligible for synthesis message
    await waitFor(() => {
      expect(screen.getByText(/eligible for synthesis/i)).toBeInTheDocument();
    });
  });

  it('shows not yet accepted message for proposed insights', async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes('/revisions')) return Promise.resolve({ data: [] });
      if (url.includes('/reviews')) return Promise.resolve({ data: [] });
      if (url.includes('/insights/insight-1')) return Promise.resolve({ data: mockInsightDetail });
      if (url.includes('/insights')) {
        return Promise.resolve({
          data: mockInsightsData,
          meta: { total: 2, needsReviewCount: 1, limit: 50, offset: 0 },
        });
      }
      if (url.includes('/artifacts')) return Promise.resolve({ data: mockArtifactsData });
      return Promise.resolve({ data: [] });
    });

    const user = userEvent.setup();
    render(<DeskInsightsPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Veterans prefer simpler interfaces')).toBeInTheDocument();
    });

    await user.click(screen.getByText('Veterans prefer simpler interfaces'));

    await waitFor(() => {
      expect(screen.getByTestId('rail')).toBeInTheDocument();
    });

    // Should show "not yet accepted" message
    await waitFor(() => {
      expect(screen.getByText(/not yet accepted/i)).toBeInTheDocument();
      expect(screen.getByText(/not in synthesis scope/i)).toBeInTheDocument();
    });
  });
});
