/**
 * Readouts Error Tests — DR-6b-4a
 *
 * Unit tests for error parsing and type guards.
 * Error shapes derived from backend desk-readouts.routes.ts.
 */

import { describe, it, expect } from 'vitest';
import {
  parseReadoutError,
  isConcurrencyError,
  isApprovalIneligibleError,
  isIdempotencyConflictError,
  isEvidenceSelectionError,
  isNotFoundError,
  isAuthorizationError,
  isValidationError,
} from '../errors';

// ═══════════════════════════════════════════════════════════════════════════
// CONCURRENCY ERROR (409)
// ═══════════════════════════════════════════════════════════════════════════

describe('parseReadoutError - 409 CONCURRENCY_ERROR', () => {
  it('parses 409 with recovery data', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: {
          code: 'CONCURRENCY_ERROR',
          message: 'Draft was modified by another user',
          currentVersion: 3,
          submittedContent: {
            summary: { text: 'My unsaved text', citations: [] },
            findings: [],
          },
        },
      }),
      { status: 409 },
    );

    const error = await parseReadoutError({ response: mockResponse });

    expect(error.code).toBe('CONCURRENCY_ERROR');
    expect(error.status).toBe(409);
    expect(isConcurrencyError(error)).toBe(true);

    if (isConcurrencyError(error)) {
      expect(error.currentVersion).toBe(3);
      expect(error.submittedContent.summary?.text).toBe('My unsaved text');
    }
  });

  it('does not invent currentVersion if missing', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: {
          code: 'CONCURRENCY_ERROR',
          message: 'Draft was modified',
          // No currentVersion provided
        },
      }),
      { status: 409 },
    );

    const error = await parseReadoutError({ response: mockResponse });

    // Should fall through to standard error since currentVersion is required
    expect(error.code).toBe('CONCURRENCY_ERROR');
    expect(error.status).toBe(409);
    // Without currentVersion, shouldn't be typed as ConcurrencyConflictError
    expect(isConcurrencyError(error)).toBe(false);
  });

  it('rejects recovery when submittedContent is missing', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: {
          code: 'CONCURRENCY_ERROR',
          message: 'Draft was modified',
          currentVersion: 5,
          // No submittedContent — do NOT default to {}
        },
      }),
      { status: 409 },
    );

    const error = await parseReadoutError({ response: mockResponse });

    // Status 409 preserved, but not classified as recoverable
    expect(error.code).toBe('CONCURRENCY_ERROR');
    expect(error.status).toBe(409);
    expect(isConcurrencyError(error)).toBe(false);
  });

  it('rejects recovery when submittedContent is null', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: {
          code: 'CONCURRENCY_ERROR',
          message: 'Draft was modified',
          currentVersion: 5,
          submittedContent: null,
        },
      }),
      { status: 409 },
    );

    const error = await parseReadoutError({ response: mockResponse });

    expect(error.code).toBe('CONCURRENCY_ERROR');
    expect(error.status).toBe(409);
    expect(isConcurrencyError(error)).toBe(false);
  });

  it('rejects recovery when submittedContent is an array', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: {
          code: 'CONCURRENCY_ERROR',
          message: 'Draft was modified',
          currentVersion: 5,
          submittedContent: [{ text: 'array item' }],
        },
      }),
      { status: 409 },
    );

    const error = await parseReadoutError({ response: mockResponse });

    expect(error.code).toBe('CONCURRENCY_ERROR');
    expect(error.status).toBe(409);
    expect(isConcurrencyError(error)).toBe(false);
  });

  it('rejects recovery when currentVersion is negative', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: {
          code: 'CONCURRENCY_ERROR',
          message: 'Draft was modified',
          currentVersion: -1,
          submittedContent: { summary: { text: 'Test', citations: [] } },
        },
      }),
      { status: 409 },
    );

    const error = await parseReadoutError({ response: mockResponse });

    expect(error.code).toBe('CONCURRENCY_ERROR');
    expect(error.status).toBe(409);
    expect(isConcurrencyError(error)).toBe(false);
  });

  it('rejects recovery when currentVersion is not an integer', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: {
          code: 'CONCURRENCY_ERROR',
          message: 'Draft was modified',
          currentVersion: 3.5,
          submittedContent: { summary: { text: 'Test', citations: [] } },
        },
      }),
      { status: 409 },
    );

    const error = await parseReadoutError({ response: mockResponse });

    expect(error.code).toBe('CONCURRENCY_ERROR');
    expect(error.status).toBe(409);
    expect(isConcurrencyError(error)).toBe(false);
  });

  it('accepts empty object submittedContent as valid', async () => {
    // Empty DraftContent {} is structurally valid
    const mockResponse = new Response(
      JSON.stringify({
        error: {
          code: 'CONCURRENCY_ERROR',
          message: 'Draft was modified',
          currentVersion: 5,
          submittedContent: {},
        },
      }),
      { status: 409 },
    );

    const error = await parseReadoutError({ response: mockResponse });

    expect(isConcurrencyError(error)).toBe(true);
    if (isConcurrencyError(error)) {
      expect(error.currentVersion).toBe(5);
      expect(error.submittedContent).toEqual({});
    }
  });

  it('preserves backend error message when recovery data is malformed', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: {
          code: 'CONCURRENCY_ERROR',
          message: 'Your changes conflict with recent edits',
          currentVersion: 'not-a-number', // Invalid
          submittedContent: { summary: { text: 'Test', citations: [] } },
        },
      }),
      { status: 409 },
    );

    const error = await parseReadoutError({ response: mockResponse });

    expect(error.status).toBe(409);
    expect(error.code).toBe('CONCURRENCY_ERROR');
    // Backend message is preserved even when recovery fails
    expect(error.message).toBe('Your changes conflict with recent edits');
    // But it's NOT recoverable
    expect(isConcurrencyError(error)).toBe(false);
  });

  it('uses fallback message when backend message is missing and recovery fails', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: {
          code: 'CONCURRENCY_ERROR',
          // No message
          currentVersion: 'invalid',
          submittedContent: null,
        },
      }),
      { status: 409 },
    );

    const error = await parseReadoutError({ response: mockResponse });

    expect(error.status).toBe(409);
    expect(error.message).toContain('recovery data is unavailable');
    expect(isConcurrencyError(error)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// APPROVAL INELIGIBLE ERROR (422)
// ═══════════════════════════════════════════════════════════════════════════

describe('parseReadoutError - 422 APPROVAL_INELIGIBLE', () => {
  it('parses 422 with errors array', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: {
          code: 'APPROVAL_INELIGIBLE',
          message: 'Readout is not eligible for approval',
          errors: [
            'Finding F1 has no citations',
            'Finding F2 not checked',
            'Implication I1 not reviewed',
          ],
        },
      }),
      { status: 422 },
    );

    const error = await parseReadoutError({ response: mockResponse });

    expect(error.code).toBe('APPROVAL_INELIGIBLE');
    expect(error.status).toBe(422);
    expect(isApprovalIneligibleError(error)).toBe(true);

    if (isApprovalIneligibleError(error)) {
      expect(error.errors).toHaveLength(3);
      expect(error.errors[0]).toContain('F1');
      expect(error.errors[2]).toContain('I1');
    }
  });

  it('handles empty errors array', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: {
          code: 'APPROVAL_INELIGIBLE',
          message: 'Not eligible',
          errors: [],
        },
      }),
      { status: 422 },
    );

    const error = await parseReadoutError({ response: mockResponse });

    expect(isApprovalIneligibleError(error)).toBe(true);
    if (isApprovalIneligibleError(error)) {
      expect(error.errors).toEqual([]);
    }
  });

  it('handles missing errors array', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: {
          code: 'APPROVAL_INELIGIBLE',
          message: 'Not eligible',
          // No errors array
        },
      }),
      { status: 422 },
    );

    const error = await parseReadoutError({ response: mockResponse });

    expect(isApprovalIneligibleError(error)).toBe(true);
    if (isApprovalIneligibleError(error)) {
      expect(error.errors).toEqual([]);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// IDEMPOTENCY CONFLICT ERROR (409) — DR-6b-5d-A
// ═══════════════════════════════════════════════════════════════════════════

describe('parseReadoutError - 409 IDEMPOTENCY_CONFLICT', () => {
  it('parses 409 idempotency conflict', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: {
          code: 'IDEMPOTENCY_CONFLICT',
          message: 'Idempotency key used with different payload',
        },
      }),
      { status: 409 },
    );

    const error = await parseReadoutError({ response: mockResponse });

    expect(error.code).toBe('IDEMPOTENCY_CONFLICT');
    expect(error.status).toBe(409);
    expect(isIdempotencyConflictError(error)).toBe(true);
    expect(error.message).toBe('Idempotency key used with different payload');
  });

  it('uses default message when not provided', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: {
          code: 'IDEMPOTENCY_CONFLICT',
        },
      }),
      { status: 409 },
    );

    const error = await parseReadoutError({ response: mockResponse });

    expect(isIdempotencyConflictError(error)).toBe(true);
    expect(error.message).toBe('Idempotency key used with different payload');
  });

  it('distinguishes from CONCURRENCY_ERROR', async () => {
    const idempotencyResponse = new Response(
      JSON.stringify({
        error: { code: 'IDEMPOTENCY_CONFLICT', message: 'Key conflict' },
      }),
      { status: 409 },
    );
    const concurrencyResponse = new Response(
      JSON.stringify({
        error: {
          code: 'CONCURRENCY_ERROR',
          message: 'Version conflict',
          currentVersion: 5,
          submittedContent: {},
        },
      }),
      { status: 409 },
    );

    const idempotencyError = await parseReadoutError({
      response: idempotencyResponse,
    });
    const concurrencyError = await parseReadoutError({
      response: concurrencyResponse,
    });

    expect(isIdempotencyConflictError(idempotencyError)).toBe(true);
    expect(isConcurrencyError(idempotencyError)).toBe(false);

    expect(isConcurrencyError(concurrencyError)).toBe(true);
    expect(isIdempotencyConflictError(concurrencyError)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EVIDENCE SELECTION ERROR (422) — DR-6b-5d-A
// ═══════════════════════════════════════════════════════════════════════════

describe('parseReadoutError - 422 EVIDENCE_SELECTION_ERROR', () => {
  it('parses 422 with invalidRevisionIds', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: {
          code: 'EVIDENCE_SELECTION_ERROR',
          message: 'Some selected revisions are invalid',
          invalidRevisionIds: ['rev-001', 'rev-003'],
        },
      }),
      { status: 422 },
    );

    const error = await parseReadoutError({ response: mockResponse });

    expect(error.code).toBe('EVIDENCE_SELECTION_ERROR');
    expect(error.status).toBe(422);
    expect(isEvidenceSelectionError(error)).toBe(true);

    if (isEvidenceSelectionError(error)) {
      expect(error.invalidRevisionIds).toHaveLength(2);
      expect(error.invalidRevisionIds).toContain('rev-001');
      expect(error.invalidRevisionIds).toContain('rev-003');
    }
  });

  it('handles empty invalidRevisionIds array', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: {
          code: 'EVIDENCE_SELECTION_ERROR',
          message: 'Invalid selection',
          invalidRevisionIds: [],
        },
      }),
      { status: 422 },
    );

    const error = await parseReadoutError({ response: mockResponse });

    expect(isEvidenceSelectionError(error)).toBe(true);
    if (isEvidenceSelectionError(error)) {
      expect(error.invalidRevisionIds).toEqual([]);
    }
  });

  it('handles missing invalidRevisionIds array', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: {
          code: 'EVIDENCE_SELECTION_ERROR',
          message: 'Invalid selection',
          // No invalidRevisionIds
        },
      }),
      { status: 422 },
    );

    const error = await parseReadoutError({ response: mockResponse });

    // Should still be parsed as EVIDENCE_SELECTION_ERROR but with empty array
    expect(error.code).toBe('EVIDENCE_SELECTION_ERROR');
    if (isEvidenceSelectionError(error)) {
      expect(error.invalidRevisionIds).toEqual([]);
    }
  });

  it('uses default message when not provided', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: {
          code: 'EVIDENCE_SELECTION_ERROR',
          invalidRevisionIds: ['rev-001'],
        },
      }),
      { status: 422 },
    );

    const error = await parseReadoutError({ response: mockResponse });

    expect(error.message).toBe('Invalid evidence selection');
  });

  it('distinguishes from APPROVAL_INELIGIBLE', async () => {
    const evidenceResponse = new Response(
      JSON.stringify({
        error: {
          code: 'EVIDENCE_SELECTION_ERROR',
          message: 'Bad revisions',
          invalidRevisionIds: ['rev-001'],
        },
      }),
      { status: 422 },
    );
    const approvalResponse = new Response(
      JSON.stringify({
        error: {
          code: 'APPROVAL_INELIGIBLE',
          message: 'Not eligible',
          errors: ['Missing citations'],
        },
      }),
      { status: 422 },
    );

    const evidenceError = await parseReadoutError({ response: evidenceResponse });
    const approvalError = await parseReadoutError({ response: approvalResponse });

    expect(isEvidenceSelectionError(evidenceError)).toBe(true);
    expect(isApprovalIneligibleError(evidenceError)).toBe(false);

    expect(isApprovalIneligibleError(approvalError)).toBe(true);
    expect(isEvidenceSelectionError(approvalError)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// STANDARD ERRORS (400, 403, 404)
// ═══════════════════════════════════════════════════════════════════════════

describe('parseReadoutError - standard errors', () => {
  it('parses 404 NOT_FOUND', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: { code: 'NOT_FOUND', message: 'Readout not found' },
      }),
      { status: 404 },
    );

    const error = await parseReadoutError({ response: mockResponse });

    expect(error.code).toBe('NOT_FOUND');
    expect(error.status).toBe(404);
    expect(isNotFoundError(error)).toBe(true);
  });

  it('parses 403 AUTHORIZATION_DENIED', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: { code: 'AUTHORIZATION_DENIED', message: 'Access denied' },
      }),
      { status: 403 },
    );

    const error = await parseReadoutError({ response: mockResponse });

    expect(error.code).toBe('AUTHORIZATION_DENIED');
    expect(error.status).toBe(403);
    expect(isAuthorizationError(error)).toBe(true);
  });

  it('parses 400 VALIDATION_ERROR', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: { code: 'VALIDATION_ERROR', message: 'title is required' },
      }),
      { status: 400 },
    );

    const error = await parseReadoutError({ response: mockResponse });

    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.status).toBe(400);
    expect(isValidationError(error)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════

describe('parseReadoutError - edge cases', () => {
  it('handles non-JSON response', async () => {
    const mockResponse = new Response('Internal Server Error', { status: 500 });

    const error = await parseReadoutError({ response: mockResponse });

    expect(error.code).toBe('UNKNOWN');
    expect(error.status).toBe(500);
    expect(error.message).toBe('Request failed (500)');
  });

  it('handles generic Error', async () => {
    const error = await parseReadoutError(new Error('Network failed'));

    expect(error.code).toBe('UNKNOWN');
    expect(error.status).toBe(500);
    expect(error.message).toBe('Network failed');
  });

  it('handles null input', async () => {
    const error = await parseReadoutError(null);

    expect(error.code).toBe('UNKNOWN');
    expect(error.status).toBe(500);
  });

  it('handles undefined input', async () => {
    const error = await parseReadoutError(undefined);

    expect(error.code).toBe('UNKNOWN');
    expect(error.status).toBe(500);
  });

  it('handles empty object', async () => {
    const error = await parseReadoutError({});

    expect(error.code).toBe('UNKNOWN');
    expect(error.status).toBe(500);
  });

  it('handles missing error.code with status fallback', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: { message: 'Something went wrong' },
      }),
      { status: 403 },
    );

    const error = await parseReadoutError({ response: mockResponse });

    expect(error.code).toBe('AUTHORIZATION_DENIED');
    expect(error.status).toBe(403);
    expect(error.message).toBe('Something went wrong');
  });

  it('handles unknown backend code', async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: { code: 'SOME_UNKNOWN_CODE', message: 'Unknown error' },
      }),
      { status: 418 },
    );

    const error = await parseReadoutError({ response: mockResponse });

    expect(error.code).toBe('UNKNOWN');
    expect(error.status).toBe(418);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TYPE GUARDS
