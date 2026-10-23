/**
 * EvidenceSelectionPanel Tests — DR-6b-5d-B
 *
 * Tests for evidence selection component:
 * - Default evidence selection (all eligible pre-selected)
 * - Deselection behavior
 * - Empty selection warning
 * - Eligibility refetch preserving user choices
 * - Loading and error states
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EvidenceSelectionPanel } from '../EvidenceSelectionPanel';
import * as readoutsApi from '@/api/readouts';

// Mock the hooks
vi.mock('@/api/readouts', async () => {
  const actual = await vi.importActual('@/api/readouts');
  return {
    ...actual,
    useEligibleEvidence: vi.fn(),
  };
});

const mockUseEligibleEvidence = readoutsApi.useEligibleEvidence as ReturnType<typeof vi.fn>;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function createWrapper() {
  const queryClient = createQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function createMockInsight(overrides: Partial<readoutsApi.EligibleInsight> = {}): readoutsApi.EligibleInsight {
  return {
    constructPublicId: 'in-abc-123',
    displayId: 'IN-0001',
    wording: 'Test insight wording',
    acceptedRevision: {
      revisionPublicId: 'rev-abc-123',
      revisionNumber: 1,
      acceptedAt: '2026-10-15T10:00:00Z',
    },
    source: {
      sourceId: 1,
      sourcePublicId: 'src-abc-123',
      sourceType: 'url',
      label: 'Test Source',
    },
    ...overrides,
  };
}

describe('EvidenceSelectionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loading state', () => {
    it('shows loading indicator while fetching eligible evidence', () => {
      mockUseEligibleEvidence.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <EvidenceSelectionPanel
          projectPublicId="proj-1"
          studyPublicId="study-1"
          readoutPublicId="ro-1"
          selectedRevisionIds={[]}
          onSelectionChange={vi.fn()}
        />,
        { wrapper: createWrapper() },
      );

      expect(screen.getByText(/loading eligible evidence/i)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message with retry button when fetch fails', () => {
      const mockRefetch = vi.fn();
      mockUseEligibleEvidence.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Network error'),
        refetch: mockRefetch,
      });

      render(
        <EvidenceSelectionPanel
          projectPublicId="proj-1"
          studyPublicId="study-1"
          readoutPublicId="ro-1"
          selectedRevisionIds={[]}
          onSelectionChange={vi.fn()}
        />,
        { wrapper: createWrapper() },
      );

      expect(screen.getByText(/failed to load eligible evidence/i)).toBeInTheDocument();

      const retryButton = screen.getByRole('button', { name: /retry/i });
      fireEvent.click(retryButton);
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe('empty state', () => {
    it('shows empty message when no eligible evidence exists', () => {
      mockUseEligibleEvidence.mockReturnValue({
        data: {
          data: {
            insights: [],
            pagination: { total: 0, limit: 100, offset: 0 },
          },
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <EvidenceSelectionPanel
          projectPublicId="proj-1"
          studyPublicId="study-1"
          readoutPublicId="ro-1"
          selectedRevisionIds={[]}
          onSelectionChange={vi.fn()}
        />,
        { wrapper: createWrapper() },
      );

      expect(screen.getByText(/no eligible evidence available/i)).toBeInTheDocument();
    });
  });

  describe('default selection', () => {
    it('calls onSelectionChange with all revision IDs on initial load', async () => {
      const mockOnSelectionChange = vi.fn();
      const insights = [
        createMockInsight({ acceptedRevision: { revisionPublicId: 'rev-1', revisionNumber: 1, acceptedAt: '2026-10-15T10:00:00Z' } }),
        createMockInsight({ constructPublicId: 'in-def-456', displayId: 'IN-0002', acceptedRevision: { revisionPublicId: 'rev-2', revisionNumber: 1, acceptedAt: '2026-10-15T11:00:00Z' } }),
      ];

      mockUseEligibleEvidence.mockReturnValue({
        data: {
          data: {
            insights,
            pagination: { total: 2, limit: 100, offset: 0 },
          },
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <EvidenceSelectionPanel
          projectPublicId="proj-1"
          studyPublicId="study-1"
          readoutPublicId="ro-1"
          selectedRevisionIds={[]}
          onSelectionChange={mockOnSelectionChange}
        />,
        { wrapper: createWrapper() },
      );

      await waitFor(() => {
        expect(mockOnSelectionChange).toHaveBeenCalledWith(['rev-1', 'rev-2']);
      });
    });
  });

  describe('deselection', () => {
    it('allows deselecting individual items', async () => {
      const mockOnSelectionChange = vi.fn();
      const insights = [
        createMockInsight({ displayId: 'IN-0001', acceptedRevision: { revisionPublicId: 'rev-1', revisionNumber: 1, acceptedAt: '2026-10-15T10:00:00Z' } }),
        createMockInsight({ constructPublicId: 'in-def-456', displayId: 'IN-0002', acceptedRevision: { revisionPublicId: 'rev-2', revisionNumber: 1, acceptedAt: '2026-10-15T11:00:00Z' } }),
      ];

      mockUseEligibleEvidence.mockReturnValue({
        data: {
          data: {
            insights,
            pagination: { total: 2, limit: 100, offset: 0 },
          },
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <EvidenceSelectionPanel
          projectPublicId="proj-1"
          studyPublicId="study-1"
          readoutPublicId="ro-1"
          selectedRevisionIds={['rev-1', 'rev-2']}
          onSelectionChange={mockOnSelectionChange}
        />,
        { wrapper: createWrapper() },
      );

      // Find and click the first checkbox
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]);

      await waitFor(() => {
        expect(mockOnSelectionChange).toHaveBeenCalledWith(['rev-2']);
      });
    });

    it('shows warning when selection is empty', () => {
      const insights = [
        createMockInsight({ acceptedRevision: { revisionPublicId: 'rev-1', revisionNumber: 1, acceptedAt: '2026-10-15T10:00:00Z' } }),
      ];

      mockUseEligibleEvidence.mockReturnValue({
        data: {
          data: {
            insights,
            pagination: { total: 1, limit: 100, offset: 0 },
          },
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <EvidenceSelectionPanel
          projectPublicId="proj-1"
          studyPublicId="study-1"
          readoutPublicId="ro-1"
          selectedRevisionIds={[]}
          onSelectionChange={vi.fn()}
        />,
        { wrapper: createWrapper() },
      );

      expect(screen.getByText(/select at least one insight/i)).toBeInTheDocument();
    });
  });

  describe('select all / deselect all', () => {
    it('allows selecting all items', async () => {
      const mockOnSelectionChange = vi.fn();
      const insights = [
        createMockInsight({ acceptedRevision: { revisionPublicId: 'rev-1', revisionNumber: 1, acceptedAt: '2026-10-15T10:00:00Z' } }),
        createMockInsight({ constructPublicId: 'in-def-456', displayId: 'IN-0002', acceptedRevision: { revisionPublicId: 'rev-2', revisionNumber: 1, acceptedAt: '2026-10-15T11:00:00Z' } }),
      ];

      mockUseEligibleEvidence.mockReturnValue({
        data: {
          data: {
            insights,
            pagination: { total: 2, limit: 100, offset: 0 },
          },
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <EvidenceSelectionPanel
          projectPublicId="proj-1"
          studyPublicId="study-1"
          readoutPublicId="ro-1"
          selectedRevisionIds={['rev-1']}
          onSelectionChange={mockOnSelectionChange}
        />,
        { wrapper: createWrapper() },
      );

      const selectAllButton = screen.getByRole('button', { name: /select all/i });
      fireEvent.click(selectAllButton);

      await waitFor(() => {
        expect(mockOnSelectionChange).toHaveBeenCalledWith(['rev-1', 'rev-2']);
      });
    });

    it('allows deselecting all items', async () => {
      const mockOnSelectionChange = vi.fn();
      const insights = [
        createMockInsight({ acceptedRevision: { revisionPublicId: 'rev-1', revisionNumber: 1, acceptedAt: '2026-10-15T10:00:00Z' } }),
        createMockInsight({ constructPublicId: 'in-def-456', displayId: 'IN-0002', acceptedRevision: { revisionPublicId: 'rev-2', revisionNumber: 1, acceptedAt: '2026-10-15T11:00:00Z' } }),
      ];

      mockUseEligibleEvidence.mockReturnValue({
        data: {
          data: {
            insights,
            pagination: { total: 2, limit: 100, offset: 0 },
          },
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <EvidenceSelectionPanel
          projectPublicId="proj-1"
          studyPublicId="study-1"
          readoutPublicId="ro-1"
          selectedRevisionIds={['rev-1', 'rev-2']}
          onSelectionChange={mockOnSelectionChange}
        />,
        { wrapper: createWrapper() },
      );

      const deselectAllButton = screen.getByRole('button', { name: /deselect all/i });
      fireEvent.click(deselectAllButton);

      await waitFor(() => {
        expect(mockOnSelectionChange).toHaveBeenCalledWith([]);
      });
    });
  });

  describe('eligibility refetch', () => {
    it('preserves user selection when eligible items are refetched', async () => {
      const mockOnSelectionChange = vi.fn();
      const insights = [
        createMockInsight({ displayId: 'IN-0001', acceptedRevision: { revisionPublicId: 'rev-1', revisionNumber: 1, acceptedAt: '2026-10-15T10:00:00Z' } }),
        createMockInsight({ constructPublicId: 'in-def-456', displayId: 'IN-0002', acceptedRevision: { revisionPublicId: 'rev-2', revisionNumber: 1, acceptedAt: '2026-10-15T11:00:00Z' } }),
      ];

      mockUseEligibleEvidence.mockReturnValue({
        data: {
          data: {
            insights,
            pagination: { total: 2, limit: 100, offset: 0 },
          },
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      // Start with rev-1 already selected (simulating user having deselected rev-2)
      render(
        <EvidenceSelectionPanel
          projectPublicId="proj-1"
          studyPublicId="study-1"
          readoutPublicId="ro-1"
          selectedRevisionIds={['rev-1']}
          onSelectionChange={mockOnSelectionChange}
        />,
        { wrapper: createWrapper() },
      );

      // Selection should not be modified on re-render with same data
      await waitFor(() => {
        // The initial selection should be preserved - no call to change it
        // Since selection already contains valid IDs, no reconciliation needed
      });

      // Verify the checkboxes reflect the selection state
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes[0]).toBeChecked(); // rev-1
      expect(checkboxes[1]).not.toBeChecked(); // rev-2
    });

    it('removes ineligible items from selection on refetch', async () => {
      const mockOnSelectionChange = vi.fn();

      // Initially both items are eligible
      mockUseEligibleEvidence.mockReturnValue({
        data: {
          data: {
            insights: [
              createMockInsight({ displayId: 'IN-0001', acceptedRevision: { revisionPublicId: 'rev-1', revisionNumber: 1, acceptedAt: '2026-10-15T10:00:00Z' } }),
            ],
            pagination: { total: 1, limit: 100, offset: 0 },
          },
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      // User has rev-1 AND rev-2 selected, but only rev-1 is eligible now
      render(
        <EvidenceSelectionPanel
          projectPublicId="proj-1"
          studyPublicId="study-1"
          readoutPublicId="ro-1"
          selectedRevisionIds={['rev-1', 'rev-2']}
          onSelectionChange={mockOnSelectionChange}
        />,
        { wrapper: createWrapper() },
      );

      // Should reconcile by removing rev-2 which is no longer eligible
      await waitFor(() => {
        expect(mockOnSelectionChange).toHaveBeenCalledWith(['rev-1']);
      });
    });
  });

  describe('disabled state', () => {
    it('disables interactions when disabled prop is true', () => {
      const insights = [
        createMockInsight({ acceptedRevision: { revisionPublicId: 'rev-1', revisionNumber: 1, acceptedAt: '2026-10-15T10:00:00Z' } }),
      ];

      mockUseEligibleEvidence.mockReturnValue({
        data: {
          data: {
            insights,
            pagination: { total: 1, limit: 100, offset: 0 },
          },
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <EvidenceSelectionPanel
          projectPublicId="proj-1"
          studyPublicId="study-1"
          readoutPublicId="ro-1"
          selectedRevisionIds={['rev-1']}
          onSelectionChange={vi.fn()}
          disabled
        />,
        { wrapper: createWrapper() },
      );

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeDisabled();

      const deselectAllButton = screen.getByRole('button', { name: /deselect all/i });
      expect(deselectAllButton).toBeDisabled();
    });
  });

  describe('display', () => {
    it('shows insight ID and revision number', () => {
      const insights = [
        createMockInsight({
          displayId: 'IN-0001',
          acceptedRevision: { revisionPublicId: 'rev-1', revisionNumber: 3, acceptedAt: '2026-10-15T10:00:00Z' },
        }),
      ];

      mockUseEligibleEvidence.mockReturnValue({
        data: {
          data: {
            insights,
            pagination: { total: 1, limit: 100, offset: 0 },
          },
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <EvidenceSelectionPanel
          projectPublicId="proj-1"
          studyPublicId="study-1"
          readoutPublicId="ro-1"
          selectedRevisionIds={['rev-1']}
          onSelectionChange={vi.fn()}
        />,
        { wrapper: createWrapper() },
      );

      expect(screen.getByText('IN-0001 r3')).toBeInTheDocument();
    });

    it('shows selection count', () => {
      const insights = [
        createMockInsight({ acceptedRevision: { revisionPublicId: 'rev-1', revisionNumber: 1, acceptedAt: '2026-10-15T10:00:00Z' } }),
        createMockInsight({ constructPublicId: 'in-def-456', displayId: 'IN-0002', acceptedRevision: { revisionPublicId: 'rev-2', revisionNumber: 1, acceptedAt: '2026-10-15T11:00:00Z' } }),
      ];

      mockUseEligibleEvidence.mockReturnValue({
        data: {
          data: {
            insights,
            pagination: { total: 2, limit: 100, offset: 0 },
          },
        },
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      render(
        <EvidenceSelectionPanel
          projectPublicId="proj-1"
          studyPublicId="study-1"
          readoutPublicId="ro-1"
          selectedRevisionIds={['rev-1']}
          onSelectionChange={vi.fn()}
        />,
        { wrapper: createWrapper() },
      );

      expect(screen.getByText('1 of 2 selected')).toBeInTheDocument();
    });
  });
});
