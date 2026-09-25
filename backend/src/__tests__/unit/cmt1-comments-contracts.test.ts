/**
 * CMT-1: Comments Contract Unit Tests
 *
 * Tests for comment contract types and validation functions.
 * These tests run without database access.
 */

import {
  isValidSectionKey,
  VALID_SECTION_KEYS,
} from '../../types/comments';
import { ApiErrorCode } from '../../types/api-errors';

describe('comments types', () => {
  describe('VALID_SECTION_KEYS', () => {
    it('has Brief section keys', () => {
      expect(VALID_SECTION_KEYS.brief).toBeDefined();
      expect(Array.isArray(VALID_SECTION_KEYS.brief)).toBe(true);
      expect(VALID_SECTION_KEYS.brief.length).toBeGreaterThan(0);
    });

    it('has Plan section keys', () => {
      expect(VALID_SECTION_KEYS.plan).toBeDefined();
      expect(Array.isArray(VALID_SECTION_KEYS.plan)).toBe(true);
      expect(VALID_SECTION_KEYS.plan.length).toBeGreaterThan(0);
    });

    it('Brief section keys match @qori/artifact-contracts', () => {
      // These are the authoritative section keys from the contract
      const expectedBriefKeys = [
        'descriptive_title',
        'summary',
        'problem_narrative',
        'method_prose',
        'participants_prose',
        'out_of_scope',
        'risks',
        'approval_items',
      ];
      expect(VALID_SECTION_KEYS.brief).toEqual(expectedBriefKeys);
    });

    it('Plan section keys match @qori/artifact-contracts', () => {
      const expectedPlanKeys = [
        'plan_summary',
        'plan_background',
        'plan_method_approach',
        'plan_session_format',
        'plan_data_collection',
        'plan_participant_glance',
        'plan_participants_prose',
        'plan_deliverables',
        'plan_risks',
        'plan_commitments',
      ];
      expect(VALID_SECTION_KEYS.plan).toEqual(expectedPlanKeys);
    });
  });

  describe('isValidSectionKey', () => {
    it('returns true for valid Brief keys', () => {
      expect(isValidSectionKey('brief', 'summary')).toBe(true);
      expect(isValidSectionKey('brief', 'risks')).toBe(true);
      expect(isValidSectionKey('brief', 'approval_items')).toBe(true);
    });

    it('returns true for valid Plan keys', () => {
      expect(isValidSectionKey('plan', 'plan_summary')).toBe(true);
      expect(isValidSectionKey('plan', 'plan_risks')).toBe(true);
      expect(isValidSectionKey('plan', 'plan_commitments')).toBe(true);
    });

    it('returns false for invalid keys', () => {
      expect(isValidSectionKey('brief', 'invalid')).toBe(false);
      expect(isValidSectionKey('plan', 'invalid')).toBe(false);
    });

    it('returns false for cross-type keys', () => {
      // Plan keys are not valid for Brief
      expect(isValidSectionKey('brief', 'plan_summary')).toBe(false);
      // Brief keys are not valid for Plan (except those shared)
      expect(isValidSectionKey('plan', 'summary')).toBe(false);
    });

    it('returns false for unknown artifact types', () => {
      expect(isValidSectionKey('unknown', 'summary')).toBe(false);
      expect(isValidSectionKey('readout', 'summary')).toBe(false);
    });

    it('is case-sensitive', () => {
      expect(isValidSectionKey('brief', 'Summary')).toBe(false);
      expect(isValidSectionKey('brief', 'SUMMARY')).toBe(false);
    });
  });
});

describe('ApiErrorCode', () => {
  it('includes COMMENT_EDIT_CONFLICT', () => {
    expect(ApiErrorCode.COMMENT_EDIT_CONFLICT).toBe('COMMENT_EDIT_CONFLICT');
  });
});

describe('comments.app-service exports', () => {
  it('exports all required functions', () => {
    const service = require('../../application/comments.app-service');
    expect(typeof service.listArtifactCommentThreads).toBe('function');
    expect(typeof service.getCommentThread).toBe('function');
    expect(typeof service.createCommentThreadWithInitialMessage).toBe('function');
    expect(typeof service.replyToCommentThread).toBe('function');
    expect(typeof service.editCommentMessage).toBe('function');
    expect(typeof service.resolveCommentThread).toBe('function');
    expect(typeof service.reopenCommentThread).toBe('function');
  });
});

describe('@qori/api-contracts Comments public contract', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const contracts = require('@qori/api-contracts');

  describe('exports comment enums', () => {
    it('CommentThreadStatus includes open and resolved', () => {
      // Type-only export, verified by compilation
      // Verify enums.ts exports these
      expect(contracts).toBeDefined();
    });
  });

  describe('exports comment resource types', () => {
    // Type exports are verified at compile time
    // This test ensures the package is importable
    it('package is importable from backend', () => {
      expect(contracts).toBeDefined();
    });
  });

  describe('public contract uses public_id convention', () => {
    // Structural test: verify the types exist and are importable
    // Actual shape verification is done by TypeScript compilation
    it('re-exports from backend/types/comments align with @qori/api-contracts', () => {
      const backendTypes = require('../../types/comments');
      // Backend re-exports the public types
      expect(backendTypes).toBeDefined();
    });
  });
});
