/**
 * WorkspaceNavigationWrapper — Extracts workspace context from URL and provides
 * ReferenceNavigationProvider for Coach reference navigation.
 *
 * M3C-B: This wrapper lives at the AppShell level and persists across Brief ↔ Plan
 * navigation. It extracts studyPublicId and artifactType from the current route
 * and provides them to the ReferenceNavigationProvider.
 *
 * M4B.1: CommentDraftProvider also lives here to:
 * - Provide draft guard to ReferenceNavigationProvider for cross-artifact blocking
 * - Survive rail mode switching (CommentsRail unmount/remount)
 * - Clear draft session on different-artifact initialization (handled by initSession)
 *
 * Architecture:
 * - Wrapper detects workspace routes and extracts context from URL
 * - For non-workspace routes, provides a no-op context (references not clickable)
 * - Survives Brief ↔ Plan navigation since AppShell doesn't remount
 */

import { type ReactNode, useMemo } from 'react';
import { useLocation, matchPath } from 'react-router';
import {
  ReferenceNavigationProvider,
  type ArtifactType,
} from './ReferenceNavigationProvider';
import { CommentDraftProvider } from '../document/CommentDraftContext';

/** Workspace route patterns */
const WORKSPACE_PATTERNS = [
  '/studies/:studyPublicId/brief',
  '/studies/:studyPublicId/plan',
] as const;

interface WorkspaceNavigationWrapperProps {
  children: ReactNode;
}

/**
 * Extract workspace context (studyPublicId, artifactType) from current pathname.
 */
function extractWorkspaceContext(
  pathname: string,
): { studyPublicId: string | null; artifactType: ArtifactType | null } {
  for (const pattern of WORKSPACE_PATTERNS) {
    const match = matchPath(pattern, pathname);
    if (match) {
      const studyPublicId = match.params.studyPublicId ?? null;
      const artifactType = pattern.includes('/brief') ? 'brief' : 'plan';
      return { studyPublicId, artifactType };
    }
  }
  return { studyPublicId: null, artifactType: null };
}

export function WorkspaceNavigationWrapper({ children }: WorkspaceNavigationWrapperProps) {
  const location = useLocation();

  const { studyPublicId, artifactType } = useMemo(
    () => extractWorkspaceContext(location.pathname),
    [location.pathname],
  );

  // M4B.1: CommentDraftProvider wraps ReferenceNavigationProvider so the
  // reference navigation can use useCommentDraftGuard() for cross-artifact blocking
  return (
    <CommentDraftProvider>
      <ReferenceNavigationProvider
        studyPublicId={studyPublicId}
        currentArtifactType={artifactType}
      >
        {children}
      </ReferenceNavigationProvider>
    </CommentDraftProvider>
  );
}
