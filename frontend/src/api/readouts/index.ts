/**
 * Readouts API — DR-6b-4a
 *
 * Public exports for Desk Research Readouts API layer.
 */

// Types
export type {
  // Citation types
  Citation,
  SupersededCitation,
  // Content structure
  DraftContent,
  Summary,
  Finding,
  Limitation,
  Implication,
  ImplicationKind,
  // Readout types
  ReadoutSummary,
  ReadoutDetail,
  DraftDetail,
  ApprovalDetail,
  GenerationVersion,
  GenerationStatus,
  ApprovalEligibility,
  // Evidence types
  EligibleInsight,
  EligibleInsightSource,
  EvidenceSnapshot,
  EvidenceSnapshotEntry,
  // Version content types (DR-6b-5e-B)
  VersionContent,
  VersionContentResponse,
  VersionEvidenceEntry,
  // Response types
  ReadoutListResponse,
  ReadoutDetailResponse,
  ReadoutCreateResponse,
  SaveDraftResponse,
  ApprovalEligibilityResponse,
  ApproveResponse,
  ApprovalHistoryResponse,
  GenerationHistoryResponse,
  EligibleEvidenceResponse,
  // Request types
  CreateReadoutRequest,
  SaveDraftRequest,
  ApproveReadoutRequest,
  PaginationParams,
} from './types';

// Query keys
export { readoutsKeys } from './keys';

// Client functions
export {
  listReadouts,
  getReadout,
  createReadout,
  saveDraft,
  checkEligibility,
  approveReadout,
  getApprovalHistory,
  getGenerationHistory,
  getEligibleEvidence,
  getVersionContent,
} from './client';

// Error handling
export type {
  ReadoutErrorCode,
  ReadoutApiError,
  ConcurrencyConflictError,
  ApprovalIneligibleError,
  // Finality errors (DR-6b-5e)
  ReadoutFinalizedError,
  GenerationInProgressError,
} from './errors';

export {
  parseReadoutError,
  isConcurrencyError,
  isApprovalIneligibleError,
  isNotFoundError,
  isAuthorizationError,
  isValidationError,
  // Finality error guards (DR-6b-5e)
  isReadoutFinalizedError,
  isGenerationInProgressError,
} from './errors';

// Query hooks
export {
  useReadoutsList,
  useReadoutDetail,
  useApprovalEligibility,
  useApprovalHistory,
  useGenerationHistory,
  useEligibleEvidence,
  useGenerationStatus,
  useVersionContent,
} from './hooks';

// Mutation hooks
export {
  useCreateReadout,
  useSaveDraft,
  useApproveReadout,
  useInitiateGeneration,
} from './hooks';

// Utility functions
export { isTerminalGenerationStatus } from './hooks';
