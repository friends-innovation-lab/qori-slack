/**
 * Readout Error Types — DR-6b-4a
 *
 * Typed error handling for 409 draft conflicts and 422 approval errors.
 * Matches actual backend error shapes from desk-readouts.routes.ts.
 *
 * Error codes verified against:
 * - handleServiceError function (lines 227-267)
 * - 409 conflict response (lines 420-431)
 * - 422 approval ineligible response (lines 256-265)
 */

import type { DraftContent } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// ERROR CODES
// ═══════════════════════════════════════════════════════════════════════════

export type ReadoutErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'AUTHORIZATION_DENIED'
  | 'AUTHENTICATION_REQUIRED'
  | 'CONCURRENCY_ERROR'
  | 'APPROVAL_INELIGIBLE'
  | 'IDEMPOTENCY_CONFLICT'
  | 'EVIDENCE_SELECTION_ERROR'
  | 'READOUT_FINALIZED'
  | 'GENERATION_IN_PROGRESS'
  | 'UNKNOWN';

// ═══════════════════════════════════════════════════════════════════════════
// BASE ERROR
// ═══════════════════════════════════════════════════════════════════════════

export interface ReadoutApiError {
  code: ReadoutErrorCode;
  message: string;
  status: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONCURRENCY ERROR (409)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Draft save conflict with recovery data.
 * Returned when expectedVersion doesn't match current content_version.
 *
 * Backend shape (desk-readouts.routes.ts:420-431):
 * {
 *   error: {
 *     code: 'CONCURRENCY_ERROR',
 *     message: 'Draft was modified by another user',
 *     currentVersion: number,
 *     submittedContent: DraftContent
 *   }
 * }
 */
export interface ConcurrencyConflictError extends ReadoutApiError {
  code: 'CONCURRENCY_ERROR';
  status: 409;
  /** Current version in database */
  currentVersion: number;
  /** Content user attempted to save (for recovery) */
  submittedContent: DraftContent;
}

// ═══════════════════════════════════════════════════════════════════════════
// APPROVAL ERROR (422)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Approval ineligibility with blocking errors.
 * Returned when readout fails validation checks.
 *
 * Backend shape (desk-readouts.routes.ts:256-265):
 * {
 *   error: {
 *     code: 'APPROVAL_INELIGIBLE',
 *     message: string,
 *     errors: string[]
 *   }
 * }
 */
export interface ApprovalIneligibleError extends ReadoutApiError {
  code: 'APPROVAL_INELIGIBLE';
  status: 422;
  /** List of blocking validation errors */
  errors: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERATION ERRORS (DR-6b-5d-A)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Idempotency conflict (409).
 * Returned when same idempotencyKey is used with different selectedRevisionIds.
 *
 * Backend shape:
 * {
 *   error: {
 *     code: 'IDEMPOTENCY_CONFLICT',
 *     message: 'Idempotency key used with different payload'
 *   }
 * }
 */
export interface IdempotencyConflictError extends ReadoutApiError {
  code: 'IDEMPOTENCY_CONFLICT';
  status: 409;
}

/**
 * Evidence selection error (422).
 * Returned when selected revisions are invalid (non-existent, not accepted, withdrawn).
 *
 * Backend shape:
 * {
 *   error: {
 *     code: 'EVIDENCE_SELECTION_ERROR',
 *     message: string,
 *     invalidRevisionIds: string[]
 *   }
 * }
 */
export interface EvidenceSelectionError extends ReadoutApiError {
  code: 'EVIDENCE_SELECTION_ERROR';
  status: 422;
  /** Revision IDs that failed validation */
  invalidRevisionIds: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// FINALITY ERRORS (DR-6b-5e)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Readout finalized error (422).
 * Returned when generation is requested on an already-approved readout.
 * Approved readouts are final — generation is no longer permitted.
 *
 * Backend shape (desk-readouts.routes.ts):
 * {
 *   error: {
 *     code: 'READOUT_FINALIZED',
 *     message: 'Readout has been approved and cannot be regenerated'
 *   }
 * }
 */
export interface ReadoutFinalizedError extends ReadoutApiError {
  code: 'READOUT_FINALIZED';
  status: 422;
}

/**
 * Generation in progress error (409).
 * Returned when approval is requested while generation is active.
 * Prevents race between approval and active generation.
 *
 * Backend shape (desk-readouts.routes.ts):
 * {
 *   error: {
 *     code: 'GENERATION_IN_PROGRESS',
 *     message: 'Approval cannot proceed while generation is in progress',
 *     generationRequestId: string
 *   }
 * }
 */
export interface GenerationInProgressError extends ReadoutApiError {
  code: 'GENERATION_IN_PROGRESS';
  status: 409;
  /** The active generation request blocking approval */
  generationRequestId: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Type guard for recoverable concurrency errors.
 * Returns true only when ALL recovery data is valid:
 * - currentVersion is a nonnegative integer
 * - submittedContent is a non-null, non-array object
 */
export function isConcurrencyError(
  error: ReadoutApiError,
): error is ConcurrencyConflictError {
  if (error.code !== 'CONCURRENCY_ERROR' || error.status !== 409) {
    return false;
  }
  if (!('currentVersion' in error) || !('submittedContent' in error)) {
    return false;
  }
  const typed = error as ConcurrencyConflictError;
  // currentVersion must be a nonnegative integer
  if (
    typeof typed.currentVersion !== 'number' ||
    typed.currentVersion < 0 ||
    !Number.isInteger(typed.currentVersion)
  ) {
    return false;
  }
  // submittedContent must be a non-null, non-array object
  if (
    typed.submittedContent === null ||
    typeof typed.submittedContent !== 'object' ||
    Array.isArray(typed.submittedContent)
  ) {
    return false;
  }
  return true;
}

export function isApprovalIneligibleError(
  error: ReadoutApiError,
): error is ApprovalIneligibleError {
  return error.code === 'APPROVAL_INELIGIBLE' && error.status === 422;
}

/**
 * Type guard for idempotency conflict errors.
 * Same idempotency key used with different payload.
 */
export function isIdempotencyConflictError(
  error: ReadoutApiError,
): error is IdempotencyConflictError {
  return error.code === 'IDEMPOTENCY_CONFLICT' && error.status === 409;
}

/**
 * Type guard for evidence selection errors.
 * Returns true when error has invalidRevisionIds array.
 */
export function isEvidenceSelectionError(
  error: ReadoutApiError,
): error is EvidenceSelectionError {
  if (error.code !== 'EVIDENCE_SELECTION_ERROR' || error.status !== 422) {
    return false;
  }
  if (!('invalidRevisionIds' in error)) {
    return false;
  }
  const typed = error as EvidenceSelectionError;
  return Array.isArray(typed.invalidRevisionIds);
}

/**
 * Type guard for readout finalized errors (DR-6b-5e).
 * Approved readouts cannot be regenerated.
 */
export function isReadoutFinalizedError(
  error: ReadoutApiError,
): error is ReadoutFinalizedError {
  return error.code === 'READOUT_FINALIZED' && error.status === 422;
}

/**
 * Type guard for generation-in-progress errors (DR-6b-5e).
 * Returns true when error includes generationRequestId.
 */
export function isGenerationInProgressError(
  error: ReadoutApiError,
): error is GenerationInProgressError {
  if (error.code !== 'GENERATION_IN_PROGRESS' || error.status !== 409) {
    return false;
  }
  if (!('generationRequestId' in error)) {
    return false;
  }
  const typed = error as GenerationInProgressError;
  return typeof typed.generationRequestId === 'string';
}

export function isNotFoundError(error: ReadoutApiError): boolean {
  return error.code === 'NOT_FOUND' && error.status === 404;
}

export function isAuthorizationError(error: ReadoutApiError): boolean {
  return error.code === 'AUTHORIZATION_DENIED' && error.status === 403;
}

export function isValidationError(error: ReadoutApiError): boolean {
  return error.code === 'VALIDATION_ERROR' && error.status === 400;
}

// ═══════════════════════════════════════════════════════════════════════════
// ERROR PARSING
// ═══════════════════════════════════════════════════════════════════════════

interface BackendErrorBody {
  error?: {
    code?: string;
    message?: string;
    currentVersion?: number;
    submittedContent?: DraftContent;
    errors?: string[];
    invalidRevisionIds?: string[];
    generationRequestId?: string; // DR-6b-5e: GENERATION_IN_PROGRESS
  };
}

/**
 * Parse API error response into typed ReadoutApiError.
 * Handles ky HTTPError with JSON body extraction.
 *
 * Defensively parses 409 recovery data - never invents currentVersion
 * or submittedContent if not present in the response.
 */
export async function parseReadoutError(
  error: unknown,
): Promise<ReadoutApiError> {
  const defaultError: ReadoutApiError = {
    code: 'UNKNOWN',
    message: 'An unexpected error occurred',
    status: 500,
  };

  if (!error || typeof error !== 'object') {
    return defaultError;
  }

  // Handle ky HTTPError with response
  if ('response' in error) {
    const httpError = error as { response: Response };
    const status = httpError.response.status;

    try {
      const body = (await httpError.response.json()) as BackendErrorBody;
      const backendCode = body.error?.code;

      // Parse 409 CONCURRENCY_ERROR with recovery data
      if (status === 409 && backendCode === 'CONCURRENCY_ERROR') {
        const currentVersion = body.error?.currentVersion;
        const submittedContent = body.error?.submittedContent;

        // Only classify as recoverable when ALL conditions are met:
        // - currentVersion is a nonnegative integer
        // - submittedContent is a non-null, non-array object
        const hasValidVersion =
          typeof currentVersion === 'number' &&
          currentVersion >= 0 &&
          Number.isInteger(currentVersion);
        const hasValidContent =
          submittedContent !== null &&
          submittedContent !== undefined &&
          typeof submittedContent === 'object' &&
          !Array.isArray(submittedContent);

        if (hasValidVersion && hasValidContent) {
          return {
            code: 'CONCURRENCY_ERROR',
            message: body.error?.message || 'Draft was modified by another user',
            status: 409,
            currentVersion,
            submittedContent,
          } as ConcurrencyConflictError;
        }

        // Recovery data is malformed — return non-recoverable 409
        return {
          code: 'CONCURRENCY_ERROR',
          message:
            body.error?.message ||
            'Draft conflict detected but recovery data is unavailable',
          status: 409,
        };
      }

      // Parse 422 APPROVAL_INELIGIBLE with errors array
      if (status === 422 && backendCode === 'APPROVAL_INELIGIBLE') {
        return {
          code: 'APPROVAL_INELIGIBLE',
          message: body.error?.message || 'Readout is not eligible for approval',
          status: 422,
          errors: Array.isArray(body.error?.errors) ? body.error.errors : [],
        } as ApprovalIneligibleError;
      }

      // Parse 409 IDEMPOTENCY_CONFLICT (generation)
      if (status === 409 && backendCode === 'IDEMPOTENCY_CONFLICT') {
        return {
          code: 'IDEMPOTENCY_CONFLICT',
          message:
            body.error?.message || 'Idempotency key used with different payload',
          status: 409,
        } as IdempotencyConflictError;
      }

      // Parse 422 EVIDENCE_SELECTION_ERROR (generation)
      if (status === 422 && backendCode === 'EVIDENCE_SELECTION_ERROR') {
        return {
          code: 'EVIDENCE_SELECTION_ERROR',
          message: body.error?.message || 'Invalid evidence selection',
          status: 422,
          invalidRevisionIds: Array.isArray(body.error?.invalidRevisionIds)
            ? body.error.invalidRevisionIds
            : [],
        } as EvidenceSelectionError;
      }

      // Parse 422 READOUT_FINALIZED (DR-6b-5e finality)
      if (status === 422 && backendCode === 'READOUT_FINALIZED') {
        return {
          code: 'READOUT_FINALIZED',
          message:
            body.error?.message ||
            'Readout has been approved and cannot be regenerated',
          status: 422,
        } as ReadoutFinalizedError;
      }

      // Parse 409 GENERATION_IN_PROGRESS (DR-6b-5e finality)
      if (status === 409 && backendCode === 'GENERATION_IN_PROGRESS') {
        const generationRequestId = body.error?.generationRequestId;
        return {
          code: 'GENERATION_IN_PROGRESS',
          message:
            body.error?.message ||
            'Approval cannot proceed while generation is in progress',
          status: 409,
          generationRequestId: generationRequestId ?? '',
        } as GenerationInProgressError;
      }

      // Standard error codes
      return {
        code: mapStatusToCode(status, backendCode),
        message: body.error?.message || defaultError.message,
        status,
      };
    } catch {
      return {
        code: mapStatusToCode(status),
        message: `Request failed (${status})`,
        status,
      };
    }
  }

  // Handle generic Error
  if (error instanceof Error) {
    return {
      ...defaultError,
      message: error.message,
    };
  }

  return defaultError;
}

function mapStatusToCode(
  status: number,
  backendCode?: string,
): ReadoutErrorCode {
  // Trust backend code if it's a known code
  if (backendCode) {
    const validCodes: ReadoutErrorCode[] = [
      'NOT_FOUND',
      'VALIDATION_ERROR',
      'AUTHORIZATION_DENIED',
      'AUTHENTICATION_REQUIRED',
      'CONCURRENCY_ERROR',
      'APPROVAL_INELIGIBLE',
      'IDEMPOTENCY_CONFLICT',
      'EVIDENCE_SELECTION_ERROR',
      'READOUT_FINALIZED',
      'GENERATION_IN_PROGRESS',
    ];
    if (validCodes.includes(backendCode as ReadoutErrorCode)) {
      return backendCode as ReadoutErrorCode;
    }
  }

  // Fall back to status code mapping
  switch (status) {
    case 400:
      return 'VALIDATION_ERROR';
    case 401:
      return 'AUTHENTICATION_REQUIRED';
    case 403:
      return 'AUTHORIZATION_DENIED';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONCURRENCY_ERROR';
    case 422:
      return 'APPROVAL_INELIGIBLE';
    default:
      return 'UNKNOWN';
  }
}
