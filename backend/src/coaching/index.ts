/**
 * Coaching Module Exports — Coach M2
 *
 * Public API for Coach execution engine.
 */

// Configuration
export * from './config';

// Provider abstraction
export * from './providers';

// Contracts
export * from './contracts';

// Context resolution
export { resolveContext, ContextResolutionError } from './context-resolver';
export type { ResolvedContext } from './context-resolver';

// Output validation
export { validateCoachOutput, formatValidationErrors, hasAnyItems, countTotalItems } from './output-validator';
export type { ValidatedCoachOutput, CoachOutputItem, ValidationResult } from './output-validator';

// Claim service
export {
  claimNextPendingRun,
  recoverStaleRun,
  updateHeartbeat,
  validateClaimOwnership,
  markCompleted,
  markFailed,
  recordUsage,
  checkUserRateLimit,
  checkStudyRateLimit,
} from './claim-service';
export type { ClaimResult, RateLimitResult } from './claim-service';

// Execution orchestrator
export { executeCoachRun } from './execution-orchestrator';
export type { ExecutionResult } from './execution-orchestrator';

// Poller
export {
  startCoachPoller,
  stopCoachPoller,
  isPollerRunning,
  getCurrentWorkerId,
  getCurrentRunId,
  triggerPollCycle,
  resetPollerState,
} from './poller';
