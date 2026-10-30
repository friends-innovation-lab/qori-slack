/**
 * useCreateDiscoveryRun Mutation Tests — DISC-WEB-1C-2a
 *
 * Tests for Discovery run creation mutation supporting both:
 * - Legacy sources[] path (StakeholderIntake, Slack)
 * - sourceRefs[] path (DeskIntake with extraction staging)
 *
 * Verifies:
 * - Idempotency-Key header for sourceRefs requests
 * - Legacy path unchanged
 * - Error handling for 409, 410, 503
 * - No API call on missing/invalid idempotency key
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HTTPError } from 'ky';
import type { ReactNode } from 'react';
import type { NormalizedOptions, ResponsePromise } from 'ky';
import {
  useCreateDiscoveryRun,
  ERROR_FEATURE_DISABLED,
  ERROR_IDEMPOTENCY_CONFLICT,
  ERROR_SOURCE_REF_UNAVAILABLE,
} from '../useCreateDiscoveryRun';
import type {
  CreateDiscoveryRunInput,
  CreateDiscoveryRunFromRefsInput,
  CreateDiscoveryRunLegacyInput,
} from '@qori/api-contracts';

// Local type guards for testing (avoid ESM/CJS interop issues with api-contracts)
function isSourceRefsInput(
  input: CreateDiscoveryRunInput,
): input is CreateDiscoveryRunFromRefsInput {
  return 'sourceRefs' in input && Array.isArray((input as CreateDiscoveryRunFromRefsInput).sourceRefs);
}

function isLegacySourcesInput(
  input: CreateDiscoveryRunInput,
): input is CreateDiscoveryRunLegacyInput {
  return 'sources' in input && Array.isArray((input as CreateDiscoveryRunLegacyInput).sources);
}

// Mock the API client
vi.mock('@/api/client', () => ({
  api: {
    post: vi.fn(),
  },
}));

import { api } from '@/api/client';
const postMock = vi.mocked(api.post);

// Test wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// Mock HTTPError for ky
function createMockHTTPError(status: number, body: object): HTTPError {
  const response = {
    status,
    statusText: status === 503 ? 'Service Unavailable' : 'Error',
    json: () => Promise.resolve(body),
    clone: () => response,
  } as unknown as Response;

  const error = new HTTPError(
    response,
    new Request('http://test'),
    {} as NormalizedOptions,
  );
  return error;
}

// Mock successful response
function createMockResponse(publicId: string, isReplay = false) {
  return {
    data: {
      publicId,
      discoveryType: 'desk_research',
      topic: 'Test Topic',
      topicSlug: 'test-topic',
      sourceIntent: null,
      status: 'pending',
      stage: null,
      sourceCount: 1,
      attemptCount: 0,
      createdAt: '2026-10-30T12:00:00Z',
      startedAt: null,
      completedAt: null,
      createdBy: 'api:test-user',
      currentArtifactPublicId: null,
      failureCode: null,
      failureMessage: null,
      marker: 'D1',
    },
    meta: {
      message: isReplay
        ? 'Idempotent replay: returning existing run.'
        : 'Discovery run created.',
      isReplay,
      pollUrl: `/api/v1/projects/proj-1/discovery/runs/${publicId}`,
      recommendedPollInterval: '2000ms',
    },
  };
}

// Create mock for ky response
function createMockKyResponse(response: object, status: number) {
  return {
    json: () => Promise.resolve(response),
    status,
    // Add minimal required properties for ResponsePromise
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    bytes: () => Promise.resolve(new Uint8Array()),
    text: () => Promise.resolve(''),
  } as unknown as ResponsePromise;
}

describe('useCreateDiscoveryRun', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Type Guards ─────────────────────────────────────────────────────

  describe('type guards', () => {
    it('isSourceRefsInput identifies sourceRefs input', () => {
      const input = {
        discoveryType: 'desk_research' as const,
        topic: 'Test',
        sourceRefs: ['ref-1', 'ref-2'],
      };
      expect(isSourceRefsInput(input)).toBe(true);
      expect(isLegacySourcesInput(input)).toBe(false);
    });

    it('isLegacySourcesInput identifies sources input', () => {
      const input = {
        discoveryType: 'stakeholder_synthesis' as const,
        topic: 'Test',
        sources: [
          {
            filename: 'test.txt',
            extractedText: 'content',
            contentHash: 'abc123',
            mimeType: 'text/plain',
            sizeBytes: 100,
          },
        ],
      };
      expect(isLegacySourcesInput(input)).toBe(true);
      expect(isSourceRefsInput(input)).toBe(false);
    });
  });

  // ─── Legacy sources[] Path ───────────────────────────────────────────

  describe('legacy sources[] path', () => {
    it('creates run without Idempotency-Key header', async () => {
      const mockResponse = createMockResponse('run-123');

      postMock.mockReturnValue(createMockKyResponse(mockResponse, 201));

      const { result } = renderHook(() => useCreateDiscoveryRun('proj-1'), {
        wrapper: createWrapper(),
      });

      const outcome = await result.current.mutateAsync({
        input: {
          discoveryType: 'stakeholder_synthesis',
          topic: 'Test Topic',
          sourceIntent: null,
          sources: [
            {
              filename: 'interview.txt',
              extractedText: 'Interview content here',
              contentHash: 'abc123',
              mimeType: 'text/plain',
              sizeBytes: 500,
            },
          ],
        },
      });

      expect(outcome.success).toBe(true);
      if (outcome.success) {
        expect(outcome.response.data.publicId).toBe('run-123');
        expect(outcome.isReplay).toBe(false);
      }

      // Verify NO Idempotency-Key header
      expect(postMock).toHaveBeenCalledWith(
        'projects/proj-1/discovery/runs',
        expect.objectContaining({
          json: expect.objectContaining({
            discoveryType: 'stakeholder_synthesis',
            sources: expect.any(Array),
          }),
        }),
      );

      // Explicitly check headers were not passed
      const callArgs = postMock.mock.calls[0][1];
      expect(callArgs?.headers).toBeUndefined();
    });

    it('does NOT include extractedText in response', async () => {
      const mockResponse = createMockResponse('run-123');

      postMock.mockReturnValue(createMockKyResponse(mockResponse, 201));

      const { result } = renderHook(() => useCreateDiscoveryRun('proj-1'), {
        wrapper: createWrapper(),
      });

      const outcome = await result.current.mutateAsync({
        input: {
          discoveryType: 'desk_research',
          topic: 'Test',
          sources: [
            {
              filename: 'doc.txt',
              extractedText: 'This is the content',
              contentHash: 'hash',
              mimeType: 'text/plain',
              sizeBytes: 100,
            },
          ],
        },
      });

      expect(outcome.success).toBe(true);
      if (outcome.success) {
        // Verify response does NOT contain extractedText
        const responseStr = JSON.stringify(outcome.response);
        expect(responseStr).not.toContain('extractedText');
        expect(responseStr).not.toContain('This is the content');
      }
    });
  });

  // ─── sourceRefs[] Path ───────────────────────────────────────────────

  describe('sourceRefs[] path', () => {
    it('includes Idempotency-Key header for sourceRefs requests', async () => {
      const mockResponse = createMockResponse('run-456');

      postMock.mockReturnValue(createMockKyResponse(mockResponse, 201));

      const { result } = renderHook(() => useCreateDiscoveryRun('proj-1'), {
        wrapper: createWrapper(),
      });

      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';
      const outcome = await result.current.mutateAsync({
        input: {
          discoveryType: 'desk_research',
          topic: 'Test Topic',
          sourceIntent: 'Testing refs',
          sourceRefs: ['ref-token-1', 'ref-token-2'],
        },
        idempotencyKey,
      });

      expect(outcome.success).toBe(true);

      // Verify Idempotency-Key header was sent
      expect(postMock).toHaveBeenCalledWith(
        'projects/proj-1/discovery/runs',
        expect.objectContaining({
          json: expect.objectContaining({
            discoveryType: 'desk_research',
            sourceRefs: ['ref-token-1', 'ref-token-2'],
          }),
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
        }),
      );
    });

    it('does NOT call API when idempotency key is empty string', async () => {
      const { result } = renderHook(() => useCreateDiscoveryRun('proj-1'), {
        wrapper: createWrapper(),
      });

      // Empty idempotencyKey (falsy but present)
      const outcome = await result.current.mutateAsync({
        input: {
          discoveryType: 'desk_research',
          topic: 'Test Topic',
          sourceRefs: ['ref-token-1'],
        },
        idempotencyKey: '', // Empty string is falsy
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.code).toBe('MISSING_IDEMPOTENCY_KEY');
      }

      // Verify NO API call was made
      expect(postMock).not.toHaveBeenCalled();
    });

    it('does NOT call API when idempotency key is invalid UUID', async () => {
      const { result } = renderHook(() => useCreateDiscoveryRun('proj-1'), {
        wrapper: createWrapper(),
      });

      const outcome = await result.current.mutateAsync({
        input: {
          discoveryType: 'desk_research',
          topic: 'Test Topic',
          sourceRefs: ['ref-token-1'],
        },
        idempotencyKey: 'not-a-valid-uuid',
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.code).toBe('INVALID_IDEMPOTENCY_KEY');
      }

      // Verify NO API call was made
      expect(postMock).not.toHaveBeenCalled();
    });

    it('returns isReplay=true for 200 replay response', async () => {
      const mockResponse = createMockResponse('run-456', true);

      postMock.mockReturnValue(createMockKyResponse(mockResponse, 200));

      const { result } = renderHook(() => useCreateDiscoveryRun('proj-1'), {
        wrapper: createWrapper(),
      });

      const outcome = await result.current.mutateAsync({
        input: {
          discoveryType: 'desk_research',
          topic: 'Test Topic',
          sourceRefs: ['ref-token-1'],
        },
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(outcome.success).toBe(true);
      if (outcome.success) {
        expect(outcome.isReplay).toBe(true);
        expect(outcome.status).toBe(200);
        expect(outcome.response.meta.isReplay).toBe(true);
      }
    });

    it('preserves same run identity on same-key same-payload retry', async () => {
      const runPublicId = 'run-same-identity-789';
      const idempotencyKey = '550e8400-e29b-41d4-a716-446655440000';

      // First call returns 201 (new creation)
      postMock.mockReturnValueOnce(
        createMockKyResponse(createMockResponse(runPublicId, false), 201),
      );

      // Second call returns 200 (replay)
      postMock.mockReturnValueOnce(
        createMockKyResponse(createMockResponse(runPublicId, true), 200),
      );

      const { result } = renderHook(() => useCreateDiscoveryRun('proj-1'), {
        wrapper: createWrapper(),
      });

      const variables = {
        input: {
          discoveryType: 'desk_research' as const,
          topic: 'Test Topic',
          sourceRefs: ['ref-token-1'],
        },
        idempotencyKey,
      };

      // First request
      const outcome1 = await result.current.mutateAsync(variables);
      expect(outcome1.success).toBe(true);
      if (outcome1.success) {
        expect(outcome1.isReplay).toBe(false);
        expect(outcome1.response.data.publicId).toBe(runPublicId);
      }

      // Second request with same key and payload
      const outcome2 = await result.current.mutateAsync(variables);
      expect(outcome2.success).toBe(true);
      if (outcome2.success) {
        expect(outcome2.isReplay).toBe(true);
        // Same run identity preserved
        expect(outcome2.response.data.publicId).toBe(runPublicId);
      }
    });
  });

  // ─── Error Handling ──────────────────────────────────────────────────

  describe('error handling', () => {
    it('surfaces 409 IDEMPOTENCY_CONFLICT without auto-retry', async () => {
      const error = createMockHTTPError(409, {
        error: {
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Idempotency key was already used with a different request payload',
        },
      });

      postMock.mockImplementation(() => {
        throw error;
      });

      const { result } = renderHook(() => useCreateDiscoveryRun('proj-1'), {
        wrapper: createWrapper(),
      });

      const outcome = await result.current.mutateAsync({
        input: {
          discoveryType: 'desk_research',
          topic: 'Test Topic',
          sourceRefs: ['ref-token-1'],
        },
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.code).toBe(ERROR_IDEMPOTENCY_CONFLICT);
        expect(outcome.status).toBe(409);
      }

      // Verify only ONE API call was made (no auto-retry)
      expect(postMock).toHaveBeenCalledTimes(1);
    });

    it('surfaces 410 SOURCE_REF_UNAVAILABLE for expired refs', async () => {
      const error = createMockHTTPError(410, {
        error: {
          code: 'SOURCE_REF_UNAVAILABLE',
          message: '2 source refs are unavailable (expired, consumed, or invalid)',
        },
      });

      postMock.mockImplementation(() => {
        throw error;
      });

      const { result } = renderHook(() => useCreateDiscoveryRun('proj-1'), {
        wrapper: createWrapper(),
      });

      const outcome = await result.current.mutateAsync({
        input: {
          discoveryType: 'desk_research',
          topic: 'Test Topic',
          sourceRefs: ['expired-ref-1', 'expired-ref-2'],
        },
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.code).toBe(ERROR_SOURCE_REF_UNAVAILABLE);
        expect(outcome.status).toBe(410);
      }
    });

    it('surfaces 503 FEATURE_DISABLED', async () => {
      const error = createMockHTTPError(503, {
        error: {
          code: 'FEATURE_DISABLED',
          message: 'Source reference consumption is not available',
        },
      });

      postMock.mockImplementation(() => {
        throw error;
      });

      const { result } = renderHook(() => useCreateDiscoveryRun('proj-1'), {
        wrapper: createWrapper(),
      });

      const outcome = await result.current.mutateAsync({
        input: {
          discoveryType: 'desk_research',
          topic: 'Test Topic',
          sourceRefs: ['ref-token-1'],
        },
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.code).toBe(ERROR_FEATURE_DISABLED);
        expect(outcome.status).toBe(503);
      }
    });

    it('handles network errors gracefully', async () => {
      const error = new TypeError('Failed to fetch');

      postMock.mockImplementation(() => {
        throw error;
      });

      const { result } = renderHook(() => useCreateDiscoveryRun('proj-1'), {
        wrapper: createWrapper(),
      });

      const outcome = await result.current.mutateAsync({
        input: {
          discoveryType: 'desk_research',
          topic: 'Test Topic',
          sourceRefs: ['ref-token-1'],
        },
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.code).toBe('NETWORK_ERROR');
      }
    });
  });

  // ─── Critical: No Extraction Text ────────────────────────────────────

  describe('CRITICAL: no extraction text in frontend', () => {
    it('sourceRefs request does NOT include extractedText', async () => {
      const mockResponse = createMockResponse('run-999');

      postMock.mockReturnValue(createMockKyResponse(mockResponse, 201));

      const { result } = renderHook(() => useCreateDiscoveryRun('proj-1'), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync({
        input: {
          discoveryType: 'desk_research',
          topic: 'Test Topic',
          sourceRefs: ['ref-token-1'],
        },
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      });

      // Verify request body does NOT contain extractedText
      const requestBody = postMock.mock.calls[0][1]?.json;
      const requestStr = JSON.stringify(requestBody);
      expect(requestStr).not.toContain('extractedText');
    });

    it('response does NOT contain extractedText', async () => {
      const mockResponse = createMockResponse('run-999');

      postMock.mockReturnValue(createMockKyResponse(mockResponse, 201));

      const { result } = renderHook(() => useCreateDiscoveryRun('proj-1'), {
        wrapper: createWrapper(),
      });

      const outcome = await result.current.mutateAsync({
        input: {
          discoveryType: 'desk_research',
          topic: 'Test Topic',
          sourceRefs: ['ref-token-1'],
        },
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(outcome.success).toBe(true);
      if (outcome.success) {
        const responseStr = JSON.stringify(outcome.response);
        expect(responseStr).not.toContain('extractedText');
      }
    });
  });
});