// ═══════════════════════════════════════════════════════════════════════════

describe('type guards', () => {
  it('isConcurrencyError returns false for non-409 errors', () => {
    const error = { code: 'CONCURRENCY_ERROR' as const, message: '', status: 400 };
    expect(isConcurrencyError(error)).toBe(false);
  });

  it('isConcurrencyError returns false when currentVersion is missing', () => {
    const error = {
      code: 'CONCURRENCY_ERROR' as const,
      message: '',
      status: 409,
      submittedContent: { summary: { text: 'test', citations: [] } },
    };
    expect(isConcurrencyError(error)).toBe(false);
  });

  it('isConcurrencyError returns false when submittedContent is missing', () => {
    const error = {
      code: 'CONCURRENCY_ERROR' as const,
      message: '',
      status: 409,
      currentVersion: 5,
    };
    expect(isConcurrencyError(error)).toBe(false);
  });

  it('isConcurrencyError returns false when submittedContent is null', () => {
    const error = {
      code: 'CONCURRENCY_ERROR' as const,
      message: '',
      status: 409,
      currentVersion: 5,
      submittedContent: null,
    };
    expect(isConcurrencyError(error as any)).toBe(false);
  });

  it('isConcurrencyError returns false when submittedContent is array', () => {
    const error = {
      code: 'CONCURRENCY_ERROR' as const,
      message: '',
      status: 409,
      currentVersion: 5,
      submittedContent: [],
    };
    expect(isConcurrencyError(error as any)).toBe(false);
  });

  it('isConcurrencyError returns false when currentVersion is negative', () => {
    const error = {
      code: 'CONCURRENCY_ERROR' as const,
      message: '',
      status: 409,
      currentVersion: -1,
      submittedContent: {},
    };
    expect(isConcurrencyError(error as any)).toBe(false);
  });

  it('isConcurrencyError returns false when currentVersion is not integer', () => {
    const error = {
      code: 'CONCURRENCY_ERROR' as const,
      message: '',
      status: 409,
      currentVersion: 2.5,
      submittedContent: {},
    };
    expect(isConcurrencyError(error as any)).toBe(false);
  });

  it('isConcurrencyError returns true only with valid recovery data', () => {
    const error = {
      code: 'CONCURRENCY_ERROR' as const,
      message: '',
      status: 409,
      currentVersion: 5,
      submittedContent: { summary: { text: 'test', citations: [] } },
    };
    expect(isConcurrencyError(error as any)).toBe(true);
  });

  it('isApprovalIneligibleError returns false for non-422 errors', () => {
    const error = { code: 'APPROVAL_INELIGIBLE' as const, message: '', status: 400 };
    expect(isApprovalIneligibleError(error)).toBe(false);
  });

  it('isNotFoundError checks both code and status', () => {
    expect(isNotFoundError({ code: 'NOT_FOUND', message: '', status: 404 })).toBe(true);
    expect(isNotFoundError({ code: 'NOT_FOUND', message: '', status: 400 })).toBe(false);
    expect(isNotFoundError({ code: 'UNKNOWN', message: '', status: 404 })).toBe(false);
  });

  // DR-6b-5d-A type guards
  it('isIdempotencyConflictError checks both code and status', () => {
    expect(
      isIdempotencyConflictError({
        code: 'IDEMPOTENCY_CONFLICT',
        message: '',
        status: 409,
      }),
    ).toBe(true);
    expect(
      isIdempotencyConflictError({
        code: 'IDEMPOTENCY_CONFLICT',
        message: '',
        status: 400,
      }),
    ).toBe(false);
    expect(
      isIdempotencyConflictError({
        code: 'CONCURRENCY_ERROR',
        message: '',
        status: 409,
      }),
    ).toBe(false);
  });

  it('isEvidenceSelectionError checks code, status, and invalidRevisionIds', () => {
    // Valid case
    expect(
      isEvidenceSelectionError({
        code: 'EVIDENCE_SELECTION_ERROR',
        message: '',
        status: 422,
        invalidRevisionIds: ['rev-001'],
      } as any),
    ).toBe(true);

    // Missing invalidRevisionIds
    expect(
      isEvidenceSelectionError({
        code: 'EVIDENCE_SELECTION_ERROR',
        message: '',
        status: 422,
      }),
    ).toBe(false);

    // Wrong status
    expect(
      isEvidenceSelectionError({
        code: 'EVIDENCE_SELECTION_ERROR',
        message: '',
        status: 400,
        invalidRevisionIds: [],
      } as any),
    ).toBe(false);

    // Wrong code
    expect(
      isEvidenceSelectionError({
        code: 'APPROVAL_INELIGIBLE',
        message: '',
        status: 422,
        invalidRevisionIds: [],
      } as any),
    ).toBe(false);

    // Non-array invalidRevisionIds
    expect(
      isEvidenceSelectionError({
        code: 'EVIDENCE_SELECTION_ERROR',
        message: '',
        status: 422,
        invalidRevisionIds: 'not-an-array',
      } as any),
    ).toBe(false);
  });

  it('isEvidenceSelectionError accepts empty array', () => {
    expect(
      isEvidenceSelectionError({
        code: 'EVIDENCE_SELECTION_ERROR',
        message: '',
        status: 422,
        invalidRevisionIds: [],
      } as any),
    ).toBe(true);
  });
});
