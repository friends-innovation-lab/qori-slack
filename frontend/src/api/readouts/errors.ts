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
