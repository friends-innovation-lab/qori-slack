/**
 * DISC-3: useDiscovery hook tests — exactness guarantee for counts.
 *
 * API contract: GET /discovery/artifacts returns { data: artifacts[] } with NO total metadata.
 * Backend limit: default 50, max 100.
 *
 * Exactness rule: We can only prove count is exact if returned items < requested limit.
 * If items === limit, there may be more items, so count should be null (indeterminate).
 */

import { type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDiscoveryCounts } from '../useDiscovery';

// Mock the api client with any type to avoid complex typing
const mockGet = vi.fn();
vi.mock('@/api/client', () => ({
  api: {
    get: (...args: unknown[]) => mockGet(...args),
  },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useDiscoveryCounts exactness (DISC-3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns exact counts when artifact count < limit (count can be proven)', async () => {
    // 50 artifacts returned — less than limit of 100, so count is exact
    const artifacts = Array.from({ length: 50 }, (_, i) => ({
      publicId: `art-${i}`,
      artifactType: i < 20 ? 'desk_research' : i < 35 ? 'stakeholder_synthesis' : 'survey_synthesis',
      status: 'current',
    }));

    const runs = [
      { publicId: 'run-1', discoveryType: 'desk_research', status: 'completed' },
    ];

    mockGet.mockImplementation((url: string) => ({
      json: async () => {
        if (url.includes('/artifacts')) return { data: artifacts };
        if (url.includes('/runs')) return { data: runs };
        throw new Error(`Unexpected URL: ${url}`);
      },
    }));

    const { result } = renderHook(() => useDiscoveryCounts('proj-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).not.toBeNull());

    // Counts should be exact numbers
    expect(result.current.data?.desk).toBe(20);
    expect(result.current.data?.stakeholder).toBe(15);
    expect(result.current.data?.survey).toBe(15);
  });

  it('returns null counts when artifact count === limit (count may be truncated)', async () => {
    // Exactly 100 artifacts returned — at the limit, may be more
    const artifacts = Array.from({ length: 100 }, (_, i) => ({
      publicId: `art-${i}`,
      artifactType: 'desk_research',
      status: 'current',
    }));

    const runs: unknown[] = [];

    mockGet.mockImplementation((url: string) => ({
      json: async () => {
        if (url.includes('/artifacts')) return { data: artifacts };
        if (url.includes('/runs')) return { data: runs };
        throw new Error(`Unexpected URL: ${url}`);
      },
    }));

    const { result } = renderHook(() => useDiscoveryCounts('proj-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).not.toBeNull());

    // Counts should be null (indeterminate) when at limit
    expect(result.current.data?.desk).toBeNull();
    expect(result.current.data?.stakeholder).toBeNull();
    expect(result.current.data?.survey).toBeNull();
  });

  it('returns zero counts when no artifacts exist (zero is exact)', async () => {
    // 0 artifacts — definitely exact
    const artifacts: unknown[] = [];
    const runs: unknown[] = [];

    mockGet.mockImplementation((url: string) => ({
      json: async () => {
        if (url.includes('/artifacts')) return { data: artifacts };
        if (url.includes('/runs')) return { data: runs };
        throw new Error(`Unexpected URL: ${url}`);
      },
    }));

    const { result } = renderHook(() => useDiscoveryCounts('proj-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).not.toBeNull());

    // Zero counts should be exact
    expect(result.current.data?.desk).toBe(0);
    expect(result.current.data?.stakeholder).toBe(0);
    expect(result.current.data?.survey).toBe(0);
  });

  it('counts only "current" status artifacts (not superseded or failed)', async () => {
    // This test verifies the filter is being applied upstream
    // The hook requests status=current, so all returned artifacts should count
    const artifacts = [
      { publicId: 'art-1', artifactType: 'desk_research', status: 'current' },
      { publicId: 'art-2', artifactType: 'desk_research', status: 'current' },
      // Note: superseded/failed should NOT be returned by the API with status=current filter
    ];

    const runs: unknown[] = [];

    mockGet.mockImplementation((url: string) => ({
      json: async () => {
        if (url.includes('/artifacts')) {
          // Verify the status filter is applied
          expect(url).toContain('status=current');
          return { data: artifacts };
        }
        if (url.includes('/runs')) return { data: runs };
        throw new Error(`Unexpected URL: ${url}`);
      },
    }));

    const { result } = renderHook(() => useDiscoveryCounts('proj-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).not.toBeNull());

    expect(result.current.data?.desk).toBe(2);
  });

  it('needsReview tracks failed runs correctly', async () => {
    const artifacts: unknown[] = [];
    const runs = [
      { publicId: 'run-1', discoveryType: 'desk_research', status: 'completed' },
      { publicId: 'run-2', discoveryType: 'desk_research', status: 'failed' },
      { publicId: 'run-3', discoveryType: 'stakeholder_synthesis', status: 'processing' },
      { publicId: 'run-4', discoveryType: 'survey_synthesis', status: 'failed' },
    ];

    mockGet.mockImplementation((url: string) => ({
      json: async () => {
        if (url.includes('/artifacts')) return { data: artifacts };
        if (url.includes('/runs')) return { data: runs };
        throw new Error(`Unexpected URL: ${url}`);
      },
    }));

    const { result } = renderHook(() => useDiscoveryCounts('proj-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.data).not.toBeNull());

    expect(result.current.data?.needsReview.desk).toBe(true);
    expect(result.current.data?.needsReview.stakeholder).toBe(false);
    expect(result.current.data?.needsReview.survey).toBe(true);
  });

  it('returns loading state before data arrives', () => {
    mockGet.mockImplementation(() => ({
      json: () => new Promise(() => {}), // Never resolves
    }));

    const { result } = renderHook(() => useDiscoveryCounts('proj-1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it('returns error state on API failure', async () => {
    mockGet.mockImplementation(() => ({
      json: async () => {
        throw new Error('Network error');
      },
    }));

    const { result } = renderHook(() => useDiscoveryCounts('proj-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeInstanceOf(Error);
  });
});
