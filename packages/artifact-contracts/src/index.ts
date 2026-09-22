/**
 * Artifact Contracts Package
 *
 * Defines metadata contracts for Brief and Plan artifacts.
 * Contracts describe field identity, canonical storage, authority,
 * editability, generation mapping, and projection behavior.
 *
 * Contracts are metadata, not state — they do NOT contain research content.
 */

// Core types
export * from './types';

// Contracts
export { BRIEF_CONTRACT, BRIEF_YAML_TASK_IDS, type BriefYamlTaskId } from './brief.contract';
export { PLAN_CONTRACT, PLAN_YAML_TASK_IDS, type PlanYamlTaskId } from './plan.contract';

// Validation
export {
  validateContract,
  validateContractAgainstYaml,
  validateContractStructure,
  validateTaskSectionMapping,
  type ValidationError,
  type ValidationResult,
  type YamlTemplate,
  type YamlTask,
  type YamlEmit,
} from './validator';

// Extraction
export {
  extractGeneratedArtifactFields,
  buildTaskToSectionKeyMap,
  buildSectionKeyToTaskMap,
  getProseTaskIds,
  getStructuredJsonTaskIds,
  getCanonicalSectionKeys,
  type AiResponses,
  type ExtractedFieldValue,
  type ExtractionResult,
  type ExtractGeneratedFieldsInput,
} from './extractor';

// Workspace Projection (Phase 4)
export {
  projectBriefToWorkspace,
  projectPlanToWorkspace,
  // Types - View Models
  type BriefViewModel,
  type PlanViewModel,
  type BriefProjectionInput,
  type PlanProjectionInput,
  // Types - Shared
  type FieldAuthority,
  type FieldProvenance,
  type QuickFact,
  type ProseSection,
  type MastheadViewModel,
  type TimelineSummary,
  type ArtifactMetadata,
  // Types - Structured Items
  type ObjectiveItem,
  type QuestionItem,
  type BarrierItem,
  type ParticipantSegment,
  type TimelinePhase,
  type BriefRisk,
  type PlanRisk,
  type BriefCommitment,
  type DeliverableItem,
  type DiscoverySource,
  // Types - Approval
  type BriefApprovalStatus,
  type BriefApprovalState,
} from './workspace-projection';
