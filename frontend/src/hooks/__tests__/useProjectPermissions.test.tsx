/**
 * useProjectPermissions Tests — DR-4d
 *
 * Tests for:
 * - Owner/admin/researcher can review
 * - Non-members are read-only
 * - Loading state fails closed
 * - Unauthenticated fails closed
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useProjectPermissions } from '../useProjectPermissions';
import type { MeResource } from '@qori/api-contracts';

// Mock the auth provider
const mockAuthState: {
  status: 'loading' | 'authenticated' | 'unauthenticated';
  me: MeResource | null;
  logout: ReturnType<typeof vi.fn>;
  refresh: ReturnType<typeof vi.fn>;
} = {
  status: 'authenticated',
  me: null,
  logout: vi.fn(),
  refresh: vi.fn(),
};

vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => mockAuthState,
}));

describe('useProjectPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.status = 'authenticated';
    mockAuthState.me = null;
  });

  describe('owner/admin/researcher can review', () => {
    it('returns canReview=true for owner role', () => {
      mockAuthState.me = {
        actor: { public_id: 'actor-1', display_name: 'Test User', organization_public_id: 'org-1' },
        organization: { public_id: 'org-1', slug: 'test-org', name: 'Test Org' },
        authentication_provider: 'password',
        memberships: [
          { project_public_id: 'project-123', project_name: 'Test Project', role: 'owner' },
        ],
      };

      const { result } = renderHook(() => useProjectPermissions('project-123'));

      expect(result.current.canReview).toBe(true);
      expect(result.current.role).toBe('owner');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.readOnlyReason).toBeNull();
    });

    it('returns canReview=true for admin role', () => {
      mockAuthState.me = {
        actor: { public_id: 'actor-1', display_name: 'Test User', organization_public_id: 'org-1' },
        organization: { public_id: 'org-1', slug: 'test-org', name: 'Test Org' },
        authentication_provider: 'password',
        memberships: [
          { project_public_id: 'project-123', project_name: 'Test Project', role: 'admin' },
        ],
      };

      const { result } = renderHook(() => useProjectPermissions('project-123'));

      expect(result.current.canReview).toBe(true);
      expect(result.current.role).toBe('admin');
      expect(result.current.isLoading).toBe(false);
    });

    it('returns canReview=true for researcher role', () => {
      mockAuthState.me = {
        actor: { public_id: 'actor-1', display_name: 'Test User', organization_public_id: 'org-1' },
        organization: { public_id: 'org-1', slug: 'test-org', name: 'Test Org' },
        authentication_provider: 'password',
        memberships: [
          { project_public_id: 'project-123', project_name: 'Test Project', role: 'researcher' },
        ],
      };

      const { result } = renderHook(() => useProjectPermissions('project-123'));

      expect(result.current.canReview).toBe(true);
      expect(result.current.role).toBe('researcher');
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('non-members are read-only', () => {
    it('returns canReview=false when user is not a project member', () => {
      mockAuthState.me = {
        actor: { public_id: 'actor-1', display_name: 'Test User', organization_public_id: 'org-1' },
        organization: { public_id: 'org-1', slug: 'test-org', name: 'Test Org' },
        authentication_provider: 'password',
        memberships: [
          // Member of different project
          { project_public_id: 'other-project', project_name: 'Other Project', role: 'researcher' },
        ],
      };

      const { result } = renderHook(() => useProjectPermissions('project-123'));

      expect(result.current.canReview).toBe(false);
      expect(result.current.role).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.readOnlyReason).toBe('You have view-only access to this project.');
    });

    it('returns canReview=false for unknown role', () => {
      mockAuthState.me = {
        actor: { public_id: 'actor-1', display_name: 'Test User', organization_public_id: 'org-1' },
        organization: { public_id: 'org-1', slug: 'test-org', name: 'Test Org' },
        authentication_provider: 'password',
        memberships: [
          { project_public_id: 'project-123', project_name: 'Test Project', role: 'viewer' }, // Unknown role
        ],
      };

      const { result } = renderHook(() => useProjectPermissions('project-123'));

      expect(result.current.canReview).toBe(false);
      expect(result.current.role).toBe('viewer');
      expect(result.current.isLoading).toBe(false);
      expect(result.current.readOnlyReason).toBe('Your role does not allow reviewing insights.');
    });
  });

  describe('loading state fails closed', () => {
    it('returns canReview=false when auth is loading', () => {
      mockAuthState.status = 'loading';
      mockAuthState.me = null;

      const { result } = renderHook(() => useProjectPermissions('project-123'));

      expect(result.current.canReview).toBe(false);
      expect(result.current.role).toBeNull();
      expect(result.current.isLoading).toBe(true);
      expect(result.current.readOnlyReason).toBeNull();
    });

    it('returns canReview=false when projectPublicId is undefined', () => {
      mockAuthState.me = {
        actor: { public_id: 'actor-1', display_name: 'Test User', organization_public_id: 'org-1' },
        organization: { public_id: 'org-1', slug: 'test-org', name: 'Test Org' },
        authentication_provider: 'password',
        memberships: [
          { project_public_id: 'project-123', project_name: 'Test Project', role: 'owner' },
        ],
      };

      const { result } = renderHook(() => useProjectPermissions(undefined));

      expect(result.current.canReview).toBe(false);
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('unauthenticated fails closed', () => {
    it('returns canReview=false when user is unauthenticated', () => {
      mockAuthState.status = 'unauthenticated';
      mockAuthState.me = null;

      const { result } = renderHook(() => useProjectPermissions('project-123'));

      expect(result.current.canReview).toBe(false);
      expect(result.current.role).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.readOnlyReason).toBe('You must be signed in to review insights.');
    });
  });

  describe('multi-project membership', () => {
    it('finds correct role when user is member of multiple projects', () => {
      mockAuthState.me = {
        actor: { public_id: 'actor-1', display_name: 'Test User', organization_public_id: 'org-1' },
        organization: { public_id: 'org-1', slug: 'test-org', name: 'Test Org' },
        authentication_provider: 'password',
        memberships: [
          { project_public_id: 'project-a', project_name: 'Project A', role: 'owner' },
          { project_public_id: 'project-b', project_name: 'Project B', role: 'researcher' },
          { project_public_id: 'project-c', project_name: 'Project C', role: 'admin' },
        ],
      };

      const { result: resultB } = renderHook(() => useProjectPermissions('project-b'));
      expect(resultB.current.canReview).toBe(true);
      expect(resultB.current.role).toBe('researcher');

      const { result: resultD } = renderHook(() => useProjectPermissions('project-d'));
      expect(resultD.current.canReview).toBe(false);
      expect(resultD.current.role).toBeNull();
    });
  });
});
