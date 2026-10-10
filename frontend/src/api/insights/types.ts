/**
 * Insights Error Types — DR-4b
 *
 * Typed error states for Insights mutations.
 * Supports DR10a conflict and DR10b permission UI states.
 */

import type { InsightErrorCode, InsightErrorResponse } from '@qori/api-contracts';

/**
 * Structured error from Insights API operations.
 */
export interface InsightApiError {
  code: InsightErrorCode | 'UNKNOWN';
  message: string;
  /** HTTP status code */
  status: number;
  /** Current version for CONCURRENCY_ERROR (409) */
  currentVersion?: number;
}

/**
 * Concurrency conflict error with version info.
 * Allows UI to show conflict resolution.
 */
export interface ConcurrencyConflictError extends InsightApiError {
  code: 'CONCURRENCY_ERROR';
  currentVersion: number;
}

/**
 * Check if an error is a concurrency conflict.
 */
export function isConcurrencyError(
  error: InsightApiError,
): error is ConcurrencyConflictError {
  return error.code === 'CONCURRENCY_ERROR';
}

/**
 * Check if an error is an authorization error (403).
 */
export function isAuthorizationError(error: InsightApiError): boolean {
  return error.code === 'AUTHORIZATION_ERROR' || error.code === 'PROJECT_ACCESS_ERROR';
}

/**
 * Check if an error is a validation error (422).
 */
export function isValidationError(error: InsightApiError): boolean {
  return error.code === 'VALIDATION_ERROR';
}

/**
 * Check if an error is a not found error (404).
 */
export function isNotFoundError(error: InsightApiError): boolean {
  return error.code === 'NOT_FOUND';
}

/**
 * Parse an API error response into a structured InsightApiError.
 */
export async function parseInsightError(
  error: unknown,
): Promise<InsightApiError> {
  // Default error
  const defaultError: InsightApiError = {
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
      const body = (await httpError.response.json()) as InsightErrorResponse;
      const code = body.error?.code ?? mapStatusToCode(status);

      return {
        code,
        message: body.error?.message || defaultError.message,
        status,
        currentVersion: body.error?.currentVersion,
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

/**
 * Map HTTP status codes to error codes.
 */
function mapStatusToCode(status: number): InsightErrorCode | 'UNKNOWN' {
  switch (status) {
    case 400:
    case 422:
      return 'VALIDATION_ERROR';
    case 403:
      return 'AUTHORIZATION_ERROR';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONCURRENCY_ERROR';
    default:
      return 'UNKNOWN';
  }
}
