/**
 * Qori API Enums — shared between backend and frontend.
 */

export type BriefStatus = 'pending_approval' | 'changes_requested' | 'approved';

export type ApprovalAction = 'approve' | 'request_changes';

export type DocumentType = 'brief' | 'plan' | 'discussion';

export type ProjectStatus = 'active' | 'archived';

export type WorkflowStatus = 'generating' | 'draft' | 'approved' | 'published';

export type PublicationStatus =
  | 'not_published'
  | 'publishing'
  | 'published'
  | 'projection_failed';

export type QueueItemKind =
  | 'brief_approval'
  | 'pii_review'
  | 'findings_review'
  | 'artifact_approval'
  | 'publication_failure'
  | 'stale_evidence'
  | 'informational';

export type LifecycleNodeState = 'locked' | 'readiness_warning' | 'suggested' | 'free' | 'current';

export type ResearchMethodology =
  | 'usability_testing'
  | 'user_interviews'
  | 'contextual_inquiry'
  | 'concept_testing'
  | 'survey'
  | 'card_sorting'
  | 'tree_testing'
  | 'mixed_methods';
