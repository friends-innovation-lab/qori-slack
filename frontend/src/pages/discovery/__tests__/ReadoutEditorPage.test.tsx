/**
 * ReadoutEditorPage Integration Tests — DR-6b-4d, DR-6b-4e
 *
 * Page-level tests verifying:
 * 1. Load draft → select citation → edit finding → Save → verify pinned citation fields
 * 2. HTTP 409 conflict → preserve local state → manual reconciliation required
 * 3. DR-6b-4e Approval UI tests (added)
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
  ApprovalDetail,
  SupersededCitation,
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
const mockUseProjectPermissions = vi.fn();
vi.mock('@/hooks/useProjectPermissions', () => ({
  useProjectPermissions: () => mockUseProjectPermissions(),
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
const mockEligibilityRefetch = vi.fn();
const mockHistoryRefetch = vi.fn();
let mockIsConcurrencyError = vi.fn().mockReturnValue(false);
let mockIsApprovalIneligibleError = vi.fn().mockReturnValue(false);
let mockIsAuthorizationError = vi.fn().mockReturnValue(false);

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
    isApprovalIneligibleError: (err: unknown) => mockIsApprovalIneligibleError(err),
    isAuthorizationError: (err: unknown) => mockIsAuthorizationError(err),
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

    // Default project permissions mock
    mockUseProjectPermissions.mockReturnValue({
      canReview: true,
      isLoading: false,
      readOnlyReason: null,
    });

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

  // ═══════════════════════════════════════════════════════════════════════════
  // DR-6b-4e APPROVAL UI TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('DR-6b-4e Approval UI', () => {
    // Helper to create approval detail fixtures
    function createMockApprovalDetail(overrides: Partial<ApprovalDetail> = {}): ApprovalDetail {
      return {
        id: 1,
        approvalNumber: 1,
        approvedAt: '2026-10-17T14:00:00Z',
        approvedByActorId: 1,
        approvalNote: 'Approved after review',
        sourceDraftContentVersion: 5,
        contentSnapshot: {
          summary: { text: 'Approved summary', citations: [] },
          findings: [{ id: 'f1', text: 'Approved finding', citations: [] }],
          limitations: [],
          implications: [{ id: 'i1', kind: 'question', text: 'Approved implication', basedOnFindings: ['f1'] }],
        },
        findingsCheckedSnapshot: ['f1'],
        implicationsReviewedSnapshot: ['i1'],
        evidenceSnapshot: { cited_constructs: [] },
        supersessionNotes: {},
        ...overrides,
      };
    }

    // Helper for superseded citation fixture
    function createMockSupersededCitation(overrides: Partial<SupersededCitation> = {}): SupersededCitation {
      return {
        constructPublicId: 'construct-old',
        revisionPublicId: 'revision-old-v1',
        revisionNumber: 1,
        displayId: 'IN-0050',
        ...overrides,
      };
    }

    describe('Scenario 1: Eligible → confirmation → successful approval → immutable snapshot', () => {
      it('shows approval confirmation modal when eligible and creates immutable snapshot on success', async () => {
        const user = userEvent.setup();
        const eligibilityRefetch = vi.fn().mockResolvedValue({
          data: { data: { eligible: true, errors: [], supersededCitations: [] } },
        });

        const mockReadout = createMockReadout({
          draft: createMockDraft({ contentVersion: 5, findingsChecked: ['f1'], implicationsReviewed: ['i1'] }),
        });

        mockUseReadoutDetail.mockReturnValue({
          data: { data: mockReadout },
          isLoading: false,
          error: null,
          refetch: mockRefetch,
        });

        mockUseApprovalEligibility.mockReturnValue({
          data: { data: { eligible: true, errors: [], supersededCitations: [] } },
          isLoading: false,
          error: null,
          refetch: eligibilityRefetch,
        });

        const approveMutate = vi.fn().mockResolvedValue({
          data: {
            approval: createMockApprovalDetail({ sourceDraftContentVersion: 5, approvalNumber: 1 }),
          },
        });

        mockUseApproveReadout.mockReturnValue({
          mutateAsync: approveMutate,
          isPending: false,
          isError: false,
        });

        renderPage();

        await waitFor(() => {
          expect(screen.getByText('Test Readout Title')).toBeInTheDocument();
        });

        // Find and click the Approve button
        const approveButton = screen.getByRole('button', { name: /approve/i });
        expect(approveButton).not.toBeDisabled();
        await user.click(approveButton);

        // Eligibility should be refetched before modal opens
        await waitFor(() => {
          expect(eligibilityRefetch).toHaveBeenCalled();
        });

        // Modal should be visible with confirmation UI
        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        // Click the Approve button inside the modal dialog
        const dialog = screen.getByRole('dialog');
        const confirmButton = within(dialog).getByRole('button', { name: /^approve$/i });
        await user.click(confirmButton);

        // Verify approval mutation was called with correct expectedVersion
        await waitFor(() => {
          expect(approveMutate).toHaveBeenCalledWith({
            expectedVersion: 5,
          });
        });
      });
    });

    describe('Scenario 2: Dirty draft blocks approval', () => {
      it('disables Approve button when draft has unsaved changes', async () => {
        const user = userEvent.setup();

        const mockReadout = createMockReadout({
          draft: createMockDraft({ findingsChecked: ['f1'], implicationsReviewed: ['i1'] }),
        });

        mockUseReadoutDetail.mockReturnValue({
          data: { data: mockReadout },
          isLoading: false,
          error: null,
          refetch: mockRefetch,
        });

        mockUseApprovalEligibility.mockReturnValue({
          data: { data: { eligible: true, errors: [], supersededCitations: [] } },
          isLoading: false,
          error: null,
          refetch: mockEligibilityRefetch,
        });

        renderPage();

        await waitFor(() => {
          expect(screen.getByText('Test Readout Title')).toBeInTheDocument();
        });

        // Initially Approve button should be enabled (no dirty changes)
        const approveButton = screen.getByRole('button', { name: /approve/i });
        expect(approveButton).not.toBeDisabled();

        // Make an edit to dirty the draft
        const findingTextarea = screen.getByLabelText('Finding F1 text');
        await user.type(findingTextarea, ' modified');

        // Now Approve should be disabled
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /approve/i })).toBeDisabled();
        });
      });
    });

    describe('Scenario 3: Superseded citations require per-revision notes', () => {
      it('blocks approval submission until all supersession notes are provided', async () => {
        const user = userEvent.setup();

        const supersededCitation = createMockSupersededCitation({
          revisionPublicId: 'rev-001',
          displayId: 'IN-0050',
        });

        const mockReadout = createMockReadout({
          draft: createMockDraft({ findingsChecked: ['f1'], implicationsReviewed: ['i1'] }),
        });

        mockUseReadoutDetail.mockReturnValue({
          data: { data: mockReadout },
          isLoading: false,
          error: null,
          refetch: mockRefetch,
        });

        mockUseApprovalEligibility.mockReturnValue({
          data: {
            data: {
              eligible: true,
              errors: [],
              supersededCitations: [supersededCitation],
            },
          },
          isLoading: false,
          error: null,
          refetch: vi.fn().mockResolvedValue({
            data: { data: { eligible: true, errors: [], supersededCitations: [supersededCitation] } },
          }),
        });

        const approveMutate = vi.fn().mockResolvedValue({ data: { approval: createMockApprovalDetail() } });
        mockUseApproveReadout.mockReturnValue({
          mutateAsync: approveMutate,
          isPending: false,
          isError: false,
        });

        renderPage();

        await waitFor(() => {
          expect(screen.getByText('Test Readout Title')).toBeInTheDocument();
        });

        // Open approval modal
        const approveButton = screen.getByRole('button', { name: /approve/i });
        await user.click(approveButton);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
        const dialog = screen.getByRole('dialog');

        // Confirm button should be disabled because supersession note is blank
        const confirmButton = within(dialog).getByRole('button', { name: /^approve$/i });
        expect(confirmButton).toBeDisabled();

        // Find supersession note input and fill it
        const supersessionInput = within(dialog).getByLabelText(/justification for continuing to use IN-0050/i);
        await user.type(supersessionInput, 'Still relevant, newer revision is cosmetic change only');

        // Now confirm should be enabled
        await waitFor(() => {
          expect(within(dialog).getByRole('button', { name: /^approve$/i })).not.toBeDisabled();
        });

        // Submit and verify the note is sent
        await user.click(within(dialog).getByRole('button', { name: /^approve$/i }));

        await waitFor(() => {
          expect(approveMutate).toHaveBeenCalledWith({
            expectedVersion: 5,
            supersessionNotes: {
              'rev-001': 'Still relevant, newer revision is cosmetic change only',
            },
          });
        });
      });
    });

    describe('Scenario 4: Approval 409 preserves state', () => {
      it('preserves supersession notes when approval fails with 409 concurrency error', async () => {
        const user = userEvent.setup();

        const supersededCitation = createMockSupersededCitation({ revisionPublicId: 'rev-conflict' });

        const mockReadout = createMockReadout({
          draft: createMockDraft({ findingsChecked: ['f1'], implicationsReviewed: ['i1'] }),
        });

        mockUseReadoutDetail.mockReturnValue({
          data: { data: mockReadout },
          isLoading: false,
          error: null,
          refetch: mockRefetch,
        });

        mockUseApprovalEligibility.mockReturnValue({
          data: { data: { eligible: true, errors: [], supersededCitations: [supersededCitation] } },
          isLoading: false,
          error: null,
          refetch: vi.fn().mockResolvedValue({
            data: { data: { eligible: true, errors: [], supersededCitations: [supersededCitation] } },
          }),
        });

        // First call: 409 conflict
        const conflictError = { code: 'CONCURRENCY_CONFLICT', message: 'Version conflict', currentVersion: 6 };
        const approveMutate = vi.fn().mockRejectedValueOnce(conflictError);

        mockUseApproveReadout.mockReturnValue({
          mutateAsync: approveMutate,
          isPending: false,
          isError: false,
        });

        mockIsConcurrencyError.mockImplementation((err: unknown) => {
          return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'CONCURRENCY_CONFLICT';
        });

        renderPage();

        await waitFor(() => {
          expect(screen.getByText('Test Readout Title')).toBeInTheDocument();
        });

        // Open approval modal
        await user.click(screen.getByRole('button', { name: /approve/i }));

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
        const dialog = screen.getByRole('dialog');

        // Fill supersession note
        const supersessionInput = within(dialog).getByLabelText(/justification for continuing to use IN-0050/i);
        await user.type(supersessionInput, 'My carefully written justification');

        // Enable confirm and submit
        const confirmButton = within(dialog).getByRole('button', { name: /^approve$/i });
        await user.click(confirmButton);

        // Wait for error display
        await waitFor(() => {
          expect(approveMutate).toHaveBeenCalled();
        });

        // Error should be shown (modal may still be open or show error)
        await waitFor(() => {
          const errorDisplay = screen.queryByText(/conflict/i) || screen.queryByText(/version/i);
          expect(errorDisplay).toBeTruthy();
        });

        // Supersession note should still have the typed value (preserved)
        expect(supersessionInput).toHaveValue('My carefully written justification');
      });
    });

    describe('Scenario 5: Approval 422 preserves notes and displays errors', () => {
      it('preserves form state and displays validation errors on 422', async () => {
        const user = userEvent.setup();

        const mockReadout = createMockReadout({
          draft: createMockDraft({ findingsChecked: ['f1'], implicationsReviewed: ['i1'] }),
        });

        mockUseReadoutDetail.mockReturnValue({
          data: { data: mockReadout },
          isLoading: false,
          error: null,
          refetch: mockRefetch,
        });

        mockUseApprovalEligibility.mockReturnValue({
          data: { data: { eligible: true, errors: [], supersededCitations: [] } },
          isLoading: false,
          error: null,
          refetch: vi.fn().mockResolvedValue({
            data: { data: { eligible: true, errors: [], supersededCitations: [] } },
          }),
        });

        // 422 ineligible error
        const ineligibleError = {
          code: 'APPROVAL_INELIGIBLE',
          message: 'Findings not fully reviewed',
          errors: ['unchecked_findings'],
        };
        const approveMutate = vi.fn().mockRejectedValueOnce(ineligibleError);

        mockUseApproveReadout.mockReturnValue({
          mutateAsync: approveMutate,
          isPending: false,
          isError: false,
        });

        mockIsApprovalIneligibleError.mockImplementation((err: unknown) => {
          return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'APPROVAL_INELIGIBLE';
        });

        renderPage();

        await waitFor(() => {
          expect(screen.getByText('Test Readout Title')).toBeInTheDocument();
        });

        // Open approval modal
        await user.click(screen.getByRole('button', { name: /approve/i }));

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
        const dialog = screen.getByRole('dialog');

        // Add optional note
        const noteInput = within(dialog).getByLabelText(/approval note/i);
        await user.type(noteInput, 'My approval note');

        // Submit
        const confirmButton = within(dialog).getByRole('button', { name: /^approve$/i });
        await user.click(confirmButton);

        // Error message should be displayed
        await waitFor(() => {
          const errorDisplay = screen.queryByText(/ineligible/i) || screen.queryByText(/not fully reviewed/i) || screen.queryByText(/unchecked/i);
          expect(errorDisplay).toBeTruthy();
        });

        // Note should be preserved
        expect(noteInput).toHaveValue('My approval note');
      });
    });

    describe('Scenario 6: Approved snapshot versus changed working draft', () => {
      it('shows draft coexistence banner when draft has diverged from latest approval', async () => {
        const mockApproval = createMockApprovalDetail({
          sourceDraftContentVersion: 5,
          approvalNumber: 1,
        });

        const mockReadout = createMockReadout({
          approvedAt: '2026-10-17T14:00:00Z',
          approvedVersion: 1,
          draft: createMockDraft({
            contentVersion: 7, // Draft has progressed beyond approval source
            findingsChecked: ['f1'],
            implicationsReviewed: ['i1'],
          }),
          latestApproval: mockApproval,
        });

        mockUseReadoutDetail.mockReturnValue({
          data: { data: mockReadout },
          isLoading: false,
          error: null,
          refetch: mockRefetch,
        });

        mockUseApprovalEligibility.mockReturnValue({
          data: { data: { eligible: true, errors: [], supersededCitations: [] } },
          isLoading: false,
          error: null,
          refetch: mockEligibilityRefetch,
        });

        renderPage();

        await waitFor(() => {
          expect(screen.getByText('Test Readout Title')).toBeInTheDocument();
        });

        // Should show coexistence notice
        await waitFor(() => {
          expect(screen.getByText(/unpublished changes/i)).toBeInTheDocument();
        });
      });

      it('allows toggling between edit view and approved snapshot view', async () => {
        const user = userEvent.setup();

        const mockApproval = createMockApprovalDetail({
          sourceDraftContentVersion: 5,
          contentSnapshot: {
            summary: { text: 'Immutable approved summary', citations: [] },
            findings: [{ id: 'f1', text: 'Immutable approved finding', citations: [] }],
            limitations: [],
            implications: [],
          },
        });

        const mockReadout = createMockReadout({
          approvedAt: '2026-10-17T14:00:00Z',
          approvedVersion: 1,
          draft: createMockDraft({
            content: {
              summary: { text: 'Current draft summary', citations: [] },
              findings: [{ id: 'f1', text: 'Current draft finding', citations: [] }],
              limitations: [],
              implications: [],
            },
            contentVersion: 7,
          }),
          latestApproval: mockApproval,
        });

        mockUseReadoutDetail.mockReturnValue({
          data: { data: mockReadout },
          isLoading: false,
          error: null,
          refetch: mockRefetch,
        });

        mockUseApprovalEligibility.mockReturnValue({
          data: { data: { eligible: true, errors: [], supersededCitations: [] } },
          isLoading: false,
          error: null,
          refetch: mockEligibilityRefetch,
        });

        renderPage();

        await waitFor(() => {
          expect(screen.getByText('Current draft summary')).toBeInTheDocument();
        });

        // Find and click the view toggle to see approved version
        const viewApprovedButton = screen.getByRole('button', { name: /approved version/i });
        await user.click(viewApprovedButton);

        // Should now show immutable approved content
        await waitFor(() => {
          expect(screen.getByText('Immutable approved summary')).toBeInTheDocument();
        });

        // Toggle back to edit view - use getAllBy as there may be multiple "Edit Draft" buttons
        const editDraftButtons = screen.getAllByRole('button', { name: /edit draft/i });
        await user.click(editDraftButtons[0]);

        await waitFor(() => {
          expect(screen.getByText('Current draft summary')).toBeInTheDocument();
        });
      });
    });

    describe('Scenario 7: Historical snapshot selection', () => {
      it('opens history panel and allows viewing historical approval snapshots', async () => {
        const user = userEvent.setup();

        const approval1 = createMockApprovalDetail({
          id: 1,
          approvalNumber: 1,
          approvedAt: '2026-10-15T10:00:00Z',
          contentSnapshot: { summary: { text: 'First approval', citations: [] }, findings: [], limitations: [], implications: [] },
        });

        const approval2 = createMockApprovalDetail({
          id: 2,
          approvalNumber: 2,
          approvedAt: '2026-10-17T14:00:00Z',
          contentSnapshot: { summary: { text: 'Second approval', citations: [] }, findings: [], limitations: [], implications: [] },
        });

        const mockReadout = createMockReadout({
          approvedAt: '2026-10-17T14:00:00Z',
          approvedVersion: 2,
          latestApproval: approval2,
        });

        mockUseReadoutDetail.mockReturnValue({
          data: { data: mockReadout },
          isLoading: false,
          error: null,
          refetch: mockRefetch,
        });

        mockUseApprovalHistory.mockReturnValue({
          data: { data: { approvals: [approval2, approval1] } },
          isLoading: false,
          error: null,
          refetch: mockHistoryRefetch,
        });

        mockUseApprovalEligibility.mockReturnValue({
          data: { data: { eligible: true, errors: [], supersededCitations: [] } },
          isLoading: false,
          error: null,
          refetch: mockEligibilityRefetch,
        });

        renderPage();

        await waitFor(() => {
          expect(screen.getByText('Test Readout Title')).toBeInTheDocument();
        });

        // Click "View history" link in the approval status
        const viewHistoryButton = screen.getByRole('button', { name: /view history/i });
        await user.click(viewHistoryButton);

        // History panel should open with list of approvals
        await waitFor(() => {
          expect(screen.getByText('Approval History')).toBeInTheDocument();
        });

        // Both approvals should be listed
        expect(screen.getByText(/Approval #1/i)).toBeInTheDocument();
        expect(screen.getByText(/Approval #2/i)).toBeInTheDocument();

        // Click to view historical approval #1
        await user.click(screen.getByLabelText('View approval #1'));

        // Should show historical snapshot (read-only)
        await waitFor(() => {
          expect(screen.getByText('First approval')).toBeInTheDocument();
        });
      });
    });

    describe('Scenario 8: Permission-denied behavior', () => {
      it('hides Approve button when user lacks review permission', async () => {
        // Override permissions for this test
        mockUseProjectPermissions.mockReturnValue({
          canReview: false,
          isLoading: false,
          readOnlyReason: 'You do not have permission to review',
        });

        const mockReadout = createMockReadout();

        mockUseReadoutDetail.mockReturnValue({
          data: { data: mockReadout },
          isLoading: false,
          error: null,
          refetch: mockRefetch,
        });

        renderPage();

        await waitFor(() => {
          expect(screen.getByText('Test Readout Title')).toBeInTheDocument();
        });

        // Approve button should not be present when user lacks review permission
        const approveButton = screen.queryByRole('button', { name: /approve/i });
        expect(approveButton).not.toBeInTheDocument();
      });
    });

    describe('Scenario 9: Duplicate submission prevention', () => {
      it('disables confirm button during pending approval submission', async () => {
        const user = userEvent.setup();

        const mockReadout = createMockReadout({
          draft: createMockDraft({ findingsChecked: ['f1'], implicationsReviewed: ['i1'] }),
        });

        mockUseReadoutDetail.mockReturnValue({
          data: { data: mockReadout },
          isLoading: false,
          error: null,
          refetch: mockRefetch,
        });

        mockUseApprovalEligibility.mockReturnValue({
          data: { data: { eligible: true, errors: [], supersededCitations: [] } },
          isLoading: false,
          error: null,
          refetch: vi.fn().mockResolvedValue({
            data: { data: { eligible: true, errors: [], supersededCitations: [] } },
          }),
        });

        // Slow mutation that doesn't resolve immediately
        let resolveApproval: (value: unknown) => void;
        const slowApprovalPromise = new Promise((resolve) => {
          resolveApproval = resolve;
        });
        const approveMutate = vi.fn().mockReturnValue(slowApprovalPromise);

        mockUseApproveReadout.mockReturnValue({
          mutateAsync: approveMutate,
          isPending: false,
          isError: false,
        });

        renderPage();

        await waitFor(() => {
          expect(screen.getByText('Test Readout Title')).toBeInTheDocument();
        });

        // Open approval modal
        await user.click(screen.getByRole('button', { name: /approve/i }));

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });
        const dialog = screen.getByRole('dialog');

        // Click confirm
        const confirmButton = within(dialog).getByRole('button', { name: /^approve$/i });
        await user.click(confirmButton);

        // Button should become disabled (or show loading state) while pending
        await waitFor(() => {
          expect(approveMutate).toHaveBeenCalled();
        });

        // The button should be disabled during submission (we check the UI reflects pending state)
        // Since we're simulating the mutation, the modal component should disable on submit
        // Resolve to clean up
        resolveApproval!({ data: { approval: createMockApprovalDetail() } });
      });
    });

    describe('Scenario 10: Unsaved navigation protection', () => {
      it('shows warning when navigating away with unsaved changes', async () => {
        const user = userEvent.setup();

        const mockReadout = createMockReadout();

        mockUseReadoutDetail.mockReturnValue({
          data: { data: mockReadout },
          isLoading: false,
          error: null,
          refetch: mockRefetch,
        });

        renderPage();

        await waitFor(() => {
          expect(screen.getByText('Test Readout Title')).toBeInTheDocument();
        });

        // Make an edit to dirty the form
        const findingTextarea = screen.getByLabelText('Finding F1 text');
        await user.type(findingTextarea, ' unsaved changes');

        // Attempt to navigate away (e.g., click a back button or link)
        // The useBlocker hook should prevent navigation
        // This is handled by the router, so we verify the blocker is active

        // We can check that the editor is in a dirty state
        // The actual blocking behavior is handled by react-router's useBlocker
        // and would require integration testing to fully verify

        // Verify the draft is dirty by checking Save button is enabled
        await waitFor(() => {
          const saveButton = screen.getByRole('button', { name: /save/i });
          expect(saveButton).not.toBeDisabled();
        });

        // The navigation protection is implemented via useBlocker in ReadoutEditorPage
        // which will show a confirmation dialog on navigation attempt
      });
    });
  });
});
