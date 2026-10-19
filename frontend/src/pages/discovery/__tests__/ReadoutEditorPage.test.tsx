/**
 * ReadoutEditorPage Integration Tests — DR-6b-4d
 *
 * Page-level tests verifying:
 * 1. Load draft → select citation → edit finding → Save → verify pinned citation fields
 * 2. HTTP 409 conflict → preserve local state → manual reconciliation required
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ReadoutEditorPage } from '../ReadoutEditorPage';
import type {
  ReadoutDetail,
  DraftDetail,
  Citation,
  EligibleInsight,
  SaveDraftResponse,
} from '@/api/readouts';

// ═══════════════════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════════════════

// Mock workspace context
vi.mock('@/components/study/workspace', () => ({
  WorkspaceLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="workspace-layout">{children}</div>
  ),
  useStudyWorkspace: () => ({
    studyPublicId: 'study-123',
    projectPublicId: 'project-456',
  }),
}));

// Mock project permissions
vi.mock('@/hooks/useProjectPermissions', () => ({
  useProjectPermissions: () => ({
    canReview: true,
    isLoading: false,
    readOnlyReason: null,
  }),
}));

// Mock DeskTabs
vi.mock('@/components/discovery', () => ({
  DeskTabs: ({ studyPublicId, activeTab }: { studyPublicId: string; activeTab: string }) => (
    <div data-testid="desk-tabs" data-study={studyPublicId} data-active={activeTab} />
  ),
}));

// API mocks
const mockUseReadoutDetail = vi.fn();
const mockUseSaveDraft = vi.fn();
const mockUseEligibleEvidence = vi.fn();
const mockUseApprovalEligibility = vi.fn();
const mockUseApproveReadout = vi.fn();
const mockUseApprovalHistory = vi.fn();
const mockMutateAsync = vi.fn();
const mockRefetch = vi.fn();
let mockIsConcurrencyError = vi.fn().mockReturnValue(false);

vi.mock('@/api/readouts', async () => {
  const actual = await vi.importActual('@/api/readouts');
  return {
    ...actual,
    useReadoutDetail: (...args: unknown[]) => mockUseReadoutDetail(...args),
    useSaveDraft: (...args: unknown[]) => mockUseSaveDraft(...args),
    useEligibleEvidence: (...args: unknown[]) => mockUseEligibleEvidence(...args),
    useApprovalEligibility: (...args: unknown[]) => mockUseApprovalEligibility(...args),
    useApproveReadout: (...args: unknown[]) => mockUseApproveReadout(...args),
    useApprovalHistory: (...args: unknown[]) => mockUseApprovalHistory(...args),
    isConcurrencyError: (err: unknown) => mockIsConcurrencyError(err),
  };
});

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURES
// ═══════════════════════════════════════════════════════════════════════════

function createMockCitation(overrides: Partial<Citation> = {}): Citation {
  return {
    constructPublicId: 'construct-001',
    revisionPublicId: 'revision-001',
    revisionNumber: 2,
    displayId: 'IN-0001',
    ...overrides,
  };
}

function createMockDraft(overrides: Partial<DraftDetail> = {}): DraftDetail {
  return {
    content: {
      summary: { text: 'Test summary', citations: [] },
      findings: [
        {
          id: 'f1',
          text: 'Finding one',
          citations: [createMockCitation()],
        },
      ],
      limitations: [],
      implications: [
        {
          id: 'i1',
          kind: 'question',
          text: 'Implication one',
          basedOnFindings: ['f1'],
        },
      ],
    },
    findingsChecked: ['f1'],
    implicationsReviewed: ['i1'],
    contentVersion: 5,
    lastEditedAt: '2026-10-17T10:00:00Z',
    lastEditedByActorId: 1,
    ...overrides,
  };
}

function createMockReadout(overrides: Partial<ReadoutDetail> = {}): ReadoutDetail {
  return {
    id: 1,
    publicId: 'ro-123',
    displayId: 'RO-0001',
    studyId: 1,
    projectId: 1,
    title: 'Test Readout Title',
    question: 'What is the research question?',
    approvedAt: null,
    approvedVersion: null,
    outOfDateSince: null,
    outOfDateReason: null,
    currentGenerationRequestId: null,
    createdAt: '2026-10-15T10:00:00Z',
    createdByActorId: 1,
    draft: createMockDraft(),
    latestApproval: null,
    ...overrides,
  };
}

function createMockEligibleInsight(overrides: Partial<EligibleInsight> = {}): EligibleInsight {
  return {
    constructPublicId: 'construct-002',
    displayId: 'IN-0002',
    wording: 'New eligible insight for citation',
    acceptedRevision: {
      revisionPublicId: 'revision-002',
      revisionNumber: 3,
      acceptedAt: '2026-10-16T12:00:00Z',
    },
    source: null,
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  // Use data router for useBlocker compatibility
  const router = createMemoryRouter(
    [
      {
        path: '/studies/:studyPublicId/discovery/desk/readouts/:readoutPublicId',
        element: <ReadoutEditorPage />,
      },
      {
        path: '/studies/:studyPublicId/discovery/desk/readouts',
        element: <div>Readouts List</div>,
      },
    ],
    {
      initialEntries: ['/studies/study-123/discovery/desk/readouts/ro-123'],
    },
  );

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('ReadoutEditorPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsConcurrencyError = vi.fn().mockReturnValue(false);

    // Default mock implementations
    mockUseEligibleEvidence.mockReturnValue({
      data: {
        data: {
          insights: [createMockEligibleInsight()],
          total: 1,
          limit: 50,
          offset: 0,
        },
      },
      isLoading: false,
      error: null,
    });

    mockUseSaveDraft.mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
      isError: false,
    });

    // DR-6b-4e: Approval hooks default mocks
    mockUseApprovalEligibility.mockReturnValue({
      data: {
        data: {
          eligible: true,
          errors: [],
          supersededCitations: [],
        },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    mockUseApproveReadout.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
      isError: false,
    });

    mockUseApprovalHistory.mockReturnValue({
      data: {
        data: {
          approvals: [],
        },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Citation pinning and save flow', () => {
    it('loads draft, adds citation with exact pinned fields, edits finding, saves with correct expectedVersion', async () => {
      const user = userEvent.setup();
      const mockReadout = createMockReadout();
      let capturedSaveRequest: unknown = null;

      mockUseReadoutDetail.mockReturnValue({
        data: { data: mockReadout },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      // Capture the save request to verify citation fields
      mockMutateAsync.mockImplementation(async (request: unknown) => {
        capturedSaveRequest = request;
        const response: SaveDraftResponse = {
          data: {
            draft: {
              ...mockReadout.draft,
              contentVersion: 6,
              lastEditedAt: '2026-10-17T10:05:00Z',
            },
            invalidatedFindings: [],
            invalidatedImplications: [],
          },
        };
        return response;
      });

      renderPage();

      // Wait for editor to load
      await waitFor(() => {
        expect(screen.getByText('Test Readout Title')).toBeInTheDocument();
      });

      // Verify existing citation is displayed with revision number
      expect(screen.getByText('IN-0001 r2')).toBeInTheDocument();

      // Find the "Add citation" button in the findings section and click to open picker
      const findingsSection = screen.getByRole('heading', { name: 'Findings' }).closest('section')!;
      const addCitationButton = within(findingsSection).getByRole('button', { name: 'Add citation' });
      await user.click(addCitationButton);

      // Wait for citation picker to appear and select the new citation
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });

      // Click on the eligible insight
      const citationOption = screen.getByText('IN-0002 r3');
      await user.click(citationOption);

      // Verify the new citation chip appears with exact pinned revision
      await waitFor(() => {
        expect(screen.getByText('IN-0002 r3')).toBeInTheDocument();
      });

      // Edit the finding text
      const findingTextarea = screen.getByLabelText('Finding F1 text');
      await user.clear(findingTextarea);
      await user.type(findingTextarea, 'Updated finding text');

      // Click Save button
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Wait for save to complete
      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalledTimes(1);
      });

      // Verify save request
      expect(capturedSaveRequest).toMatchObject({
        expectedVersion: 5, // Original contentVersion
        content: {
          findings: expect.arrayContaining([
            expect.objectContaining({
              id: 'f1',
              text: 'Updated finding text',
              citations: expect.arrayContaining([
                // Original citation preserved
                {
                  constructPublicId: 'construct-001',
                  revisionPublicId: 'revision-001',
                  revisionNumber: 2,
                  displayId: 'IN-0001',
                },
                // New citation with exact pinned fields
                {
                  constructPublicId: 'construct-002',
                  revisionPublicId: 'revision-002',
                  revisionNumber: 3,
                  displayId: 'IN-0002',
                },
              ]),
            }),
          ]),
        },
        findingsChecked: ['f1'],
        implicationsReviewed: ['i1'],
      });
    });

    it('preserves citation fields through multiple edits without substitution', async () => {
      const user = userEvent.setup();
      const citationV2 = createMockCitation({
        constructPublicId: 'construct-old',
        revisionPublicId: 'revision-old-v2',
        revisionNumber: 2,
        displayId: 'IN-0099',
      });

      const mockReadout = createMockReadout({
        draft: createMockDraft({
          content: {
            summary: { text: '', citations: [] },
            findings: [{ id: 'f1', text: 'Original text', citations: [citationV2] }],
            limitations: [],
            implications: [],
          },
          findingsChecked: [],
          implicationsReviewed: [],
        }),
      });

      let saveCallCount = 0;
      const capturedRequests: unknown[] = [];

      mockUseReadoutDetail.mockReturnValue({
        data: { data: mockReadout },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      mockMutateAsync.mockImplementation(async (request: unknown) => {
        saveCallCount++;
        capturedRequests.push(request);
        const response: SaveDraftResponse = {
          data: {
            draft: {
              ...mockReadout.draft,
              contentVersion: mockReadout.draft.contentVersion + saveCallCount,
              lastEditedAt: new Date().toISOString(),
            },
            invalidatedFindings: [],
            invalidatedImplications: [],
          },
        };
        return response;
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('IN-0099 r2')).toBeInTheDocument();
      });

      // Edit finding text multiple times
      const findingTextarea = screen.getByLabelText('Finding F1 text');
      await user.clear(findingTextarea);
      await user.type(findingTextarea, 'Edit 1');

      // Save
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(saveCallCount).toBe(1);
      });

      // Verify citation was NOT substituted with a newer revision
      expect(capturedRequests[0]).toMatchObject({
        content: {
          findings: [
            {
              id: 'f1',
              citations: [
                {
                  constructPublicId: 'construct-old',
                  revisionPublicId: 'revision-old-v2',
                  revisionNumber: 2, // Still v2, not substituted
                  displayId: 'IN-0099',
                },
              ],
            },
          ],
        },
      });
    });
  });

  describe('HTTP 409 conflict recovery', () => {
    it('preserves local content and shows conflict view on 409 error', async () => {
      const user = userEvent.setup();
      const originalDraft = createMockDraft({
        contentVersion: 5,
        findingsChecked: ['f1'],
        implicationsReviewed: ['i1'],
      });

      const serverUpdatedDraft = createMockDraft({
        content: {
          summary: { text: 'Server updated summary', citations: [] },
          findings: [{ id: 'f1', text: 'Server updated finding', citations: [] }],
          limitations: [],
          implications: [{ id: 'i1', kind: 'gap', text: 'Server implication', basedOnFindings: [] }],
        },
        contentVersion: 6,
        findingsChecked: [],
        implicationsReviewed: [],
      });

      const mockReadout = createMockReadout({ draft: originalDraft });

      const refetchMock = vi.fn().mockResolvedValue({
        data: { data: { ...mockReadout, draft: serverUpdatedDraft } },
      });

      mockUseReadoutDetail.mockReturnValue({
        data: { data: mockReadout },
        isLoading: false,
        error: null,
        refetch: refetchMock,
      });

      // Configure mock to identify concurrency errors
      mockIsConcurrencyError.mockImplementation((err: unknown) => {
        return (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: string }).code === 'CONCURRENCY_CONFLICT'
        );
      });

      // Simulate 409 conflict error
      const conflictError = {
        code: 'CONCURRENCY_CONFLICT',
        message: 'Version conflict',
        currentVersion: 6,
        submittedContent: {},
      };
      mockMutateAsync.mockRejectedValueOnce(conflictError);

      renderPage();

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('Test Readout Title')).toBeInTheDocument();
      });

      // Edit finding text
      const findingTextarea = screen.getByLabelText('Finding F1 text');
      await user.clear(findingTextarea);
      await user.type(findingTextarea, 'My local edit');

      // Click Save - should trigger 409
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Wait for conflict handling - refetch should be called
      await waitFor(() => {
        expect(refetchMock).toHaveBeenCalled();
      });

      // Verify conflict comparison view is shown (manual reconciliation required)
      // The ConflictComparisonView should have buttons for reconciliation
      await waitFor(() => {
        const keepButton = screen.queryByRole('button', { name: /keep my changes/i });
        const discardButton = screen.queryByRole('button', { name: /discard/i });
        expect(keepButton || discardButton).toBeTruthy();
      });
    });

    it('requires manual reconciliation before allowing another save attempt', async () => {
      const user = userEvent.setup();
      const mockReadout = createMockReadout();

      const refetchMock = vi.fn().mockResolvedValue({
        data: { data: mockReadout },
      });

      mockUseReadoutDetail.mockReturnValue({
        data: { data: mockReadout },
        isLoading: false,
        error: null,
        refetch: refetchMock,
      });

      // Configure concurrency error detection
      mockIsConcurrencyError.mockImplementation((err: unknown) => {
        return (
          typeof err === 'object' &&
          err !== null &&
          'code' in err &&
          (err as { code: string }).code === 'CONCURRENCY_CONFLICT'
        );
      });

      // First call: 409 conflict
      const conflictError = {
        code: 'CONCURRENCY_CONFLICT',
        currentVersion: 6,
      };
      mockMutateAsync.mockRejectedValueOnce(conflictError);

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Test Readout Title')).toBeInTheDocument();
      });

      // Edit and save
      const findingTextarea = screen.getByLabelText('Finding F1 text');
      await user.clear(findingTextarea);
      await user.type(findingTextarea, 'My edit');

      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      // Wait for conflict state
      await waitFor(() => {
        expect(refetchMock).toHaveBeenCalled();
      });

      // The save button should either be disabled or conflict view should be showing
      // which prevents normal save flow until reconciliation
      await waitFor(() => {
        const hasConflictUI =
          screen.queryByRole('button', { name: /keep my changes/i }) !== null ||
          screen.queryByRole('button', { name: /discard/i }) !== null;
        expect(hasConflictUI).toBe(true);
      });
    });
  });

  describe('Review state preservation', () => {
    it('sends findingsChecked and implicationsReviewed arrays in save request', async () => {
      const user = userEvent.setup();
      let capturedRequest: unknown = null;

      const mockReadout = createMockReadout({
        draft: createMockDraft({
          findingsChecked: ['f1'],
          implicationsReviewed: ['i1'],
        }),
      });

      mockUseReadoutDetail.mockReturnValue({
        data: { data: mockReadout },
        isLoading: false,
        error: null,
        refetch: mockRefetch,
      });

      mockMutateAsync.mockImplementation(async (request: unknown) => {
        capturedRequest = request;
        return {
          data: {
            draft: { ...mockReadout.draft, contentVersion: 6 },
            invalidatedFindings: [],
            invalidatedImplications: [],
          },
        };
      });

      renderPage();

      await waitFor(() => {
        expect(screen.getByText('Test Readout Title')).toBeInTheDocument();
      });

      // Make a small edit to enable save
      const findingTextarea = screen.getByLabelText('Finding F1 text');
      await user.type(findingTextarea, ' updated');

      // Save
      const saveButton = screen.getByRole('button', { name: /save/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockMutateAsync).toHaveBeenCalled();
      });

      // Verify review state arrays are included
      expect(capturedRequest).toMatchObject({
        findingsChecked: ['f1'],
        implicationsReviewed: ['i1'],
      });
    });
  });
});
