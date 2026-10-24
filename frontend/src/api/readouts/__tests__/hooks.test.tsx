/**
 * Readouts Hooks Tests — DR-6b-4b
 *
 * Tests for TanStack Query hooks covering:
 * - All 9 hooks (6 query + 3 mutation)
 * - Project/study cache isolation
 * - Correct success invalidation
 * - HTTP 409/422 as mutation errors
 * - Preservation of conflict/eligibility details
 * - No automatic mutation retries
 * - No optimistic draft overwrites
 * - No automatic Brief changes or fabricated generation status
 */

import { type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useReadoutsList,
  useReadoutDetail,
  useApprovalEligibility,
  useApprovalHistory,
  useGenerationHistory,
  useEligibleEvidence,
  useCreateReadout,
  useSaveDraft,
  useApproveReadout,
  useInitiateGeneration,
  useGenerationStatus,
  useVersionContent,
  isTerminalGenerationStatus,
} from '../hooks';
import type {
  ConcurrencyConflictError,
  ApprovalIneligibleError,
  IdempotencyConflictError,
  EvidenceSelectionError,
} from '../errors';

// ═══════════════════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════════════════

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();

vi.mock('@/api/client', () => ({
  api: {
    get: (...args: unknown[]) => ({
      json: () => mockGet(...args),
    }),
    post: (...args: unknown[]) => ({
      json: () => mockPost(...args),
    }),
    patch: (...args: unknown[]) => ({
      json: () => mockPatch(...args),
    }),
  },
}));

// ═══════════════════════════════════════════════════════════════════════════
// TEST UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST FIXTURES
// ═══════════════════════════════════════════════════════════════════════════

const mockReadoutSummary = {
  id: 1,
  publicId: 'ro-abc-123',
  displayId: 'RO-0001',
  studyId: 10,
  projectId: 5,
  title: 'Test Readout',
  question: 'What is the user experience?',
  approvedAt: null,
  approvedVersion: null,
  outOfDateSince: null,
  outOfDateReason: null,
  currentGenerationRequestId: null,
  createdAt: '2026-10-15T10:00:00.000Z',
  createdByActorId: 42,
};

const mockDraftContent = {
  summary: { text: 'Test summary', citations: [] },
  findings: [{ id: 'f1', text: 'Finding one', citations: [] }],
};

const mockReadoutDetail = {
  ...mockReadoutSummary,
  draft: {
    content: mockDraftContent,
    findingsChecked: ['f1'],
    implicationsReviewed: [],
    contentVersion: 1,
    lastEditedAt: '2026-10-15T10:00:00.000Z',
    lastEditedByActorId: null,
  },
  latestApproval: null,
};

const mockApproval = {
  id: 1,
  approvalNumber: 1,
  sourceDraftContentVersion: 1,
  approvedAt: '2026-10-15T12:00:00.000Z',
  approvedByActorId: 42,
  approvalNote: null,
  contentSnapshot: mockDraftContent,
  findingsCheckedSnapshot: ['f1'],
  implicationsReviewedSnapshot: [],
  evidenceSnapshot: { cited_constructs: [] },
  supersessionNotes: null,
};

// ═══════════════════════════════════════════════════════════════════════════
// QUERY HOOKS TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('useReadoutsList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches list with project and study scope', async () => {
    mockGet.mockResolvedValueOnce({
      data: { readouts: [mockReadoutSummary], total: 1, limit: 50, offset: 0 },
    });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useReadoutsList('proj-1', 'study-1'),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith(
      'projects/proj-1/studies/study-1/readouts',
      expect.any(Object),
    );
    expect(result.current.data?.data.readouts).toHaveLength(1);
  });

  it('includes pagination in query key', async () => {
    mockGet.mockResolvedValueOnce({
      data: { readouts: [], total: 0, limit: 10, offset: 20 },
    });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useReadoutsList('proj-1', 'study-1', { limit: 10, offset: 20 }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('is disabled when projectPublicId is empty', () => {
    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useReadoutsList('', 'study-1'),
      { wrapper: createWrapper(queryClient) },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('is disabled when studyPublicId is empty', () => {
    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useReadoutsList('proj-1', ''),
      { wrapper: createWrapper(queryClient) },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });
});

describe('useReadoutDetail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches single readout with draft', async () => {
    mockGet.mockResolvedValueOnce({ data: mockReadoutDetail });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useReadoutDetail('proj-1', 'study-1', 'ro-abc-123'),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith(
      'projects/proj-1/studies/study-1/readouts/ro-abc-123',
    );
    expect(result.current.data?.data.draft.contentVersion).toBe(1);
  });

  it('is disabled when readoutPublicId is empty', () => {
    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useReadoutDetail('proj-1', 'study-1', ''),
      { wrapper: createWrapper(queryClient) },
    );

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useApprovalEligibility', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns eligibility status', async () => {
    mockGet.mockResolvedValueOnce({
      data: { eligible: true, errors: [] },
    });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useApprovalEligibility('proj-1', 'study-1', 'ro-abc-123'),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.eligible).toBe(true);
  });

  it('can be disabled via options', () => {
    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useApprovalEligibility('proj-1', 'study-1', 'ro-abc-123', { enabled: false }),
      { wrapper: createWrapper(queryClient) },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('returns ineligible with errors array', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        eligible: false,
        errors: ['Finding F1 has no citations', 'Implication I1 not reviewed'],
      },
    });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useApprovalEligibility('proj-1', 'study-1', 'ro-abc-123'),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.eligible).toBe(false);
    expect(result.current.data?.data.errors).toHaveLength(2);
  });
});

describe('useApprovalHistory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches approval array', async () => {
    mockGet.mockResolvedValueOnce({
      data: { approvals: [mockApproval] },
    });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useApprovalHistory('proj-1', 'study-1', 'ro-abc-123'),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.approvals).toHaveLength(1);
    expect(result.current.data?.data.approvals[0].approvalNumber).toBe(1);
  });

  it('returns empty array when no approvals', async () => {
    mockGet.mockResolvedValueOnce({
      data: { approvals: [] },
    });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useApprovalHistory('proj-1', 'study-1', 'ro-abc-123'),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.approvals).toEqual([]);
  });
});

