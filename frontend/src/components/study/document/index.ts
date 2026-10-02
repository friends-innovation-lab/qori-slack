export { ApprovalSection } from './ApprovalSection';
export { ArtifactHeader } from './ArtifactHeader';
export { ArtifactTabs } from './ArtifactTabs';
export { CoachingRail, selectPrimaryArtifactRun, selectPrimarySectionRun } from './CoachingRail';
export type { CoachingSectionContext } from './CoachingRail';
// M3C-B: Clickable reference link
export { ReferenceLink } from './ReferenceLink';
export { CollapsibleSection } from './CollapsibleSection';
export {
  CommentDraftProvider,
  useCommentDraft,
  useCommentDraftGuard,
} from './CommentDraftContext';
export type {
  CommentDraftSession,
  CommentDraftContextValue,
} from './CommentDraftContext';
export { CommentsRail } from './CommentsRail';
export type { CommentsRailScope } from './CommentsRail';
export { DocumentSection } from './DocumentSection';
export type { SectionCommentProps, SectionCoachProps } from './DocumentSection';
export { DocumentTable } from './DocumentTable';
export { FactsGrid } from './FactsGrid';
export { IdTag } from './IdTag';
export { Masthead } from './Masthead';
export { ProvenanceTag } from './ProvenanceTag';
export { ReviewRail } from './ReviewRail';
export type { ChecklistState } from './ReviewRail';
export { SaveStateIndicator } from './SaveStateIndicator';
export { StructuredItemRow } from './StructuredItemRow';
export { StructuredItemRows } from './StructuredItemRows';
export {
  getSectionsForArtifact,
  getSectionLabel,
  isValidSection,
  isCommentableSection,
  BRIEF_SECTIONS,
  PLAN_SECTIONS,
  type ArtifactType,
  type SectionDefinition,
} from './sectionLabels';
