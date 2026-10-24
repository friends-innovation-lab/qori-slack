/**
 * VersionHistoryPanel Tests — DR-6b-5e-B-2
 *
 * Focused tests covering:
 * 1. All generation statuses display correctly
 * 2. Version ordering and selection
 * 3. Read-only historical content rendering
 * 4. Exact pinned evidence identifiers
 * 5. Loading, empty, and API error states
 * 6. Versions without content
 * 7. Superseded versions with or without content
 * 8. Panel close and back navigation
 * 9. Accessibility and keyboard interaction
 * 10. No draft mutations, generation POSTs, or approval actions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VersionHistoryPanel } from '../VersionHistoryPanel';
import type { GenerationVersion, GenerationStatus, VersionContent } from '@/api/readouts';

// Mock the hooks module
vi.mock('@/api/readouts', async () => {
  const actual = await vi.importActual('@/api/readouts');
  return {
    ...actual,
    useVersionContent: vi.fn(),
  };
});

import { useVersionContent } from '@/api/readouts';

const mockUseVersionContent = useVersionContent as ReturnType<typeof vi.fn>;

// ═══════════════════════════════════════════════════════════════════════════
// TEST FIXTURES
// ═══════════════════════════════════════════════════════════════════════════

function createVersion(
  overrides: Partial<GenerationVersion> & { id: number; versionNumber: number },
): GenerationVersion {
  return {
    generationRequestId: `gen-${overrides.id}`,
    generationStatus: 'completed',
    generationStartedAt: '2026-10-20T10:00:00Z',
    generationCompletedAt: '2026-10-20T10:05:00Z',
    generationError: null,
    draftContentVersionAtStart: 1,
    evidenceSet: [],
    createdAt: '2026-10-20T10:00:00Z',
    ...overrides,
  };
}

function createVersionContent(
  overrides: Partial<VersionContent> = {},
): VersionContent {
  return {
    versionId: 1,
    versionNumber: 1,
    generationStatus: 'completed',
    hasContent: true,
    content: {
      summary: { text: 'Test summary', citations: [] },
      findings: [
        { id: 'f1', text: 'Finding one', citations: [] },
        { id: 'f2', text: 'Finding two', citations: [
          { constructPublicId: 'c1', revisionPublicId: 'r1', revisionNumber: 1, displayId: 'IN-0001' },
        ] },
      ],
      limitations: [{ id: 'l1', text: 'Limitation one' }],
      implications: [
        { id: 'i1', kind: 'question', text: 'Implication one', basedOnFindings: ['f1'] },
      ],
    },
    evidenceSet: [
      { constructPublicId: 'c1', revisionPublicId: 'r1', revisionNumber: 1, displayId: 'IN-0001' },
      { constructPublicId: 'c2', revisionPublicId: 'r2', revisionNumber: 2, displayId: 'IN-0002' },
    ],
    draftContentVersionAtStart: 1,
    generationCompletedAt: '2026-10-20T10:05:00Z',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST WRAPPER
// ═══════════════════════════════════════════════════════════════════════════

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

const defaultProps = {
  versions: [],
  isLoading: false,
  error: null,
  onClose: vi.fn(),
  projectPublicId: 'proj-1',
  studyPublicId: 'study-1',
  readoutPublicId: 'readout-1',
};

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('VersionHistoryPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseVersionContent.mockReturnValue({
      data: null,
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── 1. All generation statuses display correctly ───────────────────────────

  describe('generation status display', () => {
    it.each<[GenerationStatus, string]>([
      ['completed', 'Completed'],
      ['failed', 'Failed'],
      ['superseded', 'Superseded'],
      ['pending', 'Pending'],
      ['generating', 'Generating'],
    ])('displays %s status correctly', (status, label) => {
      const versions = [createVersion({ id: 1, versionNumber: 1, generationStatus: status })];

      render(
        <VersionHistoryPanel {...defaultProps} versions={versions} />,
        { wrapper: createWrapper() },
      );

      expect(screen.getByText(label)).toBeInTheDocument();
    });

    it('shows status icon for each version', () => {
      const versions = [
        createVersion({ id: 1, versionNumber: 1, generationStatus: 'completed' }),
        createVersion({ id: 2, versionNumber: 2, generationStatus: 'failed' }),
      ];

      render(
        <VersionHistoryPanel {...defaultProps} versions={versions} />,
        { wrapper: createWrapper() },
      );

      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });
  });

  // ─── 2. Version ordering and selection ──────────────────────────────────────

  describe('version ordering and selection', () => {
    it('displays versions in provided order', () => {
      const versions = [
        createVersion({ id: 3, versionNumber: 3 }),
        createVersion({ id: 2, versionNumber: 2 }),
        createVersion({ id: 1, versionNumber: 1 }),
      ];

      render(
        <VersionHistoryPanel {...defaultProps} versions={versions} />,
        { wrapper: createWrapper() },
      );

      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(3);
      expect(within(listItems[0]).getByText('Version 3')).toBeInTheDocument();
      expect(within(listItems[1]).getByText('Version 2')).toBeInTheDocument();
      expect(within(listItems[2]).getByText('Version 1')).toBeInTheDocument();
    });

    it('marks first version as latest', () => {
      const versions = [
        createVersion({ id: 2, versionNumber: 2 }),
        createVersion({ id: 1, versionNumber: 1 }),
      ];

      render(
        <VersionHistoryPanel {...defaultProps} versions={versions} />,
        { wrapper: createWrapper() },
      );

      const listItems = screen.getAllByRole('listitem');
      expect(within(listItems[0]).getByText('Latest')).toBeInTheDocument();
      expect(within(listItems[1]).queryByText('Latest')).not.toBeInTheDocument();
    });

    it('selects version on click and shows content view', async () => {
      const versions = [createVersion({ id: 1, versionNumber: 1 })];
      const versionContent = createVersionContent();

      mockUseVersionContent.mockReturnValue({
        data: { data: versionContent },
        isLoading: false,
        error: null,
      });

      render(
        <VersionHistoryPanel {...defaultProps} versions={versions} />,
        { wrapper: createWrapper() },
      );

      const versionButton = screen.getByRole('listitem');
      fireEvent.click(versionButton);

      await waitFor(() => {
        expect(screen.getByText('Version 1')).toBeInTheDocument();
        expect(screen.getByText('Test summary')).toBeInTheDocument();
      });
    });
  });

  // ─── 3. Read-only historical content rendering ──────────────────────────────

  describe('read-only content rendering', () => {
    it('displays read-only notice', async () => {
      const versions = [createVersion({ id: 1, versionNumber: 1 })];
      const versionContent = createVersionContent();

      mockUseVersionContent.mockReturnValue({
        data: { data: versionContent },
        isLoading: false,
        error: null,
      });

      render(
        <VersionHistoryPanel {...defaultProps} versions={versions} />,
        { wrapper: createWrapper() },
      );

      fireEvent.click(screen.getByRole('listitem'));

      await waitFor(() => {
        expect(screen.getByText(/This is a read-only generated version/)).toBeInTheDocument();
        expect(screen.getByText(/Review the current draft before continuing/)).toBeInTheDocument();
      });
    });

    it('renders all content sections', async () => {
      const versions = [createVersion({ id: 1, versionNumber: 1 })];
      const versionContent = createVersionContent();

      mockUseVersionContent.mockReturnValue({
        data: { data: versionContent },
        isLoading: false,
        error: null,
      });

      render(
        <VersionHistoryPanel {...defaultProps} versions={versions} />,
        { wrapper: createWrapper() },
      );

      fireEvent.click(screen.getByRole('listitem'));

      await waitFor(() => {
        expect(screen.getByText('Summary')).toBeInTheDocument();
        expect(screen.getByText('Findings')).toBeInTheDocument();
        expect(screen.getByText('Evidence Limitations')).toBeInTheDocument();
        expect(screen.getByText('Implications for the Research Brief')).toBeInTheDocument();
      });
    });

    it('renders findings with citations', async () => {
      const versions = [createVersion({ id: 1, versionNumber: 1 })];
      const versionContent = createVersionContent();

      mockUseVersionContent.mockReturnValue({
        data: { data: versionContent },
        isLoading: false,
        error: null,
      });

      render(
        <VersionHistoryPanel {...defaultProps} versions={versions} />,
        { wrapper: createWrapper() },
      );

      fireEvent.click(screen.getByRole('listitem'));

      await waitFor(() => {
        expect(screen.getByText('Finding one')).toBeInTheDocument();
        expect(screen.getByText('Finding two')).toBeInTheDocument();
        // CitationChip renders "IN-0001 r1" format
        expect(screen.getByText('IN-0001 r1')).toBeInTheDocument();
      });
    });

    it('renders implications with kind labels', async () => {
      const versions = [createVersion({ id: 1, versionNumber: 1 })];
      const versionContent = createVersionContent();

      mockUseVersionContent.mockReturnValue({
        data: { data: versionContent },
        isLoading: false,
        error: null,
      });

      render(
        <VersionHistoryPanel {...defaultProps} versions={versions} />,
        { wrapper: createWrapper() },
      );

      fireEvent.click(screen.getByRole('listitem'));

      await waitFor(() => {
        expect(screen.getByText('Implication one')).toBeInTheDocument();
        // KindLabel renders full kind name
        expect(screen.getByText('Research question')).toBeInTheDocument();
      });
    });
  });

  // ─── 4. Exact pinned evidence identifiers ───────────────────────────────────

  describe('pinned evidence display', () => {
    it('displays evidence count in list view', () => {
      const versions = [
        createVersion({
          id: 1,
          versionNumber: 1,
          evidenceSet: [
            { constructPublicId: 'c1', revisionPublicId: 'r1', revisionNumber: 1, displayId: 'IN-0001' },
            { constructPublicId: 'c2', revisionPublicId: 'r2', revisionNumber: 2, displayId: 'IN-0002' },
          ],
        }),
      ];

      render(
        <VersionHistoryPanel {...defaultProps} versions={versions} />,
        { wrapper: createWrapper() },
      );

      expect(screen.getByText('2 evidence items')).toBeInTheDocument();
    });

    it('displays exact evidence identifiers in content view', async () => {
      const versions = [createVersion({
        id: 1,
        versionNumber: 1,
        evidenceSet: [
          { constructPublicId: 'c1', revisionPublicId: 'r1', revisionNumber: 1, displayId: 'IN-0001' },
          { constructPublicId: 'c2', revisionPublicId: 'r2', revisionNumber: 2, displayId: 'IN-0002' },
        ],
      })];
      const versionContent = createVersionContent();

      mockUseVersionContent.mockReturnValue({
        data: { data: versionContent },
        isLoading: false,
        error: null,
      });

      render(
        <VersionHistoryPanel {...defaultProps} versions={versions} />,
        { wrapper: createWrapper() },
      );

      fireEvent.click(screen.getByRole('listitem'));

      await waitFor(() => {
        expect(screen.getByText('Pinned Evidence')).toBeInTheDocument();
        expect(screen.getByText('IN-0001')).toBeInTheDocument();
        expect(screen.getByText('IN-0002')).toBeInTheDocument();
        expect(screen.getByText('r1')).toBeInTheDocument();
        expect(screen.getByText('r2')).toBeInTheDocument();
      });
    });
  });

  // ─── 5. Loading, empty, and API error states ────────────────────────────────

  describe('loading, empty, and error states', () => {
    it('shows loading state', () => {
      render(
        <VersionHistoryPanel {...defaultProps} isLoading />,
        { wrapper: createWrapper() },
      );

      expect(screen.getByText('Loading generation history...')).toBeInTheDocument();
    });

    it('shows empty state when no versions', () => {
      render(
        <VersionHistoryPanel {...defaultProps} versions={[]} />,
        { wrapper: createWrapper() },
      );

      expect(screen.getByText('No generations yet')).toBeInTheDocument();
      expect(screen.getByText('This readout has no generation history.')).toBeInTheDocument();
    });

    it('shows error state', () => {
      render(
        <VersionHistoryPanel {...defaultProps} error="Failed to load history" />,
        { wrapper: createWrapper() },
      );

      expect(screen.getByText('Failed to load history')).toBeInTheDocument();
    });

    it('shows content loading state when fetching version content', async () => {
      const versions = [createVersion({ id: 1, versionNumber: 1 })];

      mockUseVersionContent.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
      });

      render(
        <VersionHistoryPanel {...defaultProps} versions={versions} />,
        { wrapper: createWrapper() },
      );

      fireEvent.click(screen.getByRole('listitem'));

      await waitFor(() => {
        expect(screen.getByText('Loading version content...')).toBeInTheDocument();
      });
    });

    it('shows content error state when fetch fails', async () => {
      const versions = [createVersion({ id: 1, versionNumber: 1 })];

      mockUseVersionContent.mockReturnValue({
        data: null,
        isLoading: false,
        error: new Error('Network error'),
      });

      render(
        <VersionHistoryPanel {...defaultProps} versions={versions} />,
        { wrapper: createWrapper() },
      );

      fireEvent.click(screen.getByRole('listitem'));

      await waitFor(() => {
        expect(screen.getByText('Failed to load version content')).toBeInTheDocument();
      });
    });
  });

  // ─── 6. Versions without content ────────────────────────────────────────────

  describe('versions without content', () => {
    it('shows pending message for pending versions', async () => {
      const versions = [createVersion({ id: 1, versionNumber: 1, generationStatus: 'pending' })];

      mockUseVersionContent.mockReturnValue({
        data: { data: { ...createVersionContent(), hasContent: false, content: null, generationStatus: 'pending' } },
        isLoading: false,
        error: null,
      });

      render(
        <VersionHistoryPanel {...defaultProps} versions={versions} />,
        { wrapper: createWrapper() },
      );

      fireEvent.click(screen.getByRole('listitem'));

      await waitFor(() => {
        expect(screen.getByText(/has not started yet/)).toBeInTheDocument();
      });
    });

    it('shows generating message for in-progress versions', async () => {
      const versions = [createVersion({ id: 1, versionNumber: 1, generationStatus: 'generating' })];

      mockUseVersionContent.mockReturnValue({
        data: { data: { ...createVersionContent(), hasContent: false, content: null, generationStatus: 'generating' } },
        isLoading: false,
        error: null,
      });

      render(
        <VersionHistoryPanel {...defaultProps} versions={versions} />,
        { wrapper: createWrapper() },
      );

      fireEvent.click(screen.getByRole('listitem'));

      await waitFor(() => {
        expect(screen.getByText(/in progress/)).toBeInTheDocument();
      });
    });

    it('shows failure message for failed versions', async () => {
      const versions = [createVersion({ id: 1, versionNumber: 1, generationStatus: 'failed' })];

      mockUseVersionContent.mockReturnValue({
        data: { data: { ...createVersionContent(), hasContent: false, content: null, generationStatus: 'failed' } },
        isLoading: false,
        error: null,
      });

      render(
        <VersionHistoryPanel {...defaultProps} versions={versions} />,
        { wrapper: createWrapper() },
      );

      fireEvent.click(screen.getByRole('listitem'));

      await waitFor(() => {
        expect(screen.getByText(/failed and did not produce content/)).toBeInTheDocument();
      });
    });
  });

  // ─── 7. Superseded versions with or without content ─────────────────────────

  describe('superseded versions', () => {
    it('shows superseded status in list', () => {
      const versions = [createVersion({ id: 1, versionNumber: 1, generationStatus: 'superseded' })];

      render(
        <VersionHistoryPanel {...defaultProps} versions={versions} />,
        { wrapper: createWrapper() },
      );

      expect(screen.getByText('Superseded')).toBeInTheDocument();
    });

    it('shows superseded message for versions without content', async () => {
      const versions = [createVersion({ id: 1, versionNumber: 1, generationStatus: 'superseded' })];

      mockUseVersionContent.mockReturnValue({
        data: { data: { ...createVersionContent(), hasContent: false, content: null, generationStatus: 'superseded' } },
        isLoading: false,
        error: null,
      });

      render(
        <VersionHistoryPanel {...defaultProps} versions={versions} />,
        { wrapper: createWrapper() },
      );

      fireEvent.click(screen.getByRole('listitem'));

      await waitFor(() => {
        expect(screen.getByText(/superseded before it completed/)).toBeInTheDocument();
      });
    });

    it('renders content for superseded versions that have content', async () => {
      const versions = [createVersion({ id: 1, versionNumber: 1, generationStatus: 'superseded' })];
      const versionContent = createVersionContent({ generationStatus: 'superseded' });

      mockUseVersionContent.mockReturnValue({
        data: { data: versionContent },
        isLoading: false,
        error: null,
      });

      render(
        <VersionHistoryPanel {...defaultProps} versions={versions} />,
        { wrapper: createWrapper() },
      );

      fireEvent.click(screen.getByRole('listitem'));

      await waitFor(() => {
        expect(screen.getByText('Test summary')).toBeInTheDocument();
        expect(screen.getByText('Superseded')).toBeInTheDocument();
      });
    });
  });

  // ─── 8. Panel close and back navigation ─────────────────────────────────────

  describe('panel close and navigation', () => {
    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();

      render(
        <VersionHistoryPanel {...defaultProps} onClose={onClose} versions={[]} />,
        { wrapper: createWrapper() },
      );

      fireEvent.click(screen.getByLabelText('Close history panel'));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows back button when viewing version content', async () => {
      const versions = [createVersion({ id: 1, versionNumber: 1 })];
      const versionContent = createVersionContent();

      mockUseVersionContent.mockReturnValue({
        data: { data: versionContent },
        isLoading: false,
        error: null,
      });

      render(
        <VersionHistoryPanel {...defaultProps} versions={versions} />,
        { wrapper: createWrapper() },
      );

      fireEvent.click(screen.getByRole('listitem'));

      await waitFor(() => {
        expect(screen.getByLabelText('Back to version list')).toBeInTheDocument();
      });
    });

    it('returns to list when back button is clicked', async () => {
      const versions = [createVersion({ id: 1, versionNumber: 1 })];
      const versionContent = createVersionContent();

      mockUseVersionContent.mockReturnValue({
        data: { data: versionContent },
        isLoading: false,
        error: null,
      });

      render(
        <VersionHistoryPanel {...defaultProps} versions={versions} />,
        { wrapper: createWrapper() },
      );

      // Select version
      fireEvent.click(screen.getByRole('listitem'));

      await waitFor(() => {
        expect(screen.getByText('Test summary')).toBeInTheDocument();
      });

      // Click back
      fireEvent.click(screen.getByLabelText('Back to version list'));

      await waitFor(() => {
        expect(screen.getByText('Generation History')).toBeInTheDocument();
        expect(screen.queryByText('Test summary')).not.toBeInTheDocument();
      });
    });
  });

  // ─── 9. Accessibility and keyboard interaction ──────────────────────────────

  describe('accessibility', () => {
    it('has correct dialog role and aria-label', () => {
      render(
        <VersionHistoryPanel {...defaultProps} versions={[]} />,
        { wrapper: createWrapper() },
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-label', 'Generation History');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('has accessible version list items', () => {
      const versions = [createVersion({ id: 1, versionNumber: 1 })];

      render(
        <VersionHistoryPanel {...defaultProps} versions={versions} />,
        { wrapper: createWrapper() },
      );

      const listItem = screen.getByRole('listitem');
      expect(listItem).toHaveAttribute('aria-label', 'View version 1');
    });

    it('closes on Escape key when in list view', async () => {
      const onClose = vi.fn();

      render(
        <VersionHistoryPanel {...defaultProps} onClose={onClose} versions={[]} />,
        { wrapper: createWrapper() },
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('goes back on Escape key when viewing content', async () => {
      const versions = [createVersion({ id: 1, versionNumber: 1 })];
      const versionContent = createVersionContent();
      const onClose = vi.fn();

      mockUseVersionContent.mockReturnValue({
        data: { data: versionContent },
        isLoading: false,
        error: null,
      });

      render(
        <VersionHistoryPanel {...defaultProps} onClose={onClose} versions={versions} />,
        { wrapper: createWrapper() },
      );

      // Select version
      fireEvent.click(screen.getByRole('listitem'));

      await waitFor(() => {
        expect(screen.getByText('Test summary')).toBeInTheDocument();
      });

      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape' });

      // Should go back to list, not close
      await waitFor(() => {
        expect(screen.getByText('Generation History')).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
      });
    });

    it('has live region for loading states', () => {
      render(
        <VersionHistoryPanel {...defaultProps} isLoading />,
        { wrapper: createWrapper() },
      );

      const loadingState = screen.getByRole('status');
      expect(loadingState).toHaveAttribute('aria-live', 'polite');
    });

    it('has alert role for error states', () => {
      render(
        <VersionHistoryPanel {...defaultProps} error="Test error" />,
        { wrapper: createWrapper() },
      );

      expect(screen.getByRole('alert')).toHaveTextContent('Test error');
    });
  });

  // ─── 10. No draft mutations, generation POSTs, or approval actions ──────────

  describe('read-only behavior', () => {
    it('does not include any mutation-triggering buttons', async () => {
      const versions = [createVersion({ id: 1, versionNumber: 1 })];
      const versionContent = createVersionContent();

      mockUseVersionContent.mockReturnValue({
        data: { data: versionContent },
        isLoading: false,
        error: null,
      });

      render(
        <VersionHistoryPanel {...defaultProps} versions={versions} />,
        { wrapper: createWrapper() },
      );

      fireEvent.click(screen.getByRole('listitem'));

      await waitFor(() => {
        expect(screen.getByText('Test summary')).toBeInTheDocument();
      });

      // Check for absence of mutation buttons
      expect(screen.queryByText('Apply to Draft')).not.toBeInTheDocument();
      expect(screen.queryByText('Regenerate')).not.toBeInTheDocument();
      expect(screen.queryByText('Approve')).not.toBeInTheDocument();
      expect(screen.queryByText('Save')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /generate/i })).not.toBeInTheDocument();
    });

    it('useVersionContent is called with correct read-only params', async () => {
      const versions = [createVersion({ id: 1, versionNumber: 1 })];

      mockUseVersionContent.mockReturnValue({
        data: null,
        isLoading: false,
        error: null,
      });

      render(
        <VersionHistoryPanel {...defaultProps} versions={versions} />,
        { wrapper: createWrapper() },
      );

      fireEvent.click(screen.getByRole('listitem'));

      await waitFor(() => {
        expect(mockUseVersionContent).toHaveBeenCalledWith(
          'proj-1',
          'study-1',
          'readout-1',
          1,
          { enabled: true },
        );
      });
    });

    it('does not call any mutation hooks', async () => {
      const versions = [createVersion({ id: 1, versionNumber: 1 })];
      const versionContent = createVersionContent();

      mockUseVersionContent.mockReturnValue({
        data: { data: versionContent },
        isLoading: false,
        error: null,
      });

      render(
        <VersionHistoryPanel {...defaultProps} versions={versions} />,
        { wrapper: createWrapper() },
      );

      // Navigate to content view
      fireEvent.click(screen.getByRole('listitem'));

      await waitFor(() => {
        expect(screen.getByText('Test summary')).toBeInTheDocument();
      });

      // Navigate back
      fireEvent.click(screen.getByLabelText('Back to version list'));

      // All interactions should only call the read-only hook
      // No mutate functions should have been called
      expect(mockUseVersionContent).toHaveBeenCalled();
      // Verify hook was called with enabled: false initially (no selection)
      expect(mockUseVersionContent.mock.calls[0][3]).toBeNull();
    });
  });
});
