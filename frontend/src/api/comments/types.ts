/**
 * Comments Error Types — CMT-5
 *
 * Typed error states for Comments mutations.
 * Allows UI to distinguish error types and handle conflicts appropriately.
 */

import type { ApiError } from '@qori/api-contracts';

/**
 * Known error codes from the Comments API.
 */
export type CommentErrorCode =
  | 'AUTHENTICATION_REQUIRED'
  | 'AUTHORIZATION_DENIED'
  | 'VALIDATION_ERROR'
  | 'RESOURCE_NOT_FOUND'
  | 'COMMENT_EDIT_CONFLICT'
  | 'INVALID_STATE'
  | 'UNKNOWN';

/**
 * Structured error from Comments API operations.
 */
export interface CommentApiError {
  code: CommentErrorCode;
  message: string;
  details?: Record<string, string>;
  /** HTTP status code */
  status: number;
}

/**
 * Edit conflict error with additional context.
 * Allows UI to show conflict resolution.
 */
export interface EditConflictError extends CommentApiError {
  code: 'COMMENT_EDIT_CONFLICT';
  /** The body the user attempted to submit */
  submittedBody: string;
  /** The message ID that had a conflict */
  messageId: string;
}

/**
 * Check if an error is an edit conflict.
 */
export function isEditConflictError(
  error: CommentApiError,
): error is EditConflictError {
  return error.code === 'COMMENT_EDIT_CONFLICT';
}

/**
 * Parse an API error response into a structured CommentApiError.
 */
export async function parseCommentError(
  error: unknown,
  context?: { submittedBody?: string; messageId?: string },
): Promise<CommentApiError> {
  // Default error
  const defaultError: CommentApiError = {
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
      const body = (await httpError.response.json()) as ApiError;
      const code = mapErrorCode(body.error?.code, status);

      // Handle edit conflict specially
      if (code === 'COMMENT_EDIT_CONFLICT' && context?.submittedBody && context?.messageId) {
        return {
          code: 'COMMENT_EDIT_CONFLICT',
          message: body.error?.message || 'Message was modified by another user',
          details: body.error?.details,
          status,
          submittedBody: context.submittedBody,
          messageId: context.messageId,
        } as EditConflictError;
      }

      return {
        code,
        message: body.error?.message || defaultError.message,
        details: body.error?.details,
        status,
      };
    } catch {
      return {
        code: mapErrorCode(undefined, status),
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
 * Map backend error codes to typed enum values.
 */
function mapErrorCode(code: string | undefined, status: number): CommentErrorCode {
  if (code) {
    switch (code) {
      case 'AUTHENTICATION_REQUIRED':
        return 'AUTHENTICATION_REQUIRED';
      case 'AUTHORIZATION_DENIED':
        return 'AUTHORIZATION_DENIED';
      case 'VALIDATION_ERROR':
        return 'VALIDATION_ERROR';
      case 'RESOURCE_NOT_FOUND':
        return 'RESOURCE_NOT_FOUND';
      case 'COMMENT_EDIT_CONFLICT':
        return 'COMMENT_EDIT_CONFLICT';
      case 'INVALID_STATE':
        return 'INVALID_STATE';
      default:
        return 'UNKNOWN';
    }
  }

  // Fallback based on status code
  switch (status) {
    case 401:
      return 'AUTHENTICATION_REQUIRED';
    case 403:
      return 'AUTHORIZATION_DENIED';
    case 404:
      return 'RESOURCE_NOT_FOUND';
    case 409:
      return 'COMMENT_EDIT_CONFLICT';
    default:
      return 'UNKNOWN';
  }
}
