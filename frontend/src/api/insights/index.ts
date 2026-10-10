/**
 * Insights API Module — DR-4b
 *
 * Public exports for Desk Research Insights API integration.
 * Re-exports types from @qori/api-contracts for convenience.
 */

// Query key factory
export { insightsKeys } from './keys';

// Query hooks
export {
  useInsights,
  useInsight,
  useInsightRevisions,
  useInsightReviews,
  useNeedsReviewCount,
} from './queries';

// Mutation hooks
export {
  useCreateInsight,
  useCreateRevision,
  useReviewInsight,
  type CreateInsightInput,
  type CreateRevisionInput,
  type ReviewInsightInput,
} from './mutations';

// Error types and utilities
export {
  type InsightApiError,
  type ConcurrencyConflictError,
  isConcurrencyError,
  isAuthorizationError,
  isValidationError,
  isNotFoundError,
  parseInsightError,
} from './types';

// Re-export contract types for convenience
export type {
  InsightSummary,
  InsightDetail,
  InsightStatus,
  InsightListFilters,
  InsightsListResponse,
  InsightDetailResponse,
  RevisionDetail,
  RevisionOrigin,
  RevisionContent,
  ReviewRecord,
  ReviewAction,
  EvidenceReference,
  EvidenceLocator,
  NeedsReviewCountResponse,
  RevisionsListResponse,
  ReviewsListResponse,
  CreateInsightRequest,
  CreateRevisionRequest,
  CreateReviewRequest,
  InsightErrorCode,
  InsightErrorResponse,
} from '@qori/api-contracts';