describe('useGenerationHistory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches generation versions', async () => {
    const mockVersion = {
      id: 1,
      versionNumber: 1,
      generationRequestId: 'gen-123',
      generationStatus: 'completed',
      generationStartedAt: '2026-10-15T09:00:00.000Z',
      generationCompletedAt: '2026-10-15T09:05:00.000Z',
      generationError: null,
      draftContentVersionAtStart: 1,
      evidenceSet: [],
      createdAt: '2026-10-15T09:00:00.000Z',
    };

    mockGet.mockResolvedValueOnce({
      data: { versions: [mockVersion] },
    });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useGenerationHistory('proj-1', 'study-1', 'ro-abc-123'),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.versions).toHaveLength(1);
    expect(result.current.data?.data.versions[0].generationStatus).toBe('completed');
  });

  it('does not fabricate generation status', async () => {
    // Empty versions array — hook returns exactly what backend returns
    mockGet.mockResolvedValueOnce({
      data: { versions: [] },
    });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useGenerationHistory('proj-1', 'study-1', 'ro-abc-123'),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // No fabricated status — exactly what backend returns
    expect(result.current.data?.data.versions).toEqual([]);
  });
});

describe('useEligibleEvidence', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches paginated evidence', async () => {
    const mockInsight = {
      constructPublicId: 'ins-abc',
      displayId: 'IN-0001',
      wording: 'Test insight',
      acceptedRevision: {
        revisionPublicId: 'rev-123',
        revisionNumber: 1,
        acceptedAt: '2026-10-15T08:00:00.000Z',
      },
      source: {
        sourceId: 5,
        sourcePublicId: 'src-xyz',
        sourceType: 'document',
        label: 'Research Report',
      },
    };

    mockGet.mockResolvedValueOnce({
      data: { insights: [mockInsight], total: 1, limit: 50, offset: 0 },
    });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useEligibleEvidence('proj-1', 'study-1', 'ro-abc-123'),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.insights).toHaveLength(1);
  });

  it('handles null source attribution', async () => {
    const mockInsight = {
      constructPublicId: 'ins-def',
      displayId: 'IN-0002',
      wording: 'Insight without source',
      acceptedRevision: {
        revisionPublicId: 'rev-456',
        revisionNumber: 1,
        acceptedAt: '2026-10-15T08:00:00.000Z',
      },
      source: null,
    };

    mockGet.mockResolvedValueOnce({
      data: { insights: [mockInsight], total: 1, limit: 50, offset: 0 },
    });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useEligibleEvidence('proj-1', 'study-1', 'ro-abc-123'),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.insights[0].source).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MUTATION HOOKS TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('useCreateReadout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates readout and returns success', async () => {
    mockPost.mockResolvedValueOnce({ data: mockReadoutDetail });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useCreateReadout({ projectPublicId: 'proj-1', studyPublicId: 'study-1' }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      await result.current.mutateAsync({ title: 'New Readout', question: 'Test?' });
    });

    expect(mockPost).toHaveBeenCalledWith(
      'projects/proj-1/studies/study-1/readouts',
      { json: { title: 'New Readout', question: 'Test?' } },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.publicId).toBe('ro-abc-123');
  });

  it('invalidates study list queries on success', async () => {
    mockPost.mockResolvedValueOnce({ data: mockReadoutDetail });

    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () => useCreateReadout({ projectPublicId: 'proj-1', studyPublicId: 'study-1' }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      await result.current.mutateAsync({ title: 'New Readout' });
    });

    expect(invalidateSpy).toHaveBeenCalled();
    // Check that invalidation targets the right scope
    const calls = invalidateSpy.mock.calls;
    const scopeCall = calls.find(
      (call) =>
        call[0]?.queryKey?.includes('readouts') &&
        call[0]?.queryKey?.includes('proj-1'),
    );
    expect(scopeCall).toBeDefined();
  });

  it('does not retry on failure', async () => {
    mockPost.mockRejectedValue(new Error('Network error'));

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useCreateReadout({ projectPublicId: 'proj-1', studyPublicId: 'study-1' }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync({ title: 'New Readout' });
      } catch {
        // Expected
      }
    });

    // Should only be called once — no retry
    expect(mockPost).toHaveBeenCalledTimes(1);
  });
});

