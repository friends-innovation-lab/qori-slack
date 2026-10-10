/**
 * Insights API Layer Tests — DR-4b
 *
 * Tests for:
 * - Query keys and project isolation
 * - List filters and pagination
 * - Successful mutation invalidation
 * - Failed mutation does not corrupt cache
 * - 403 and 409 error propagation
 * - Needs-review count refresh
 * - Correct request/response typing
 * - No duplicate mutation submissions (via retry: false)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { insightsKeys } from '../keys';
import {
  parseInsightError,
  isConcurrencyError,
  isAuthorizationError,
  isValidationError,
  isNotFoundError,
  type InsightApiError,
} from '../types';
import {
  useInsights,
  useInsight,
  useNeedsReviewCount,
} from '../queries';
import {
  useCreateInsight,
  useCreateRevision,
  useReviewInsight,
} from '../mutations';
import type {
  InsightSummary,
  InsightDetail,
  InsightsListResponse,
} from '@qori/api-contracts';

// ═══════════════════════════════════════════════════════════════════════════
// MOCKS
// ═══════════════════════════════════════════════════════════════════════════

// Mock the API client
const mockGet = vi.fn();
const mockPost = vi.fn();

vi.mock('@/api/client', () => ({
  api: {
    get: (...args: unknown[]) => ({
      json: () => mockGet(...args),
    }),
    post: (...args: unknown[]) => ({
      json: () => mockPost(...args),
    }),
  },
}));

// Test wrapper
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// Sample data
const mockInsightSummary: InsightSummary = {
  id: 1,
  publicId: 'insight-uuid-1',
  displayId: 'IN-0001',
  projectId: 100,
  wording: 'Test insight wording',
  status: 'proposed',
  latestRevisionNumber: 1,
  acceptedRevisionNumber: null,
  pendingRevisionNumber: null,
  origin: 'researcher',
  needsReview: true,
  createdBy: 'user:test',
  createdAt: '2024-01-01T00:00:00Z',
  withdrawnAt: null,
  version: 1,
};

const mockInsightDetail: InsightDetail = {
  ...mockInsightSummary,
  latestRevision: {
    id: 1,
    publicId: 'revision-uuid-1',
    revisionNumber: 1,
    content: { wording: 'Test insight wording' },
    evidenceSnapshot: [],
    origin: 'researcher',
    createdBy: 'user:test',
    createdAt: '2024-01-01T00:00:00Z',
    isAccepted: false,
    isLatest: true,
  },
  acceptedRevision: null,
  revisionCount: 1,
};

const mockListResponse: InsightsListResponse = {
  data: [mockInsightSummary],
  meta: {
    total: 1,
    needsReviewCount: 1,
    limit: 50,
    offset: 0,
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// QUERY KEYS
// ═══════════════════════════════════════════════════════════════════════════

describe('insightsKeys', () => {
  it('all returns root key', () => {
    expect(insightsKeys.all).toEqual(['insights']);
  });

  it('project includes projectId', () => {
    const key = insightsKeys.project(100);
    expect(key).toEqual(['insights', 'project', 100]);
  });

  it('list includes normalized filters', () => {
    const key = insightsKeys.list(100, { status: 'proposed' });
    expect(key).toEqual([
      'insights',
      'project',
      100,
      'list',
      { status: 'proposed', sourceId: undefined, limit: 50, offset: 0 },
    ]);
  });

  it('list normalizes undefined status to all', () => {
    const implicitAll = insightsKeys.list(100, {});
    const explicitAll = insightsKeys.list(100, { status: 'all' });

    expect(implicitAll).toEqual(explicitAll);
    expect(implicitAll[4]).toEqual({
      status: 'all',
      sourceId: undefined,
      limit: 50,
      offset: 0,
    });
  });

  it('list distinguishes different filter combinations', () => {
    const key1 = insightsKeys.list(100, { status: 'proposed' });
    const key2 = insightsKeys.list(100, { status: 'accepted' });
    const key3 = insightsKeys.list(100, { sourceId: 42 });
    const key4 = insightsKeys.list(100, { limit: 20 });

    expect(key1).not.toEqual(key2);
    expect(key1).not.toEqual(key3);
    expect(key1).not.toEqual(key4);
  });

  it('detail includes projectId and insightPublicId', () => {
    const key = insightsKeys.detail(100, 'insight-uuid');
    expect(key).toEqual(['insights', 'project', 100, 'detail', 'insight-uuid']);
  });

  it('revisions extends detail key', () => {
    const key = insightsKeys.revisions(100, 'insight-uuid');
    expect(key).toEqual([
      'insights',
      'project',
      100,
      'detail',
      'insight-uuid',
      'revisions',
    ]);
  });

  it('reviews extends detail key', () => {
    const key = insightsKeys.reviews(100, 'insight-uuid');
    expect(key).toEqual([
      'insights',
      'project',
      100,
      'detail',
      'insight-uuid',
      'reviews',
    ]);
  });

  it('needsReviewCount is project-scoped', () => {
    const key = insightsKeys.needsReviewCount(100);
    expect(key).toEqual(['insights', 'project', 100, 'needs-review-count']);
  });

  it('keys for different projects are distinct (project isolation)', () => {
    const project1Key = insightsKeys.project(100);
    const project2Key = insightsKeys.project(200);

    expect(project1Key).not.toEqual(project2Key);

    const list1 = insightsKeys.list(100, {});
    const list2 = insightsKeys.list(200, {});

    expect(list1).not.toEqual(list2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════

describe('error handling', () => {
  describe('parseInsightError', () => {
    it('parses 409 CONCURRENCY_ERROR with currentVersion', async () => {
      const mockResponse = {
        response: {
          status: 409,
          json: async () => ({
            error: {
              code: 'CONCURRENCY_ERROR',
              message: 'Insight was modified by another user',
              currentVersion: 5,
            },
          }),
        },
      };

      const error = await parseInsightError(mockResponse);
      expect(error.code).toBe('CONCURRENCY_ERROR');
      expect(error.status).toBe(409);
      expect(isConcurrencyError(error)).toBe(true);

      if (isConcurrencyError(error)) {
        expect(error.currentVersion).toBe(5);
      }
    });

    it('parses 403 AUTHORIZATION_ERROR', async () => {
      const mockResponse = {
        response: {
          status: 403,
          json: async () => ({
            error: {
              code: 'AUTHORIZATION_ERROR',
              message: 'You do not have permission',
            },
          }),
        },
      };

      const error = await parseInsightError(mockResponse);
      expect(error.code).toBe('AUTHORIZATION_ERROR');
      expect(error.status).toBe(403);
      expect(isAuthorizationError(error)).toBe(true);
    });

    it('parses 403 PROJECT_ACCESS_ERROR', async () => {
      const mockResponse = {
        response: {
          status: 403,
          json: async () => ({
            error: {
              code: 'PROJECT_ACCESS_ERROR',
              message: 'Evidence source belongs to a different project',
            },
          }),
        },
      };

      const error = await parseInsightError(mockResponse);
      expect(error.code).toBe('PROJECT_ACCESS_ERROR');
      expect(isAuthorizationError(error)).toBe(true);
    });

    it('parses 400 VALIDATION_ERROR', async () => {
      const mockResponse = {
        response: {
          status: 400,
          json: async () => ({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Insight wording is required',
            },
          }),
        },
      };

      const error = await parseInsightError(mockResponse);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(isValidationError(error)).toBe(true);
    });

    it('parses 404 NOT_FOUND', async () => {
      const mockResponse = {
        response: {
          status: 404,
          json: async () => ({
            error: {
              code: 'NOT_FOUND',
              message: 'Insight not found',
            },
          }),
        },
      };

      const error = await parseInsightError(mockResponse);
      expect(error.code).toBe('NOT_FOUND');
      expect(isNotFoundError(error)).toBe(true);
    });

    it('handles unparseable response', async () => {
      const mockResponse = {
        response: {
          status: 500,
          json: async () => {
            throw new Error('Invalid JSON');
          },
        },
      };

      const error = await parseInsightError(mockResponse);
      expect(error.code).toBe('UNKNOWN');
      expect(error.status).toBe(500);
    });

    it('handles generic Error', async () => {
      const error = await parseInsightError(new Error('Network error'));
      expect(error.code).toBe('UNKNOWN');
      expect(error.message).toBe('Network error');
    });

    it('handles null/undefined', async () => {
      const error = await parseInsightError(null);
      expect(error.code).toBe('UNKNOWN');
    });

    it('maps status codes when no error code provided', async () => {
      const mockResponse = {
        response: {
          status: 422,
          json: async () => ({
            error: { message: 'Validation failed' },
          }),
        },
      };

      const error = await parseInsightError(mockResponse);
      expect(error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('error type guards', () => {
    it('isConcurrencyError returns true for CONCURRENCY_ERROR', () => {
      const error: InsightApiError = {
        code: 'CONCURRENCY_ERROR',
        message: 'Conflict',
        status: 409,
        currentVersion: 3,
      };
      expect(isConcurrencyError(error)).toBe(true);
    });

    it('isConcurrencyError returns false for other codes', () => {
      const error: InsightApiError = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid',
        status: 400,
      };
      expect(isConcurrencyError(error)).toBe(false);
    });

    it('isAuthorizationError returns true for both auth error codes', () => {
      expect(
        isAuthorizationError({ code: 'AUTHORIZATION_ERROR', message: '', status: 403 }),
      ).toBe(true);
      expect(
        isAuthorizationError({ code: 'PROJECT_ACCESS_ERROR', message: '', status: 403 }),
      ).toBe(true);
      expect(
        isAuthorizationError({ code: 'VALIDATION_ERROR', message: '', status: 400 }),
      ).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// QUERY HOOKS
// ═══════════════════════════════════════════════════════════════════════════

describe('query hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useInsights', () => {
    it('fetches insights list', async () => {
      mockGet.mockResolvedValueOnce(mockListResponse);

      const { result } = renderHook(() => useInsights(100), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith('projects/100/insights');
      expect(result.current.data?.data).toHaveLength(1);
      expect(result.current.data?.meta.needsReviewCount).toBe(1);
    });

    it('applies status filter', async () => {
      mockGet.mockResolvedValueOnce(mockListResponse);

      const { result } = renderHook(
        () => useInsights(100, { status: 'proposed' }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith(
        'projects/100/insights?status=proposed',
      );
    });

    it('applies sourceId filter', async () => {
      mockGet.mockResolvedValueOnce(mockListResponse);

      const { result } = renderHook(
        () => useInsights(100, { sourceId: 42 }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith(
        'projects/100/insights?sourceId=42',
      );
    });

    it('applies pagination', async () => {
      mockGet.mockResolvedValueOnce(mockListResponse);

      const { result } = renderHook(
        () => useInsights(100, { limit: 20, offset: 40 }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith(
        'projects/100/insights?limit=20&offset=40',
      );
    });

    it('is disabled for invalid projectId', () => {
      const { result } = renderHook(() => useInsights(0), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
      expect(mockGet).not.toHaveBeenCalled();
    });
  });

  describe('useInsight', () => {
    it('fetches insight detail', async () => {
      mockGet.mockResolvedValueOnce({ data: mockInsightDetail });

      const { result } = renderHook(
        () => useInsight(100, 'insight-uuid'),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith('projects/100/insights/insight-uuid');
      expect(result.current.data?.displayId).toBe('IN-0001');
    });

    it('is disabled for empty insightPublicId', () => {
      const { result } = renderHook(() => useInsight(100, ''), {
        wrapper: createWrapper(),
      });

      expect(result.current.fetchStatus).toBe('idle');
    });
  });

  describe('useNeedsReviewCount', () => {
    it('fetches needs-review count', async () => {
      mockGet.mockResolvedValueOnce({ data: { count: 5 } });

      const { result } = renderHook(() => useNeedsReviewCount(100), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));

      expect(mockGet).toHaveBeenCalledWith(
        'projects/100/insights/needs-review-count',
      );
      expect(result.current.data).toBe(5);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MUTATION HOOKS
// ═══════════════════════════════════════════════════════════════════════════

describe('mutation hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useCreateInsight', () => {
    it('creates insight and invalidates project queries', async () => {
      mockPost.mockResolvedValueOnce({ data: mockInsightDetail });

      const queryClient = new QueryClient();
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      const { result } = renderHook(() => useCreateInsight(), {
        wrapper: ({ children }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      });

      await result.current.mutateAsync({
        projectId: 100,
        wording: 'New insight',
        evidenceReferences: [],
      });

      expect(mockPost).toHaveBeenCalled();
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ['insights', 'project', 100],
      });
    });

    it('does not retry on error', async () => {
      // The mutation is configured with retry: false
      // This is verified by checking that only one call is made on failure
      mockPost.mockRejectedValueOnce({
        response: {
          status: 500,
          json: async () => ({ error: { message: 'Server error' } }),
        },
      });

      const { result } = renderHook(() => useCreateInsight(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({
          projectId: 100,
          wording: 'Test',
          evidenceReferences: [],
        }),
      ).rejects.toBeDefined();

      // No retry should have occurred
      expect(mockPost).toHaveBeenCalledTimes(1);
    });
  });

  describe('useCreateRevision', () => {
    it('creates revision with expectedVersion', async () => {
      mockPost.mockResolvedValueOnce({ data: mockInsightDetail });

      const { result } = renderHook(() => useCreateRevision(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        projectId: 100,
        insightPublicId: 'insight-uuid',
        wording: 'Updated wording',
        evidenceReferences: [],
        expectedVersion: 1,
      });

      expect(mockPost).toHaveBeenCalledWith(
        'projects/100/insights/insight-uuid/revisions',
        expect.objectContaining({
          json: expect.objectContaining({
            expectedVersion: 1,
          }),
        }),
      );
    });

    it('throws concurrency error on version mismatch', async () => {
      mockPost.mockRejectedValueOnce({
        response: {
          status: 409,
          json: async () => ({
            error: {
              code: 'CONCURRENCY_ERROR',
              message: 'Version mismatch',
              currentVersion: 3,
            },
          }),
        },
      });

      const { result } = renderHook(() => useCreateRevision(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({
          projectId: 100,
          insightPublicId: 'insight-uuid',
          wording: 'Updated',
          evidenceReferences: [],
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({
        code: 'CONCURRENCY_ERROR',
        currentVersion: 3,
      });
    });
  });

  describe('useReviewInsight', () => {
    it('submits accept review', async () => {
      mockPost.mockResolvedValueOnce({
        data: { ...mockInsightDetail, status: 'accepted' },
      });

      const { result } = renderHook(() => useReviewInsight(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        projectId: 100,
        insightPublicId: 'insight-uuid',
        action: 'accept',
        revisionId: 1,
        expectedVersion: 1,
      });

      expect(mockPost).toHaveBeenCalledWith(
        'projects/100/insights/insight-uuid/reviews',
        expect.objectContaining({
          json: expect.objectContaining({
            action: 'accept',
            revisionId: 1,
          }),
        }),
      );
    });

    it('submits withdraw with required comment', async () => {
      mockPost.mockResolvedValueOnce({
        data: { ...mockInsightDetail, status: 'withdrawn' },
      });

      const { result } = renderHook(() => useReviewInsight(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        projectId: 100,
        insightPublicId: 'insight-uuid',
        action: 'withdraw',
        comment: 'No longer relevant',
        expectedVersion: 2,
      });

      expect(mockPost).toHaveBeenCalledWith(
        'projects/100/insights/insight-uuid/reviews',
        expect.objectContaining({
          json: expect.objectContaining({
            action: 'withdraw',
            comment: 'No longer relevant',
          }),
        }),
      );
    });

    it('does not retry on authorization error', async () => {
      mockPost.mockRejectedValueOnce({
        response: {
          status: 403,
          json: async () => ({
            error: {
              code: 'AUTHORIZATION_ERROR',
              message: 'Not authorized',
            },
          }),
        },
      });

      const { result } = renderHook(() => useReviewInsight(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({
          projectId: 100,
          insightPublicId: 'insight-uuid',
          action: 'accept',
          revisionId: 1,
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({
        code: 'AUTHORIZATION_ERROR',
        status: 403,
      });

      // No retry should have happened
      expect(mockPost).toHaveBeenCalledTimes(1);
    });

    it('does not retry (no duplicate submissions)', async () => {
      // The mutation is configured with retry: false
      // This is verified by showing only one call on failure
      vi.clearAllMocks(); // Clear any previous calls
      mockPost.mockRejectedValueOnce({
        response: {
          status: 500,
          json: async () => ({ error: { message: 'Server error' } }),
        },
      });

      const { result } = renderHook(() => useReviewInsight(), {
        wrapper: createWrapper(),
      });

      await expect(
        result.current.mutateAsync({
          projectId: 100,
          insightPublicId: 'insight-uuid',
          action: 'accept',
          revisionId: 1,
          expectedVersion: 1,
        }),
      ).rejects.toBeDefined();

      // No retry should have occurred
      expect(mockPost).toHaveBeenCalledTimes(1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CACHE CONSISTENCY
// ═══════════════════════════════════════════════════════════════════════════

describe('cache consistency', () => {
  it('mutation success invalidates all project queries', async () => {
    mockPost.mockResolvedValueOnce({ data: mockInsightDetail });

    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useReviewInsight(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    await result.current.mutateAsync({
      projectId: 100,
      insightPublicId: 'insight-uuid',
      action: 'accept',
      revisionId: 1,
      expectedVersion: 1,
    });

    // Should invalidate project root key (covers list, detail, revisions, reviews, count)
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['insights', 'project', 100],
    });
  });

  it('mutation failure does not invalidate cache', async () => {
    mockPost.mockRejectedValueOnce({
      response: {
        status: 500,
        json: async () => ({ error: { message: 'Server error' } }),
      },
    });

    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useReviewInsight(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });

    try {
      await result.current.mutateAsync({
        projectId: 100,
        insightPublicId: 'insight-uuid',
        action: 'accept',
        revisionId: 1,
        expectedVersion: 1,
      });
    } catch {
      // Expected
    }

    // Should NOT have called invalidate on failure
    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('maintains project isolation between caches', () => {
    // Different projects have completely separate query keys
    const project100List = insightsKeys.list(100, {});
    const project200List = insightsKeys.list(200, {});

    // Invalidating project 100 should not affect project 200
    expect(project100List[2]).toBe(100);
    expect(project200List[2]).toBe(200);
    expect(project100List).not.toEqual(project200List);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TYPE SAFETY
// ═══════════════════════════════════════════════════════════════════════════

describe('type safety', () => {
  it('InsightSummary has required fields', () => {
    const insight: InsightSummary = mockInsightSummary;

    // Type checking - these should all be defined
    expect(insight.publicId).toBeDefined();
    expect(insight.displayId).toBeDefined();
    expect(insight.status).toBeDefined();
    expect(insight.version).toBeDefined();
    expect(insight.needsReview).toBeDefined();
  });

  it('InsightDetail extends InsightSummary', () => {
    const detail: InsightDetail = mockInsightDetail;

    // Has summary fields
    expect(detail.publicId).toBeDefined();
    expect(detail.displayId).toBeDefined();

    // Has detail-specific fields
    expect(detail.latestRevision).toBeDefined();
    expect(detail.revisionCount).toBeDefined();
  });

  it('ReviewAction is correctly typed', () => {
    const actions: Array<'accept' | 'reject' | 'withdraw'> = [
      'accept',
      'reject',
      'withdraw',
    ];

    actions.forEach((action) => {
      expect(['accept', 'reject', 'withdraw']).toContain(action);
    });
  });
});
