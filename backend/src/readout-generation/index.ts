/**
 * Readout Generation Module — DR-6b-5b
 *
 * Background AI generation for Desk Research Readouts.
 *
 * Exports:
 * - Poller lifecycle functions
 * - Executor for direct invocation (testing)
 * - Validator for output validation
 */

export {
  startReadoutGenerationPoller,
  stopReadoutGenerationPoller,
  getPollerStatus,
  isPollerHealthy,
  getPollerConfig,
} from './poller';

export {
  executeGeneration,
  getGenerationModelInfo,
  type ExecutionResult,
  type ExecutionFailure,
  type FailureCategory,
} from '../services/readout-generation-executor.service';

export {
  validateGeneratedOutput,
  parseGeneratedJson,
  ErrorCodes,
  type ValidationResult,
  type ValidationError,
} from '../services/readout-generation-validator.service';
