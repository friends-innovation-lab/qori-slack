/**
 * Workspace components — shell layout for document routes.
 */

export { WorkspaceLayout } from './WorkspaceLayout';
export { ContextRail, type RailMode, type RailModeId } from './ContextRail';

// NAV-1a: Study workspace shell (owns LifecycleRail for all study routes)
export { StudyWorkspaceLayout } from './StudyWorkspaceLayout';
export {
  StudyWorkspaceProvider,
  useStudyWorkspace,
  type StudyWorkspaceState,
} from './StudyWorkspaceContext';

// M3C-B: Reference navigation
export { WorkspaceNavigationWrapper } from './WorkspaceNavigationWrapper';
export {
  ReferenceNavigationProvider,
  useReferenceNavigation,
  type ArtifactType as ReferenceArtifactType,
  type PinnedCoachRun,
  type ResolvedDestination,
  type NavigateToReferenceParams,
} from './ReferenceNavigationProvider';