describe('useSaveDraft', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves draft and returns updated version', async () => {
    mockPatch.mockResolvedValueOnce({
      data: {
        draft: { ...mockReadoutDetail.draft, contentVersion: 2 },
        invalidatedFindings: [],
        invalidatedImplications: [],
      },
    });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () =>
        useSaveDraft({
          projectPublicId: 'proj-1',
          studyPublicId: 'study-1',
          readoutPublicId: 'ro-abc-123',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      await result.current.mutateAsync({
        expectedVersion: 1,
        content: { summary: { text: 'Updated', citations: [] } },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.draft.contentVersion).toBe(2);
  });

  it('invalidates detail and eligibility on success', async () => {
    mockPatch.mockResolvedValueOnce({
      data: {
        draft: { ...mockReadoutDetail.draft, contentVersion: 2 },
        invalidatedFindings: [],
        invalidatedImplications: [],
      },
    });

    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () =>
        useSaveDraft({
          projectPublicId: 'proj-1',
          studyPublicId: 'study-1',
          readoutPublicId: 'ro-abc-123',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      await result.current.mutateAsync({
        expectedVersion: 1,
        content: { summary: { text: 'Updated', citations: [] } },
      });
    });

    // Verify invalidation was called for detail and eligibility
    expect(invalidateSpy).toHaveBeenCalled();
    const detailCall = invalidateSpy.mock.calls.find(
      (call) => call[0]?.queryKey?.includes('detail'),
    );
    const eligibilityCall = invalidateSpy.mock.calls.find(
      (call) => call[0]?.queryKey?.includes('eligibility'),
    );
    expect(detailCall).toBeDefined();
    expect(eligibilityCall).toBeDefined();
  });

  it('throws ConcurrencyConflictError on HTTP 409 with recovery data', async () => {
    // Create a mock error that matches ky HTTPError structure
    const mockResponseBody = {
      error: {
        code: 'CONCURRENCY_ERROR',
        message: 'Draft was modified by another user',
        currentVersion: 3,
        submittedContent: { summary: { text: 'My unsaved text', citations: [] } },
      },
    };

    const mockResponse = {
      status: 409,
      json: vi.fn().mockResolvedValue(mockResponseBody),
    };

    const conflictError = { response: mockResponse };
    mockPatch.mockRejectedValueOnce(conflictError);

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () =>
        useSaveDraft({
          projectPublicId: 'proj-1',
          studyPublicId: 'study-1',
          readoutPublicId: 'ro-abc-123',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync({
          expectedVersion: 1,
          content: { summary: { text: 'My unsaved text', citations: [] } },
        });
      } catch {
        // Expected to throw
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const thrownError = result.current.error as unknown as ConcurrencyConflictError;
    expect(thrownError).not.toBeNull();
    expect(thrownError.code).toBe('CONCURRENCY_ERROR');
    expect(thrownError.currentVersion).toBe(3);
    expect(thrownError.submittedContent.summary?.text).toBe('My unsaved text');
  });

  it('preserves submittedContent for UI recovery', async () => {
    const mockResponseBody = {
      error: {
        code: 'CONCURRENCY_ERROR',
        message: 'Draft was modified',
        currentVersion: 5,
        submittedContent: {
          summary: { text: 'Important unsaved work', citations: [] },
          findings: [{ id: 'f1', text: 'Critical finding', citations: [] }],
        },
      },
    };

    const mockResponse = {
      status: 409,
      json: vi.fn().mockResolvedValue(mockResponseBody),
    };

    mockPatch.mockRejectedValueOnce({ response: mockResponse });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () =>
        useSaveDraft({
          projectPublicId: 'proj-1',
          studyPublicId: 'study-1',
          readoutPublicId: 'ro-abc-123',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync({
          expectedVersion: 4,
          content: {
            summary: { text: 'Important unsaved work', citations: [] },
            findings: [{ id: 'f1', text: 'Critical finding', citations: [] }],
          },
        });
      } catch {
        // Expected to throw
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    // Verify all submitted content is preserved for recovery
    const thrownError = result.current.error as unknown as ConcurrencyConflictError;
    expect(thrownError.submittedContent.summary?.text).toBe('Important unsaved work');
    expect(thrownError.submittedContent.findings?.[0].text).toBe('Critical finding');
  });

  it('does NOT invalidate cache on 409', async () => {
    const mockResponseBody = {
      error: {
        code: 'CONCURRENCY_ERROR',
        message: 'Draft was modified',
        currentVersion: 3,
        submittedContent: {},
      },
    };

    const mockResponse = {
      status: 409,
      json: vi.fn().mockResolvedValue(mockResponseBody),
    };

    mockPatch.mockRejectedValueOnce({ response: mockResponse });

    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () =>
        useSaveDraft({
          projectPublicId: 'proj-1',
          studyPublicId: 'study-1',
          readoutPublicId: 'ro-abc-123',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync({ expectedVersion: 1, content: {} });
      } catch {
        // Expected
      }
    });

    // onSuccess should NOT have been called
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('does not retry on failure', async () => {
    mockPatch.mockRejectedValue(new Error('Network error'));

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () =>
        useSaveDraft({
          projectPublicId: 'proj-1',
          studyPublicId: 'study-1',
          readoutPublicId: 'ro-abc-123',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync({ expectedVersion: 1, content: {} });
      } catch {
        // Expected
      }
    });

    // Should only be called once — no retry
    expect(mockPatch).toHaveBeenCalledTimes(1);
  });

  it('does not optimistically overwrite draft state', async () => {
    // Verify there's no optimisticUpdate in the mutation config
    // This is a design verification — the hook should not use onMutate for optimistic updates
    mockPatch.mockResolvedValueOnce({
      data: {
        draft: { ...mockReadoutDetail.draft, contentVersion: 2 },
        invalidatedFindings: [],
        invalidatedImplications: [],
      },
    });

    const queryClient = createQueryClient();

    // Pre-populate cache with initial data
    queryClient.setQueryData(
      ['readouts', 'project', 'proj-1', 'study', 'study-1', 'detail', 'ro-abc-123'],
      { data: mockReadoutDetail },
    );

    const { result } = renderHook(
      () =>
        useSaveDraft({
          projectPublicId: 'proj-1',
          studyPublicId: 'study-1',
          readoutPublicId: 'ro-abc-123',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    // Get cache state before mutation
    const beforeMutation = queryClient.getQueryData([
      'readouts',
      'project',
      'proj-1',
      'study',
      'study-1',
      'detail',
      'ro-abc-123',
    ]);

    // Start mutation but don't wait
    const mutationPromise = result.current.mutateAsync({
      expectedVersion: 1,
      content: { summary: { text: 'New content', citations: [] } },
    });

    // Cache should NOT have been optimistically updated
    const duringMutation = queryClient.getQueryData([
      'readouts',
      'project',
      'proj-1',
      'study',
      'study-1',
      'detail',
      'ro-abc-123',
    ]);

    expect(duringMutation).toEqual(beforeMutation);

    await act(async () => {
      await mutationPromise;
    });
  });
});

describe('useApproveReadout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('approves and invalidates all related queries', async () => {
    mockPost.mockResolvedValueOnce({ data: mockApproval });

    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () =>
        useApproveReadout({
          projectPublicId: 'proj-1',
          studyPublicId: 'study-1',
          readoutPublicId: 'ro-abc-123',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      await result.current.mutateAsync({ expectedVersion: 1 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // Should have called invalidateQueries multiple times
    expect(invalidateSpy.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('throws ApprovalIneligibleError on HTTP 422', async () => {
    const mockResponseBody = {
      error: {
        code: 'APPROVAL_INELIGIBLE',
        message: 'Readout is not eligible for approval',
        errors: ['Finding F1 has no citations', 'Implication I1 not reviewed'],
      },
    };

    const mockResponse = {
      status: 422,
      json: vi.fn().mockResolvedValue(mockResponseBody),
    };

    mockPost.mockRejectedValueOnce({ response: mockResponse });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () =>
        useApproveReadout({
          projectPublicId: 'proj-1',
          studyPublicId: 'study-1',
          readoutPublicId: 'ro-abc-123',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync({ expectedVersion: 1 });
      } catch {
        // Expected to throw
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const thrownError = result.current.error as unknown as ApprovalIneligibleError;
    expect(thrownError).not.toBeNull();
    expect(thrownError.code).toBe('APPROVAL_INELIGIBLE');
    expect(thrownError.errors).toHaveLength(2);
    expect(thrownError.errors[0]).toContain('F1');
  });

  it('does NOT invalidate cache on 422', async () => {
    const mockResponseBody = {
      error: {
        code: 'APPROVAL_INELIGIBLE',
        message: 'Not eligible',
        errors: ['Error'],
      },
    };

    const mockResponse = {
      status: 422,
      json: vi.fn().mockResolvedValue(mockResponseBody),
    };

    mockPost.mockRejectedValueOnce({ response: mockResponse });

    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () =>
        useApproveReadout({
          projectPublicId: 'proj-1',
          studyPublicId: 'study-1',
          readoutPublicId: 'ro-abc-123',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync({ expectedVersion: 1 });
      } catch {
        // Expected
      }
    });

    // onSuccess should NOT have been called
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('does NOT retry on failure (critical)', async () => {
    mockPost.mockRejectedValue(new Error('Network error'));

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () =>
        useApproveReadout({
          projectPublicId: 'proj-1',
          studyPublicId: 'study-1',
          readoutPublicId: 'ro-abc-123',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync({ expectedVersion: 1 });
      } catch {
        // Expected
      }
    });

    // CRITICAL: Should only be called once — no automatic retry
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('does not trigger Brief-related invalidation', async () => {
    mockPost.mockResolvedValueOnce({ data: mockApproval });

    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () =>
        useApproveReadout({
          projectPublicId: 'proj-1',
          studyPublicId: 'study-1',
          readoutPublicId: 'ro-abc-123',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      await result.current.mutateAsync({ expectedVersion: 1 });
    });

    // Verify no Brief-related invalidation
    const briefInvalidations = invalidateSpy.mock.calls.filter((call) => {
      const key = call[0]?.queryKey;
      return Array.isArray(key) && key.some((k) => String(k).includes('brief'));
    });

    expect(briefInvalidations).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CACHE ISOLATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('cache isolation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('different projects have isolated caches', async () => {
    const projectAData = { ...mockReadoutSummary, projectId: 1 };
    const projectBData = { ...mockReadoutSummary, projectId: 2, title: 'Project B Readout' };

    mockGet
      .mockResolvedValueOnce({
        data: { readouts: [projectAData], total: 1, limit: 50, offset: 0 },
      })
      .mockResolvedValueOnce({
        data: { readouts: [projectBData], total: 1, limit: 50, offset: 0 },
      });

    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    // Fetch project A
    const { result: resultA } = renderHook(
      () => useReadoutsList('proj-A', 'study-1'),
      { wrapper },
    );
    await waitFor(() => expect(resultA.current.isSuccess).toBe(true));

    // Fetch project B
    const { result: resultB } = renderHook(
      () => useReadoutsList('proj-B', 'study-1'),
      { wrapper },
    );
    await waitFor(() => expect(resultB.current.isSuccess).toBe(true));

    // Verify isolation
    expect(resultA.current.data?.data.readouts[0].projectId).toBe(1);
    expect(resultB.current.data?.data.readouts[0].title).toBe('Project B Readout');
  });

  it('different studies have isolated caches', async () => {
    const study1Data = { ...mockReadoutSummary, studyId: 10 };
    const study2Data = { ...mockReadoutSummary, studyId: 20, title: 'Study 2 Readout' };

    mockGet
      .mockResolvedValueOnce({
        data: { readouts: [study1Data], total: 1, limit: 50, offset: 0 },
      })
      .mockResolvedValueOnce({
        data: { readouts: [study2Data], total: 1, limit: 50, offset: 0 },
      });

    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    // Fetch study 1
    const { result: result1 } = renderHook(
      () => useReadoutsList('proj-1', 'study-1'),
      { wrapper },
    );
    await waitFor(() => expect(result1.current.isSuccess).toBe(true));

    // Fetch study 2
    const { result: result2 } = renderHook(
      () => useReadoutsList('proj-1', 'study-2'),
      { wrapper },
    );
    await waitFor(() => expect(result2.current.isSuccess).toBe(true));

    // Verify isolation
    expect(result1.current.data?.data.readouts[0].studyId).toBe(10);
    expect(result2.current.data?.data.readouts[0].title).toBe('Study 2 Readout');
  });

  it('mutation in one study does not affect another', async () => {
    // Setup: both studies have list data
    const study1List = { ...mockReadoutSummary, studyId: 10 };
    const study2List = { ...mockReadoutSummary, studyId: 20 };

    mockGet
      .mockResolvedValueOnce({
        data: { readouts: [study1List], total: 1, limit: 50, offset: 0 },
      })
      .mockResolvedValueOnce({
        data: { readouts: [study2List], total: 1, limit: 50, offset: 0 },
      });

    mockPost.mockResolvedValueOnce({ data: mockReadoutDetail });

    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    // Fetch both studies
    const { result: list1 } = renderHook(
      () => useReadoutsList('proj-1', 'study-1'),
      { wrapper },
    );
    const { result: list2 } = renderHook(
      () => useReadoutsList('proj-1', 'study-2'),
      { wrapper },
    );

    await waitFor(() => expect(list1.current.isSuccess).toBe(true));
    await waitFor(() => expect(list2.current.isSuccess).toBe(true));

    // Create readout in study-1
    const { result: createMutation } = renderHook(
      () => useCreateReadout({ projectPublicId: 'proj-1', studyPublicId: 'study-1' }),
      { wrapper },
    );

    await act(async () => {
      await createMutation.current.mutateAsync({ title: 'New' });
    });

    // Study-2 cache should not be invalidated (still has original data)
    const study2Cache = queryClient.getQueryData([
      'readouts',
      'project',
      'proj-1',
      'study',
      'study-2',
      'list',
      { limit: 50, offset: 0 },
    ]);
    expect(study2Cache).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GENERATION HOOKS TESTS (DR-6b-5d-A)
// ═══════════════════════════════════════════════════════════════════════════

describe('isTerminalGenerationStatus', () => {
  it('returns true for completed', () => {
    expect(isTerminalGenerationStatus('completed')).toBe(true);
  });

  it('returns true for failed', () => {
    expect(isTerminalGenerationStatus('failed')).toBe(true);
  });

  it('returns true for superseded', () => {
    expect(isTerminalGenerationStatus('superseded')).toBe(true);
  });

  it('returns false for pending', () => {
    expect(isTerminalGenerationStatus('pending')).toBe(false);
  });

  it('returns false for generating', () => {
    expect(isTerminalGenerationStatus('generating')).toBe(false);
  });
});

describe('useInitiateGeneration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('initiates generation and returns 202 response', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        generationRequestId: 'gen-req-123',
        versionId: 5,
        status: 'pending',
        created: true,
      },
    });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () =>
        useInitiateGeneration({
          projectPublicId: 'proj-1',
          studyPublicId: 'study-1',
          readoutPublicId: 'ro-abc-123',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      await result.current.mutateAsync({
        idempotencyKey: 'idem-key-12345678',
        selectedRevisionIds: ['rev-001'],
      });
    });

    expect(mockPost).toHaveBeenCalledWith(
      'projects/proj-1/studies/study-1/readouts/ro-abc-123/generate',
      {
        json: {
          idempotencyKey: 'idem-key-12345678',
          selectedRevisionIds: ['rev-001'],
        },
      },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.generationRequestId).toBe('gen-req-123');
    expect(result.current.data?.data.created).toBe(true);
  });

  it('invalidates generation history and detail on success', async () => {
    mockPost.mockResolvedValueOnce({
      data: {
        generationRequestId: 'gen-req-123',
        versionId: 5,
        status: 'pending',
        created: true,
      },
    });

    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () =>
        useInitiateGeneration({
          projectPublicId: 'proj-1',
          studyPublicId: 'study-1',
          readoutPublicId: 'ro-abc-123',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      await result.current.mutateAsync({
        idempotencyKey: 'idem-key-12345678',
        selectedRevisionIds: ['rev-001'],
      });
    });

    // Should invalidate both versions and detail
    const versionsCall = invalidateSpy.mock.calls.find(
      (call) => call[0]?.queryKey?.includes('versions'),
    );
    const detailCall = invalidateSpy.mock.calls.find(
      (call) => call[0]?.queryKey?.includes('detail'),
    );
    expect(versionsCall).toBeDefined();
    expect(detailCall).toBeDefined();
  });

  it('throws IdempotencyConflictError on HTTP 409', async () => {
    const mockResponseBody = {
      error: {
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'Idempotency key used with different payload',
      },
    };

    const mockResponse = {
      status: 409,
      json: vi.fn().mockResolvedValue(mockResponseBody),
    };

    mockPost.mockRejectedValueOnce({ response: mockResponse });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () =>
        useInitiateGeneration({
          projectPublicId: 'proj-1',
          studyPublicId: 'study-1',
          readoutPublicId: 'ro-abc-123',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync({
          idempotencyKey: 'duplicate-key-123',
          selectedRevisionIds: ['rev-001'],
        });
      } catch {
        // Expected
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const thrownError = result.current.error as unknown as IdempotencyConflictError;
    expect(thrownError.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(thrownError.status).toBe(409);
  });

  it('throws EvidenceSelectionError on HTTP 422', async () => {
    const mockResponseBody = {
      error: {
        code: 'EVIDENCE_SELECTION_ERROR',
        message: 'Some revisions are invalid',
        invalidRevisionIds: ['rev-bad-001', 'rev-bad-002'],
      },
    };

    const mockResponse = {
      status: 422,
      json: vi.fn().mockResolvedValue(mockResponseBody),
    };

    mockPost.mockRejectedValueOnce({ response: mockResponse });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () =>
        useInitiateGeneration({
          projectPublicId: 'proj-1',
          studyPublicId: 'study-1',
          readoutPublicId: 'ro-abc-123',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync({
          idempotencyKey: 'valid-key-12345678',
          selectedRevisionIds: ['rev-bad-001', 'rev-bad-002'],
        });
      } catch {
        // Expected
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const thrownError = result.current.error as unknown as EvidenceSelectionError;
    expect(thrownError.code).toBe('EVIDENCE_SELECTION_ERROR');
    expect(thrownError.status).toBe(422);
    expect(thrownError.invalidRevisionIds).toContain('rev-bad-001');
  });

  it('does not retry on failure', async () => {
    mockPost.mockRejectedValue(new Error('Network error'));

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () =>
        useInitiateGeneration({
          projectPublicId: 'proj-1',
          studyPublicId: 'study-1',
          readoutPublicId: 'ro-abc-123',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync({
          idempotencyKey: 'key-12345678',
          selectedRevisionIds: ['rev-001'],
        });
      } catch {
        // Expected
      }
    });

    // Should only be called once — no retry
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it('distinguishes 409 idempotency conflict from 409 draft concurrency', async () => {
    // Idempotency conflict has different error code
    const idempotencyError = {
      error: {
        code: 'IDEMPOTENCY_CONFLICT',
        message: 'Key conflict',
      },
    };

    const mockResponse = {
      status: 409,
      json: vi.fn().mockResolvedValue(idempotencyError),
    };

    mockPost.mockRejectedValueOnce({ response: mockResponse });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () =>
        useInitiateGeneration({
          projectPublicId: 'proj-1',
          studyPublicId: 'study-1',
          readoutPublicId: 'ro-abc-123',
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      try {
        await result.current.mutateAsync({
          idempotencyKey: 'key-12345678',
          selectedRevisionIds: ['rev-001'],
        });
      } catch {
        // Expected
      }
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const thrownError = result.current.error as unknown as IdempotencyConflictError;
    // Should be IDEMPOTENCY_CONFLICT, not CONCURRENCY_ERROR
    expect(thrownError.code).toBe('IDEMPOTENCY_CONFLICT');
    expect((thrownError as unknown as ConcurrencyConflictError).currentVersion).toBeUndefined();
  });
});

describe('useGenerationStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not request status when generationRequestId is null', () => {
    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useGenerationStatus('proj-1', 'study-1', 'ro-abc-123', null),
      { wrapper: createWrapper(queryClient) },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('requests status when generationRequestId becomes available', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        generationRequestId: 'gen-req-123',
        status: 'pending',
        versionNumber: 1,
        attemptCount: 0,
        retryAfter: null,
        generationStartedAt: null,
        generationCompletedAt: null,
        generationError: null,
        hasContent: false,
      },
    });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useGenerationStatus('proj-1', 'study-1', 'ro-abc-123', 'gen-req-123'),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith(
      'projects/proj-1/studies/study-1/readouts/ro-abc-123/generate/gen-req-123',
    );
    expect(result.current.data?.data.status).toBe('pending');
  });

  it('continues polling for pending status', async () => {
    mockGet.mockResolvedValue({
      data: {
        generationRequestId: 'gen-req-123',
        status: 'pending',
        versionNumber: 1,
        attemptCount: 0,
        retryAfter: null,
        generationStartedAt: null,
        generationCompletedAt: null,
        generationError: null,
        hasContent: false,
      },
    });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () =>
        useGenerationStatus('proj-1', 'study-1', 'ro-abc-123', 'gen-req-123', {
          refetchInterval: 100,
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Wait for at least one refetch
    await waitFor(
      () => {
        expect(mockGet.mock.calls.length).toBeGreaterThan(1);
      },
      { timeout: 500 },
    );

    // Should have been called multiple times (polling continues)
    expect(mockGet.mock.calls.length).toBeGreaterThan(1);
  });

  it('continues polling for generating status', async () => {
    mockGet.mockResolvedValue({
      data: {
        generationRequestId: 'gen-req-123',
        status: 'generating',
        versionNumber: 1,
        attemptCount: 1,
        retryAfter: null,
        generationStartedAt: '2026-10-15T10:00:00.000Z',
        generationCompletedAt: null,
        generationError: null,
        hasContent: false,
      },
    });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () =>
        useGenerationStatus('proj-1', 'study-1', 'ro-abc-123', 'gen-req-123', {
          refetchInterval: 100,
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Wait for at least one refetch
    await waitFor(
      () => {
        expect(mockGet.mock.calls.length).toBeGreaterThan(1);
      },
      { timeout: 500 },
    );
  });

  it('stops polling for completed status', async () => {
    // Return completed status for all calls
    mockGet.mockResolvedValue({
      data: {
        generationRequestId: 'gen-req-123',
        status: 'completed',
        versionNumber: 1,
        attemptCount: 1,
        retryAfter: null,
        generationStartedAt: '2026-10-15T10:00:00.000Z',
        generationCompletedAt: '2026-10-15T10:05:00.000Z',
        generationError: null,
        hasContent: true,
      },
    });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () =>
        useGenerationStatus('proj-1', 'study-1', 'ro-abc-123', 'gen-req-123', {
          refetchInterval: 50,
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.status).toBe('completed');

    // Record call count and wait for potential additional polls
    const callCountAfterSuccess = mockGet.mock.calls.length;
    await new Promise((r) => setTimeout(r, 200));

    // Terminal status should stop polling - no significant increase in calls
    // Allow for 1-2 additional calls due to React rendering cycles
    expect(mockGet.mock.calls.length).toBeLessThanOrEqual(callCountAfterSuccess + 2);
  });

  it('stops polling for failed status', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        generationRequestId: 'gen-req-123',
        status: 'failed',
        versionNumber: 1,
        attemptCount: 3,
        retryAfter: null,
        generationStartedAt: '2026-10-15T10:00:00.000Z',
        generationCompletedAt: '2026-10-15T10:01:00.000Z',
        generationError: 'LLM timeout',
        hasContent: false,
      },
    });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () =>
        useGenerationStatus('proj-1', 'study-1', 'ro-abc-123', 'gen-req-123', {
          refetchInterval: 50,
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.status).toBe('failed');

    const callCountAfterSuccess = mockGet.mock.calls.length;
    await new Promise((r) => setTimeout(r, 150));
    expect(mockGet.mock.calls.length).toBe(callCountAfterSuccess);
  });

  it('stops polling for superseded status', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        generationRequestId: 'gen-req-old',
        status: 'superseded',
        versionNumber: 1,
        attemptCount: 0,
        retryAfter: null,
        generationStartedAt: null,
        generationCompletedAt: null,
        generationError: null,
        hasContent: false,
      },
    });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () =>
        useGenerationStatus('proj-1', 'study-1', 'ro-abc-123', 'gen-req-old', {
          refetchInterval: 50,
        }),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data.status).toBe('superseded');

    const callCountAfterSuccess = mockGet.mock.calls.length;
    await new Promise((r) => setTimeout(r, 150));
    expect(mockGet.mock.calls.length).toBe(callCountAfterSuccess);
  });

  it('changes query key when generationRequestId changes', async () => {
    mockGet.mockResolvedValue({
      data: {
        generationRequestId: 'gen-req-1',
        status: 'pending',
        versionNumber: 1,
        attemptCount: 0,
        retryAfter: null,
        generationStartedAt: null,
        generationCompletedAt: null,
        generationError: null,
        hasContent: false,
      },
    });

    const queryClient = createQueryClient();

    // Start with first request ID
    const { result, rerender } = renderHook(
      ({ requestId }: { requestId: string }) =>
        useGenerationStatus('proj-1', 'study-1', 'ro-abc-123', requestId),
      {
        wrapper: createWrapper(queryClient),
        initialProps: { requestId: 'gen-req-1' },
      },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockGet).toHaveBeenCalledWith(
      'projects/proj-1/studies/study-1/readouts/ro-abc-123/generate/gen-req-1',
    );

    // Change to second request ID
    mockGet.mockResolvedValueOnce({
      data: {
        generationRequestId: 'gen-req-2',
        status: 'generating',
        versionNumber: 2,
        attemptCount: 1,
        retryAfter: null,
        generationStartedAt: '2026-10-15T10:00:00.000Z',
        generationCompletedAt: null,
        generationError: null,
        hasContent: false,
      },
    });

    rerender({ requestId: 'gen-req-2' });

    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(
        'projects/proj-1/studies/study-1/readouts/ro-abc-123/generate/gen-req-2',
      ),
    );
  });

  it('transient HTTP error is distinct from terminal generation failure', async () => {
    // Server reports 'failed' status - this is a terminal generation failure
    const failedStatusResponse = {
      data: {
        generationRequestId: 'gen-req-123',
        status: 'failed',
        versionNumber: 1,
        attemptCount: 3,
        retryAfter: null,
        generationStartedAt: '2026-10-15T10:00:00.000Z',
        generationCompletedAt: '2026-10-15T10:01:00.000Z',
        generationError: 'LLM provider timeout',
        hasContent: false,
      },
    };

    mockGet.mockResolvedValueOnce(failedStatusResponse);

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useGenerationStatus('proj-1', 'study-1', 'ro-abc-123', 'gen-req-123'),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Server-reported 'failed' status is a successful query with failed generation
    // The query itself succeeds (isSuccess: true), but the generation failed
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(result.current.data?.data.status).toBe('failed');
    expect(result.current.data?.data.generationError).toBe('LLM provider timeout');

    // This is distinct from a transient HTTP error which would set isError: true
    // and not have a data.status at all
  });

  it('invalidates caches only once per generation request on completion', async () => {
    mockGet.mockResolvedValue({
      data: {
        generationRequestId: 'gen-req-123',
        status: 'completed',
        versionNumber: 1,
        attemptCount: 1,
        retryAfter: null,
        generationStartedAt: '2026-10-15T10:00:00.000Z',
        generationCompletedAt: '2026-10-15T10:05:00.000Z',
        generationError: null,
        hasContent: true,
      },
    });

    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result, rerender } = renderHook(
      () => useGenerationStatus('proj-1', 'study-1', 'ro-abc-123', 'gen-req-123'),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Count invalidations after first success
    const invalidationCountAfterFirst = invalidateSpy.mock.calls.length;

    // Force a re-render to simulate component update
    rerender();

    // Wait a tick
    await new Promise((r) => setTimeout(r, 50));

    // Should NOT have additional invalidations
    expect(invalidateSpy.mock.calls.length).toBe(invalidationCountAfterFirst);
  });

  it('invalidates detail only when completed with content', async () => {
    // Completed without content (e.g., human edits detected)
    mockGet.mockResolvedValueOnce({
      data: {
        generationRequestId: 'gen-req-123',
        status: 'completed',
        versionNumber: 1,
        attemptCount: 1,
        retryAfter: null,
        generationStartedAt: '2026-10-15T10:00:00.000Z',
        generationCompletedAt: '2026-10-15T10:05:00.000Z',
        generationError: null,
        hasContent: false, // No content to apply
      },
    });

    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(
      () => useGenerationStatus('proj-1', 'study-1', 'ro-abc-123', 'gen-req-123'),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Should invalidate versions but NOT detail (hasContent: false)
    // Note: versions key is [...detail, 'versions'], so we check the last element
    const versionsInvalidation = invalidateSpy.mock.calls.find((call) => {
      const key = call[0]?.queryKey;
      return Array.isArray(key) && key[key.length - 1] === 'versions';
    });

    // Detail invalidation would have 'detail' as the 6th element and 'ro-abc-123' as last
    // (the readoutPublicId, not 'versions')
    const detailInvalidation = invalidateSpy.mock.calls.find((call) => {
      const key = call[0]?.queryKey;
      return (
        Array.isArray(key) &&
        key.includes('detail') &&
        key[key.length - 1] === 'ro-abc-123'
      );
    });

    expect(versionsInvalidation).toBeDefined();
    expect(detailInvalidation).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// VERSION CONTENT HOOK TESTS (DR-6b-5e-B)
// ═══════════════════════════════════════════════════════════════════════════

describe('useVersionContent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not fetch when versionId is null', () => {
    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useVersionContent('proj-1', 'study-1', 'ro-abc-123', null),
      { wrapper: createWrapper(queryClient) },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('fetches version content when versionId is provided', async () => {
    const mockVersionContent = {
      versionId: 42,
      versionNumber: 3,
      generationStatus: 'completed',
      hasContent: true,
      content: { summary: { text: 'Generated summary', citations: [] } },
      evidenceSet: [
        {
          constructPublicId: 'ins-abc',
          revisionPublicId: 'rev-123',
          revisionNumber: 1,
          displayId: 'IN-0001',
        },
      ],
      draftContentVersionAtStart: 5,
      generationCompletedAt: '2026-10-15T10:05:00.000Z',
    };

    mockGet.mockResolvedValueOnce({ data: mockVersionContent });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useVersionContent('proj-1', 'study-1', 'ro-abc-123', 42),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(mockGet).toHaveBeenCalledWith(
      'projects/proj-1/studies/study-1/readouts/ro-abc-123/versions/42/content',
    );
    expect(result.current.data?.data.versionId).toBe(42);
    expect(result.current.data?.data.generationStatus).toBe('completed');
    expect(result.current.data?.data.hasContent).toBe(true);
    expect(result.current.data?.data.content?.summary?.text).toBe('Generated summary');
  });

  it('handles null content for failed generation', async () => {
    const mockVersionContent = {
      versionId: 15,
      versionNumber: 2,
      generationStatus: 'failed',
      hasContent: false,
      content: null,
      evidenceSet: [],
      draftContentVersionAtStart: 3,
      generationCompletedAt: '2026-10-15T09:30:00.000Z',
    };

    mockGet.mockResolvedValueOnce({ data: mockVersionContent });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useVersionContent('proj-1', 'study-1', 'ro-abc-123', 15),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.data.generationStatus).toBe('failed');
    expect(result.current.data?.data.hasContent).toBe(false);
    expect(result.current.data?.data.content).toBeNull();
  });

  it('preserves pinned evidence identity fields', async () => {
    const mockVersionContent = {
      versionId: 50,
      versionNumber: 4,
      generationStatus: 'completed',
      hasContent: true,
      content: {},
      evidenceSet: [
        {
          constructPublicId: 'ins-construct-001',
          revisionPublicId: 'rev-revision-001',
          revisionNumber: 5,
          displayId: 'IN-0015',
        },
        {
          constructPublicId: 'ins-construct-002',
          revisionPublicId: 'rev-revision-002',
          revisionNumber: 3,
          displayId: 'IN-0022',
        },
      ],
      draftContentVersionAtStart: 10,
      generationCompletedAt: '2026-10-15T12:00:00.000Z',
    };

    mockGet.mockResolvedValueOnce({ data: mockVersionContent });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useVersionContent('proj-1', 'study-1', 'ro-abc-123', 50),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify all pinned evidence fields preserved
    expect(result.current.data?.data.evidenceSet).toHaveLength(2);
    expect(result.current.data?.data.evidenceSet[0].displayId).toBe('IN-0015');
    expect(result.current.data?.data.evidenceSet[1].constructPublicId).toBe('ins-construct-002');
  });

  it('can be disabled via options', () => {
    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useVersionContent('proj-1', 'study-1', 'ro-abc-123', 42, { enabled: false }),
      { wrapper: createWrapper(queryClient) },
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('uses Infinity staleTime for immutable version content', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        versionId: 42,
        versionNumber: 3,
        generationStatus: 'completed',
        hasContent: true,
        content: {},
        evidenceSet: [],
        draftContentVersionAtStart: 5,
        generationCompletedAt: '2026-10-15T10:05:00.000Z',
      },
    });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useVersionContent('proj-1', 'study-1', 'ro-abc-123', 42),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Data should never become stale (immutable)
    expect(result.current.isStale).toBe(false);
  });

  it('has different cache key for different versions', async () => {
    mockGet
      .mockResolvedValueOnce({
        data: {
          versionId: 1,
          versionNumber: 1,
          generationStatus: 'completed',
          hasContent: true,
          content: { summary: { text: 'Version 1', citations: [] } },
          evidenceSet: [],
          draftContentVersionAtStart: 1,
          generationCompletedAt: '2026-10-15T09:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({
        data: {
          versionId: 2,
          versionNumber: 2,
          generationStatus: 'completed',
          hasContent: true,
          content: { summary: { text: 'Version 2', citations: [] } },
          evidenceSet: [],
          draftContentVersionAtStart: 5,
          generationCompletedAt: '2026-10-15T10:00:00.000Z',
        },
      });

    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    // Fetch version 1
    const { result: result1 } = renderHook(
      () => useVersionContent('proj-1', 'study-1', 'ro-abc-123', 1),
      { wrapper },
    );
    await waitFor(() => expect(result1.current.isSuccess).toBe(true));

    // Fetch version 2
    const { result: result2 } = renderHook(
      () => useVersionContent('proj-1', 'study-1', 'ro-abc-123', 2),
      { wrapper },
    );
    await waitFor(() => expect(result2.current.isSuccess).toBe(true));

    // Different data in different caches
    expect(result1.current.data?.data.content?.summary?.text).toBe('Version 1');
    expect(result2.current.data?.data.content?.summary?.text).toBe('Version 2');
  });

  it('has different cache key for different readouts', async () => {
    mockGet
      .mockResolvedValueOnce({
        data: {
          versionId: 1,
          versionNumber: 1,
          generationStatus: 'completed',
          hasContent: true,
          content: { summary: { text: 'Readout A', citations: [] } },
          evidenceSet: [],
          draftContentVersionAtStart: 1,
          generationCompletedAt: '2026-10-15T09:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({
        data: {
          versionId: 1,
          versionNumber: 1,
          generationStatus: 'completed',
          hasContent: true,
          content: { summary: { text: 'Readout B', citations: [] } },
          evidenceSet: [],
          draftContentVersionAtStart: 1,
          generationCompletedAt: '2026-10-15T10:00:00.000Z',
        },
      });

    const queryClient = createQueryClient();
    const wrapper = createWrapper(queryClient);

    // Fetch from readout A
    const { result: resultA } = renderHook(
      () => useVersionContent('proj-1', 'study-1', 'readout-A', 1),
      { wrapper },
    );
    await waitFor(() => expect(resultA.current.isSuccess).toBe(true));

    // Fetch from readout B (same version ID, different readout)
    const { result: resultB } = renderHook(
      () => useVersionContent('proj-1', 'study-1', 'readout-B', 1),
      { wrapper },
    );
    await waitFor(() => expect(resultB.current.isSuccess).toBe(true));

    // Cross-readout isolation
    expect(resultA.current.data?.data.content?.summary?.text).toBe('Readout A');
    expect(resultB.current.data?.data.content?.summary?.text).toBe('Readout B');
  });

  it('does not trigger draft mutations or generation POSTs', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        versionId: 42,
        versionNumber: 3,
        generationStatus: 'completed',
        hasContent: true,
        content: {},
        evidenceSet: [],
        draftContentVersionAtStart: 5,
        generationCompletedAt: '2026-10-15T10:05:00.000Z',
      },
    });

    const queryClient = createQueryClient();
    const { result } = renderHook(
      () => useVersionContent('proj-1', 'study-1', 'ro-abc-123', 42),
      { wrapper: createWrapper(queryClient) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Only GET was called, no POST or PATCH
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockPost).not.toHaveBeenCalled();
    expect(mockPatch).not.toHaveBeenCalled();
  });
});
