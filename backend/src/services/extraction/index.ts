/**
 * Extraction Module — DISC-WEB-1
 *
 * Server-side document extraction with subprocess isolation.
 */

// Core extraction
export {
  extractWithIsolation,
  computeFileHash,
  getConcurrencyStatus,
  ExtractionOverloadError,
  EXTRACTION_LIMITS,
  type ExtractionResult,
  type ExtractionError,
  type ExtractionOutcome,
} from './extraction.service';

// Error codes
export type { ExtractionErrorCode } from './extraction-worker';

// Staging lifecycle
export {
  createStagingRow,
  createFailedStagingRow,
  validateRefToken,
  validateAndConsumeRefs,
  getStagingByRefToken,
  markExpiredRefs,
  deleteOldTerminalRefs,
  getStagingStats,
  runCleanupJob,
  // DISC-WEB-1B-2b: Split validation/consumption for atomic run creation
  validateRefsForConsumption,
  consumeValidatedRefs,
  type RefValidationResult,
  type ConsumeRefsResult,
  type ValidatedStagingRefs,
  type ValidationResult,
} from './extraction-staging.service';

// Streaming multipart parser
export {
  parseMultipart,
  AggregateLimitError,
  FileLimitError,
  MULTIPART_LIMITS,
  type ParsedFile,
  type RejectedFile,
  type ParseResult,
} from './streaming-multipart';
