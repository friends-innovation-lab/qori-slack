/**
 * useUploadDocuments Mutation Tests — DISC-WEB-1C
 *
 * Tests for document upload mutation to extraction endpoint.
 * Verifies error handling, response parsing, and NO Discovery run calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HTTPError } from 'ky';
import type { ReactNode } from 'react';
import type { NormalizedOptions } from 'ky';
import {
  useUploadDocuments,
  ERROR_FEATURE_DISABLED,
  ERROR_UPLOAD_BUSY,
  ERROR_NETWORK,
} from '../useUploadDocuments';

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

// Mock File constructor
function createMockFile(name: string, size: number, type: string): File {
  const blob = new Blob(['x'.repeat(size)], { type });
  return new File([blob], name, { type });
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

describe('useUploadDocuments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('successful upload', () => {
    it('returns success with refs and rejected files', async () => {
      const mockResponse = {
        data: {
          refs: [
            {
              refToken: 'ref-123',
              filename: 'test.pdf',
              mimeType: 'application/pdf',
              sizeBytes: 1024,
              charCount: 500,
              fileHash: 'abc123',
              contentHash: 'def456',
              expiresAt: '2024-01-01T00:00:00Z',
            },
          ],
          rejected: [
            {
              filename: 'bad.doc',
              mimeType: 'application/msword',
              errorCode: 'UNSUPPORTED_FILE_TYPE',
              errorMessage: 'Legacy .doc not supported',
            },
          ],
        },
        meta: {
          expiresInMs: 1800000,
          consumeEndpoint: '/api/v1/projects/proj-1/discovery/runs',
        },
      };

      postMock.mockReturnValue({
        json: () => Promise.resolve(mockResponse),
      } as ReturnType<typeof api.post>);

      const { result } = renderHook(() => useUploadDocuments('proj-1'), {
        wrapper: createWrapper(),
      });

      const files = [createMockFile('test.pdf', 1024, 'application/pdf')];
      const outcome = await result.current.mutateAsync({ files });

      expect(outcome.success).toBe(true);
      if (outcome.success) {
        expect(outcome.response.data.refs).toHaveLength(1);
        expect(outcome.response.data.refs[0].filename).toBe('test.pdf');
        expect(outcome.response.data.rejected).toHaveLength(1);
        expect(outcome.response.data.rejected[0].errorCode).toBe('UNSUPPORTED_FILE_TYPE');
      }

      // Verify API was called with correct endpoint
      expect(postMock).toHaveBeenCalledWith(
        'projects/proj-1/extraction/documents',
        expect.objectContaining({
          body: expect.any(FormData),
        }),
      );
    });

    it('returns empty refs and rejected arrays on success with no files', async () => {
      const mockResponse = {
        data: { refs: [], rejected: [] },
        meta: { expiresInMs: 1800000, consumeEndpoint: '/api/v1/projects/proj-1/discovery/runs' },
      };

      postMock.mockReturnValue({
        json: () => Promise.resolve(mockResponse),
      } as ReturnType<typeof api.post>);

      const { result } = renderHook(() => useUploadDocuments('proj-1'), {
        wrapper: createWrapper(),
      });

      const outcome = await result.current.mutateAsync({ files: [] });

      expect(outcome.success).toBe(true);
      if (outcome.success) {
        expect(outcome.response.data.refs).toHaveLength(0);
        expect(outcome.response.data.rejected).toHaveLength(0);
      }
    });
  });

  describe('503 FEATURE_DISABLED handling', () => {
    it('returns non-transient error with FEATURE_DISABLED code', async () => {
      const error = createMockHTTPError(503, {
        error: {
          code: 'FEATURE_DISABLED',
          message: 'Document extraction is not available',
        },
      });

      postMock.mockReturnValue({
        json: () => Promise.reject(error),
      } as ReturnType<typeof api.post>);

      const { result } = renderHook(() => useUploadDocuments('proj-1'), {
        wrapper: createWrapper(),
      });

      const files = [createMockFile('test.txt', 100, 'text/plain')];
      const outcome = await result.current.mutateAsync({ files });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.code).toBe(ERROR_FEATURE_DISABLED);
        expect(outcome.transient).toBe(false);
        expect(outcome.status).toBe(503);
      }
    });
  });

  describe('503 EXTRACTION_UPLOAD_BUSY handling', () => {
    it('returns transient error when upload service is busy', async () => {
      const error = createMockHTTPError(503, {
        error: {
          code: 'EXTRACTION_UPLOAD_BUSY',
          message: 'Upload service is busy. Please try again later.',
        },
      });

      postMock.mockReturnValue({
        json: () => Promise.reject(error),
      } as ReturnType<typeof api.post>);

      const { result } = renderHook(() => useUploadDocuments('proj-1'), {
        wrapper: createWrapper(),
      });

      const files = [createMockFile('test.txt', 100, 'text/plain')];
      const outcome = await result.current.mutateAsync({ files });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.code).toBe(ERROR_UPLOAD_BUSY);
        expect(outcome.transient).toBe(true);
        expect(outcome.status).toBe(503);
      }
    });
  });

  describe('network error handling', () => {
    it('returns transient error on network failure', async () => {
      const error = new TypeError('Failed to fetch');

      postMock.mockReturnValue({
        json: () => Promise.reject(error),
      } as ReturnType<typeof api.post>);

      const { result } = renderHook(() => useUploadDocuments('proj-1'), {
        wrapper: createWrapper(),
      });

      const files = [createMockFile('test.txt', 100, 'text/plain')];
      const outcome = await result.current.mutateAsync({ files });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.code).toBe(ERROR_NETWORK);
        expect(outcome.transient).toBe(true);
      }
    });
  });

  describe('CRITICAL: no Discovery run calls', () => {
    it('does NOT call any discovery/runs endpoint', async () => {
      const mockResponse = {
        data: {
          refs: [{ refToken: 'ref-1', filename: 'test.pdf', mimeType: 'application/pdf', sizeBytes: 1024, charCount: 500, fileHash: 'a', contentHash: 'b', expiresAt: '2024-01-01T00:00:00Z' }],
          rejected: [],
        },
        meta: { expiresInMs: 1800000, consumeEndpoint: '/api/v1/projects/proj-1/discovery/runs' },
      };

      postMock.mockReturnValue({
        json: () => Promise.resolve(mockResponse),
      } as ReturnType<typeof api.post>);

      const { result } = renderHook(() => useUploadDocuments('proj-1'), {
        wrapper: createWrapper(),
      });

      const files = [createMockFile('test.pdf', 1024, 'application/pdf')];
      await result.current.mutateAsync({ files });

      // Verify only extraction endpoint was called, NOT discovery/runs
      expect(postMock).toHaveBeenCalledTimes(1);
      expect(postMock).toHaveBeenCalledWith(
        'projects/proj-1/extraction/documents',
        expect.anything(),
      );

      // Explicitly verify no discovery endpoint calls
      const calls = postMock.mock.calls;
      for (const [url] of calls) {
        expect(url).not.toContain('discovery/runs');
      }
    });
  });
});
