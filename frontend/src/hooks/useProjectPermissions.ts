/**
 * useProjectPermissions — Project-level permission resolution.
 *
 * Per DR-4d requirements:
 * - Owner/admin/researcher: can review (canReview = true)
 * - Lower-privilege viewers or non-members: read-only (canReview = false)
 * - Unknown/loading permissions: fail closed (canReview = false)
 *
 * Backend authorization remains authoritative — this hook provides
 * UI gating only. Mutations will fail with 403 if backend disagrees.
 */

import { useMemo } from 'react';
import { useAuth } from '@/auth/AuthProvider';

/** Roles that grant review permission per SPEC-2 D2 */
const REVIEWER_ROLES = ['owner', 'admin', 'researcher'] as const;

export interface ProjectPermissions {
  /** Whether the current user can review insights (owner/admin/researcher) */
  canReview: boolean;

  /** User's role in this project (null if not a member or loading) */
  role: string | null;

  /** Whether permissions are still loading */
  isLoading: boolean;

  /** Reason for read-only state (for UI display) */
  readOnlyReason: string | null;
}

/**
 * Get project-level permissions for the current user.
 *
 * @param projectPublicId - The project's public UUID
 * @returns Permission state with fail-closed semantics
 */
export function useProjectPermissions(projectPublicId: string | undefined): ProjectPermissions {
  const { status, me } = useAuth();

  return useMemo(() => {
    // Loading state: fail closed
    if (status === 'loading' || !projectPublicId) {
      return {
        canReview: false,
        role: null,
        isLoading: true,
        readOnlyReason: null,
      };
    }

    // Not authenticated: fail closed
    if (status === 'unauthenticated' || !me) {
      return {
        canReview: false,
        role: null,
        isLoading: false,
        readOnlyReason: 'You must be signed in to review insights.',
      };
    }

    // Find membership for this project
    const membership = me.memberships.find(
      (m) => m.project_public_id === projectPublicId
    );

    // Not a member: read-only
    if (!membership) {
      return {
        canReview: false,
        role: null,
        isLoading: false,
        readOnlyReason: 'You have view-only access to this project.',
      };
    }

    // Check if role grants review permission
    const hasReviewPermission = REVIEWER_ROLES.includes(
      membership.role as (typeof REVIEWER_ROLES)[number]
    );

    if (!hasReviewPermission) {
      return {
        canReview: false,
        role: membership.role,
        isLoading: false,
        readOnlyReason: 'Your role does not allow reviewing insights.',
      };
    }

    // Has review permission
    return {
      canReview: true,
      role: membership.role,
      isLoading: false,
      readOnlyReason: null,
    };
  }, [status, me, projectPublicId]);
}
