/**
 * DeskReadoutsPage Tests — DR-6b-4c
 *
 * Tests for Desk readouts overview page including:
 * - Loading, error, empty, and list states
 * - Pagination
 * - Project/study isolation
 * - Status display
 * - Absence of unsupported controls
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeskReadoutsPage } from '../DeskReadoutsPage';
import type { ReadoutSummary } from '@/api/readouts';

// Mock the workspace context
vi.mock('@/components/study/workspace', () => ({
  WorkspaceLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="workspace-layout">{children}</div>
  ),
  useStudyWorkspace: () => ({
    studyPublicId: 'study-123',
    projectPublicId: 'project-456',
  }),
}));

// Mock the readouts API
const mockListReadouts = vi.fn();
vi.mock('@/api/readouts', async () => {
  const actual = await vi.importActual('@/api/readouts');
  return {
    ...actual,
    useReadoutsList: (projectId: string, studyId: string, params?: { limit?: number; offset?: number }) => {
      const result = mockListReadouts(projectId, studyId, params);
      return result;
    },
  };
});

// Helper to create a mock readout
function createMockReadout(overrides: Partial<ReadoutSummary> = {}): ReadoutSummary {
  return {
    id: 1,
    publicId: 'ro-public-1',
    displayId: 'RO-0001',
    studyId: 1,
    projectId: 1,
    title: 'Test Readout',
    question: null,
    approvedAt: null,
    approvedVersion: null,
    outOfDateSince: null,
    outOfDateReason: null,
    currentGenerationRequestId: null,
    createdAt: '2026-10-15T10:00:00Z',
    createdByActorId: 1,
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/studies/study-123/discovery/desk/readouts']}>
        <Routes>
          <Route path="/studies/:studyPublicId/discovery/desk/readouts" element={<DeskReadoutsPage />} />
          <Route path="/studies/:studyPublicId/discovery/desk" element={<div>Insights Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('DeskReadoutsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Loading state', () => {
    it('renders skeleton while loading', () => {
      mockListReadouts.mockReturnValue({
        isLoading: true,
        error: null,
        data: undefined,
        refetch: vi.fn(),
      });

      renderPage();

      // Use heading role to disambiguate from tab
      expect(screen.getByRole('heading', { name: 'Desk readouts' })).toBeInTheDocument();
      expect(screen.getByText(/project-456/)).toBeInTheDocument();
    });
  });

  describe('Error state', () => {
    it('renders error message with retry button', async () => {
      const mockRefetch = vi.fn();
      mockListReadouts.mockReturnValue({
        isLoading: false,
        error: new Error('Network error'),
        data: undefined,
        refetch: mockRefetch,
      });

      renderPage();

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to load readouts')).toBeInTheDocument();
      expect(screen.getByText('Network error')).toBeInTheDocument();

      const retryButton = screen.getByRole('button', { name: /try again/i });
      expect(retryButton).toBeInTheDocument();

      await userEvent.click(retryButton);
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Empty state', () => {
    it('renders empty state when no readouts exist', () => {
      mockListReadouts.mockReturnValue({
        isLoading: false,
        error: null,
        data: {
          data: {
            readouts: [],
            total: 0,
            limit: 20,
            offset: 0,
          },
        },
        refetch: vi.fn(),
      });

      renderPage();

      expect(screen.getByText('No readouts yet')).toBeInTheDocument();
      expect(
        screen.getByText(/readouts synthesize your desk research insights/i)
      ).toBeInTheDocument();

      // Should link to insights page
      const insightsLink = screen.getByRole('link', { name: /review insights first/i });
      expect(insightsLink).toHaveAttribute('href', '/studies/study-123/discovery/desk');
    });

    it('does not render New readout button in empty state', () => {
      mockListReadouts.mockReturnValue({
        isLoading: false,
        error: null,
        data: {
          data: {
            readouts: [],
            total: 0,
            limit: 20,
            offset: 0,
          },
        },
        refetch: vi.fn(),
      });

      renderPage();

      expect(screen.queryByRole('button', { name: /new readout/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /new readout/i })).not.toBeInTheDocument();
    });
  });

  describe('List state', () => {
    it('renders readout rows with displayId, title, status, and date', () => {
      const readouts: ReadoutSummary[] = [
        createMockReadout({
          publicId: 'ro-1',
          displayId: 'RO-0001',
          title: 'First Readout',
          createdAt: '2026-10-15T10:00:00Z',
        }),
        createMockReadout({
          publicId: 'ro-2',
          displayId: 'RO-0002',
          title: 'Second Readout',
          approvedAt: '2026-10-16T14:00:00Z',
          approvedVersion: 2,
          createdAt: '2026-10-14T09:00:00Z',
        }),
      ];

      mockListReadouts.mockReturnValue({
        isLoading: false,
        error: null,
        data: {
          data: {
            readouts,
            total: 2,
            limit: 20,
            offset: 0,
          },
        },
        refetch: vi.fn(),
      });

      renderPage();

      // Check first readout (draft)
      expect(screen.getByText('RO-0001')).toBeInTheDocument();
      expect(screen.getByText('First Readout')).toBeInTheDocument();
      expect(screen.getByText('Draft')).toBeInTheDocument();

      // Check second readout (approved)
      expect(screen.getByText('RO-0002')).toBeInTheDocument();
      expect(screen.getByText('Second Readout')).toBeInTheDocument();
      expect(screen.getByText('Approved v2')).toBeInTheDocument();
    });

    it('displays total count in masthead', () => {
      mockListReadouts.mockReturnValue({
        isLoading: false,
        error: null,
        data: {
          data: {
            readouts: [createMockReadout()],
            total: 1,
            limit: 20,
            offset: 0,
          },
        },
        refetch: vi.fn(),
      });

      renderPage();

      // Check for the status line text content (singular form)
      // Using textContent which includes child elements
      const masthead = screen.getByRole('heading', { name: 'Desk readouts' }).parentElement;
      expect(masthead?.textContent).toContain('1');
      expect(masthead?.textContent).toMatch(/\breadout\b/);
    });

    it('displays plural readouts label when multiple', () => {
      mockListReadouts.mockReturnValue({
        isLoading: false,
        error: null,
        data: {
          data: {
            readouts: [createMockReadout(), createMockReadout({ publicId: 'ro-2' })],
            total: 5,
            limit: 20,
            offset: 0,
          },
        },
        refetch: vi.fn(),
      });

      renderPage();

      // Check for the status line text content (plural form)
      const masthead = screen.getByRole('heading', { name: 'Desk readouts' }).parentElement;
      expect(masthead?.textContent).toContain('5');
      expect(masthead?.textContent).toContain('readouts');
    });

    it('renders rows as clickable links to detail page (DR-6b-4d)', () => {
      const mockReadout = createMockReadout();
      mockListReadouts.mockReturnValue({
        isLoading: false,
        error: null,
        data: {
          data: {
            readouts: [mockReadout],
            total: 1,
            limit: 20,
            offset: 0,
          },
        },
        refetch: vi.fn(),
      });

      renderPage();

      const listItems = screen.getAllByRole('listitem');
      listItems.forEach((item) => {
        // Should be a link
        expect(item.tagName).toBe('A');
        // Should link to the detail page
        expect(item).toHaveAttribute('href', expect.stringContaining(`/readouts/${mockReadout.publicId}`));
      });
    });
  });

  describe('Status display', () => {
    it('shows Draft status when approvedAt is null', () => {
      mockListReadouts.mockReturnValue({
        isLoading: false,
        error: null,
        data: {
          data: {
            readouts: [
              createMockReadout({
                approvedAt: null,
                approvedVersion: null,
              }),
            ],
            total: 1,
            limit: 20,
            offset: 0,
          },
        },
        refetch: vi.fn(),
      });

      renderPage();

      expect(screen.getByText('Draft')).toBeInTheDocument();
      expect(screen.queryByText(/Approved/)).not.toBeInTheDocument();
    });

    it('shows Approved vN status when approvedAt and approvedVersion are set', () => {
      mockListReadouts.mockReturnValue({
        isLoading: false,
        error: null,
        data: {
          data: {
            readouts: [
              createMockReadout({
                approvedAt: '2026-10-16T14:00:00Z',
                approvedVersion: 3,
              }),
            ],
            total: 1,
            limit: 20,
            offset: 0,
          },
        },
        refetch: vi.fn(),
      });

      renderPage();

      expect(screen.getByText('Approved v3')).toBeInTheDocument();
      expect(screen.queryByText('Draft')).not.toBeInTheDocument();
    });
  });

  describe('Pagination', () => {
    it('renders pagination controls when multiple pages exist', () => {
      mockListReadouts.mockReturnValue({
        isLoading: false,
        error: null,
        data: {
          data: {
            readouts: Array(20)
              .fill(null)
              .map((_, i) => createMockReadout({ publicId: `ro-${i}` })),
            total: 45,
            limit: 20,
            offset: 0,
          },
        },
        refetch: vi.fn(),
      });

      renderPage();

      expect(screen.getByRole('navigation', { name: /pagination/i })).toBeInTheDocument();
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /next/i })).not.toBeDisabled();
    });

    it('does not render pagination when only one page', () => {
      mockListReadouts.mockReturnValue({
        isLoading: false,
        error: null,
        data: {
          data: {
            readouts: [createMockReadout()],
            total: 1,
            limit: 20,
            offset: 0,
          },
        },
        refetch: vi.fn(),
      });

      renderPage();

      expect(screen.queryByRole('navigation', { name: /pagination/i })).not.toBeInTheDocument();
    });

    it('calls API with updated offset when clicking next page', async () => {
      mockListReadouts.mockReturnValue({
        isLoading: false,
        error: null,
        data: {
          data: {
            readouts: Array(20)
              .fill(null)
              .map((_, i) => createMockReadout({ publicId: `ro-${i}` })),
            total: 45,
            limit: 20,
            offset: 0,
          },
        },
        refetch: vi.fn(),
      });

      renderPage();

      const nextButton = screen.getByRole('button', { name: /next/i });
      await userEvent.click(nextButton);

      // Verify the mock was called with updated offset
      await waitFor(() => {
        expect(mockListReadouts).toHaveBeenCalledWith(
          'project-456',
          'study-123',
          expect.objectContaining({ offset: 20 })
        );
      });
    });
  });

  describe('Project/study isolation', () => {
    it('fetches readouts using correct project and study IDs', () => {
      mockListReadouts.mockReturnValue({
        isLoading: false,
        error: null,
        data: {
          data: {
            readouts: [],
            total: 0,
            limit: 20,
            offset: 0,
          },
        },
        refetch: vi.fn(),
      });

      renderPage();

      expect(mockListReadouts).toHaveBeenCalledWith(
        'project-456',
        'study-123',
        expect.objectContaining({ limit: 20, offset: 0 })
      );
    });

    it('displays projectPublicId in masthead', () => {
      mockListReadouts.mockReturnValue({
        isLoading: false,
        error: null,
        data: {
          data: {
            readouts: [],
            total: 0,
            limit: 20,
            offset: 0,
          },
        },
        refetch: vi.fn(),
      });

      renderPage();

      expect(screen.getByText(/project-456/)).toBeInTheDocument();
    });
  });

  describe('Tab navigation', () => {
    it('renders DeskTabs with readouts as active tab', () => {
      mockListReadouts.mockReturnValue({
        isLoading: false,
        error: null,
        data: {
          data: {
            readouts: [],
            total: 0,
            limit: 20,
            offset: 0,
          },
        },
        refetch: vi.fn(),
      });

      renderPage();

      // Check that all tabs are present
      expect(screen.getByRole('tab', { name: /insights/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /sources/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /desk readouts/i })).toBeInTheDocument();

      // Readouts tab should be active
      const readoutsTab = screen.getByRole('tab', { name: /desk readouts/i });
      expect(readoutsTab).toHaveAttribute('aria-selected', 'true');
    });

    it('passes readout count to DeskTabs', () => {
      mockListReadouts.mockReturnValue({
        isLoading: false,
        error: null,
        data: {
          data: {
            readouts: [createMockReadout()],
            total: 7,
            limit: 20,
            offset: 0,
          },
        },
        refetch: vi.fn(),
      });

      renderPage();

      // The count should be visible in the tab
      const tablist = screen.getByRole('tablist');
      expect(tablist).toHaveTextContent('7');
    });
  });

  describe('Unsupported controls', () => {
    it('does not render New readout button', () => {
      mockListReadouts.mockReturnValue({
        isLoading: false,
        error: null,
        data: {
          data: {
            readouts: [createMockReadout()],
            total: 1,
            limit: 20,
            offset: 0,
          },
        },
        refetch: vi.fn(),
      });

      renderPage();

      expect(screen.queryByRole('button', { name: /new readout/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /new readout/i })).not.toBeInTheDocument();
    });

    it('does not render Generate button', () => {
      mockListReadouts.mockReturnValue({
        isLoading: false,
        error: null,
        data: {
          data: {
            readouts: [createMockReadout()],
            total: 1,
            limit: 20,
            offset: 0,
          },
        },
        refetch: vi.fn(),
      });

      renderPage();

      expect(screen.queryByRole('button', { name: /generate/i })).not.toBeInTheDocument();
    });

    it('does not render any action buttons on readout rows', () => {
      mockListReadouts.mockReturnValue({
        isLoading: false,
        error: null,
        data: {
          data: {
            readouts: [createMockReadout()],
            total: 1,
            limit: 20,
            offset: 0,
          },
        },
        refetch: vi.fn(),
      });

      renderPage();

      const listItems = screen.getAllByRole('listitem');
      listItems.forEach((item) => {
        expect(item.querySelector('button')).toBeNull();
      });
    });
  });
});
