/**
 * Coach Retryability Unit Tests — Coach M3C-A
 *
 * Tests for the isRunRetryable function that determines whether
 * a coaching run can be retried by the researcher.
 *
 * Retryability semantics:
 * - status === 'failed'
 * - AND (review_scope === 'artifact' OR section key resolves deterministically)
 */

import { isRunRetryable } from '../../application/coaching.app-service';

describe('isRunRetryable', () => {
  describe('failed artifact runs', () => {
    it('returns true for failed artifact run', () => {
      expect(isRunRetryable('failed', 'artifact', 'plan', null)).toBe(true);
    });

    it('returns true for failed brief artifact run', () => {
      expect(isRunRetryable('failed', 'artifact', 'brief', null)).toBe(true);
    });
  });

  describe('failed section runs with canonical keys', () => {
    it('returns true for canonical plan_background', () => {
      expect(isRunRetryable('failed', 'section', 'plan', 'plan_background')).toBe(true);
    });

    it('returns true for canonical plan_summary', () => {
      expect(isRunRetryable('failed', 'section', 'plan', 'plan_summary')).toBe(true);
    });

    it('returns true for canonical plan_method_approach', () => {
      expect(isRunRetryable('failed', 'section', 'plan', 'plan_method_approach')).toBe(true);
    });

    it('returns true for canonical plan_participants_prose', () => {
      expect(isRunRetryable('failed', 'section', 'plan', 'plan_participants_prose')).toBe(true);
    });

    it('returns true for canonical plan_deliverables', () => {
      expect(isRunRetryable('failed', 'section', 'plan', 'plan_deliverables')).toBe(true);
    });

    it('returns true for canonical plan_risks', () => {
      expect(isRunRetryable('failed', 'section', 'plan', 'plan_risks')).toBe(true);
    });

    it('returns true for canonical plan_commitments', () => {
      expect(isRunRetryable('failed', 'section', 'plan', 'plan_commitments')).toBe(true);
    });
  });

  describe('failed section runs with known legacy keys', () => {
    it('returns true for legacy background -> plan_background', () => {
      expect(isRunRetryable('failed', 'section', 'plan', 'background')).toBe(true);
    });

    it('returns true for legacy summary -> plan_summary', () => {
      expect(isRunRetryable('failed', 'section', 'plan', 'summary')).toBe(true);
    });

    it('returns true for legacy method -> plan_method_approach', () => {
      expect(isRunRetryable('failed', 'section', 'plan', 'method')).toBe(true);
    });

    it('returns true for legacy participants -> plan_participants_prose', () => {
      expect(isRunRetryable('failed', 'section', 'plan', 'participants')).toBe(true);
    });
  });

  describe('failed section runs with malformed/unknown keys', () => {
    it('returns false for malformed key "section"', () => {
      expect(isRunRetryable('failed', 'section', 'plan', 'section')).toBe(false);
    });

    it('returns false for unknown key "mystery_key"', () => {
      expect(isRunRetryable('failed', 'section', 'plan', 'mystery_key')).toBe(false);
    });

    it('returns false for completely_unknown_section', () => {
      expect(isRunRetryable('failed', 'section', 'plan', 'completely_unknown_section')).toBe(false);
    });

    it('returns false for empty string section key', () => {
      expect(isRunRetryable('failed', 'section', 'plan', '')).toBe(false);
    });

    it('returns false for section scope with null key', () => {
      expect(isRunRetryable('failed', 'section', 'plan', null)).toBe(false);
    });
  });

  describe('non-failed runs', () => {
    it('returns false for completed artifact run', () => {
      expect(isRunRetryable('completed', 'artifact', 'plan', null)).toBe(false);
    });

    it('returns false for completed section run', () => {
      expect(isRunRetryable('completed', 'section', 'plan', 'plan_background')).toBe(false);
    });

    it('returns false for pending artifact run', () => {
      expect(isRunRetryable('pending', 'artifact', 'plan', null)).toBe(false);
    });

    it('returns false for pending section run', () => {
      expect(isRunRetryable('pending', 'section', 'plan', 'plan_background')).toBe(false);
    });

    it('returns false for running artifact run', () => {
      expect(isRunRetryable('running', 'artifact', 'plan', null)).toBe(false);
    });

    it('returns false for running section run', () => {
      expect(isRunRetryable('running', 'section', 'plan', 'plan_background')).toBe(false);
    });
  });
});
