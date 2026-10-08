/**
 * StudyWorkspaceContext — NAV-1a + NAV-1b
 *
 * Context for sharing study workspace state across all study routes.
 * Owns: study data, brief status, discovery counts, nav drawer state.
 *
 * NAV-1b: Added activeDiscoveryType for run pages to signal their parent type
 * to the LifecycleRail for correct active state highlighting.
 *
 * This context is provided by StudyWorkspaceLayout and consumed by:
 * - LifecycleRail (via the layout)
 * - ArtifactHeader (for nav toggle)
 * - Any page needing study/project IDs
 * - DiscoveryRunPage (to set activeDiscoveryType)
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { LifecycleNode } from '@qori/api-contracts';
import type { DiscoveryCounts } from '@/components/study/LifecycleRail';
import type { DiscoveryTypeFilter } from '@/components/study/workspaceLifecycle';

export interface StudyWorkspaceState {
  /** Study public ID from URL */
  studyPublicId: string;
  /** Project public ID (for Discovery API calls) */
  projectPublicId: string;
  /** Study name */
  studyName: string;
  /** Brief approval status (null if no brief exists) */
  briefStatus: string | null;
  /** Computed lifecycle nodes (for Plan lock) */
  lifecycleNodes: LifecycleNode[];
  /** Discovery counts per type */
  discoveryCounts: DiscoveryCounts | undefined;
  /**
   * NAV-1b: Active discovery type for run pages.
   * When on a run page, this is set to the run's discovery type
   * so LifecycleRail can highlight the correct parent section.
   */
  activeDiscoveryType: DiscoveryTypeFilter | null;
  /** NAV-1b: Set active discovery type (used by run pages) */
  setActiveDiscoveryType: (type: DiscoveryTypeFilter | null) => void;
  /** Whether nav drawer is open (≤980px) */
  navOpen: boolean;
  /** Open the nav drawer */
  openNav: () => void;
  /** Close the nav drawer */
  closeNav: () => void;
  /** Toggle the nav drawer */
  toggleNav: () => void;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
}

const StudyWorkspaceContext = createContext<StudyWorkspaceState | null>(null);

export function StudyWorkspaceProvider({
  value,
  children,
}: {
  value: StudyWorkspaceState;
  children: ReactNode;
}) {
  return (
    <StudyWorkspaceContext.Provider value={value}>
      {children}
    </StudyWorkspaceContext.Provider>
  );
}

/**
 * Access study workspace context.
 * Must be used within StudyWorkspaceLayout.
 */
export function useStudyWorkspace(): StudyWorkspaceState {
  const context = useContext(StudyWorkspaceContext);
  if (!context) {
    throw new Error('useStudyWorkspace must be used within StudyWorkspaceLayout');
  }
  return context;
}
