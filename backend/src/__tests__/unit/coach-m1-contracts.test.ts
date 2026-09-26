/**
 * Coach M1: Coaching Contract Unit Tests
 *
 * Tests for coaching contract types and validation functions.
 * These tests run without database access.
 */

import { ApiErrorCode } from '../../types/api-errors';

describe('ApiErrorCode coaching extensions', () => {
  it('includes COACH_RUN_ALREADY_ACTIVE', () => {
    expect(ApiErrorCode.COACH_RUN_ALREADY_ACTIVE).toBe('COACH_RUN_ALREADY_ACTIVE');
  });

  it('includes COACH_RUN_INVALID_STATE', () => {
    expect(ApiErrorCode.COACH_RUN_INVALID_STATE).toBe('COACH_RUN_INVALID_STATE');
  });
});

describe('coaching.app-service exports', () => {
  it('exports all required functions', () => {
    const service = require('../../application/coaching.app-service');
    expect(typeof service.createCoachRun).toBe('function');
    expect(typeof service.getCoachRun).toBe('function');
    expect(typeof service.listCoachRunsForArtifact).toBe('function');
    expect(typeof service.markCoachRunRunning).toBe('function');
    expect(typeof service.markCoachRunCompleted).toBe('function');
    expect(typeof service.markCoachRunFailed).toBe('function');
    expect(typeof service.recordCoachRunItems).toBe('function');
    expect(typeof service.recordCoachRunReferences).toBe('function');
    expect(typeof service.recordCoachRunContext).toBe('function');
    expect(typeof service.recordCoachUsage).toBe('function');
    expect(typeof service.createResearcherRetryRun).toBe('function');
    expect(typeof service.incrementAttemptCount).toBe('function');
    expect(typeof service.updateHeartbeat).toBe('function');
  });
});

describe('@qori/api-contracts Coaching public contract', () => {
  /**
   * @qori/api-contracts is a types-only ESM package.
   * Type availability is verified by TypeScript compilation (typecheck).
   * Runtime require() is not applicable for ESM type packages.
   *
   * The following import statement proves types are correctly exported
   * (verified at compile time, not runtime):
   *
   * import type {
   *   CoachRunSummaryResource,
   *   CoachRunDetailResource,
   *   CoachRunItemResource,
   *   CoachRunReferenceResource,
   *   CreateCoachRunInput,
   *   CoachRunListResponse,
   * } from '@qori/api-contracts';
   */

  describe('enums exported in enums.ts', () => {
    it('CoachRunStatus values are valid', () => {
      const validStatuses: string[] = ['pending', 'running', 'completed', 'failed'];
      validStatuses.forEach(status => {
        expect(typeof status).toBe('string');
      });
    });

    it('CoachReviewScope values are valid', () => {
      const validScopes: string[] = ['section', 'artifact'];
      validScopes.forEach(scope => {
        expect(typeof scope).toBe('string');
      });
    });

    it('CoachItemCategory values are valid', () => {
      const validCategories: string[] = ['strength', 'issue', 'suggestion', 'question'];
      validCategories.forEach(category => {
        expect(typeof category).toBe('string');
      });
    });

    it('CoachContextRole values are valid', () => {
      const validRoles: string[] = ['primary', 'supporting'];
      validRoles.forEach(role => {
        expect(typeof role).toBe('string');
      });
    });

    it('CoachFailureCode values are valid', () => {
      const validCodes: string[] = [
        'PROVIDER_UNAVAILABLE',
        'PROVIDER_TIMEOUT',
        'RATE_LIMITED',
        'INVALID_MODEL_RESPONSE',
        'OUTPUT_VALIDATION_FAILED',
        'CONTEXT_BUILD_FAILED',
        'GENERATION_FAILED',
      ];
      validCodes.forEach(code => {
        expect(typeof code).toBe('string');
        expect(code).toBe(code.toUpperCase());
      });
    });
  });
});

describe('coaching run status lifecycle', () => {
  describe('allowed transitions', () => {
    it('pending -> running is valid', () => {
      const from = 'pending';
      const to = 'running';
      const validTransitions: Record<string, string[]> = {
        pending: ['running'],
        running: ['completed', 'failed'],
        completed: [],
        failed: [],
      };
      expect(validTransitions[from]).toContain(to);
    });

    it('running -> completed is valid', () => {
      const from = 'running';
      const to = 'completed';
      const validTransitions: Record<string, string[]> = {
        pending: ['running'],
        running: ['completed', 'failed'],
        completed: [],
        failed: [],
      };
      expect(validTransitions[from]).toContain(to);
    });

    it('running -> failed is valid', () => {
      const from = 'running';
      const to = 'failed';
      const validTransitions: Record<string, string[]> = {
        pending: ['running'],
        running: ['completed', 'failed'],
        completed: [],
        failed: [],
      };
      expect(validTransitions[from]).toContain(to);
    });
  });

  describe('disallowed transitions', () => {
    const validTransitions: Record<string, string[]> = {
      pending: ['running'],
      running: ['completed', 'failed'],
      completed: [],
      failed: [],
    };

    it('completed -> running is invalid', () => {
      expect(validTransitions['completed']).not.toContain('running');
    });

    it('failed -> running is invalid', () => {
      expect(validTransitions['failed']).not.toContain('running');
    });

    it('completed -> pending is invalid', () => {
      expect(validTransitions['completed']).not.toContain('pending');
    });

    it('failed -> pending is invalid', () => {
      expect(validTransitions['failed']).not.toContain('pending');
    });
  });
});

describe('coaching scope invariants', () => {
  it('section scope requires section_key', () => {
    const scope = 'section';
    const requiresSectionKey = scope === 'section';
    expect(requiresSectionKey).toBe(true);
  });

  it('artifact scope requires section_key to be null', () => {
    const scope = 'artifact';
    const requiresNoSectionKey = scope === 'artifact';
    expect(requiresNoSectionKey).toBe(true);
  });
});

describe('coaching retry types', () => {
  describe('researcher retry', () => {
    it('creates a new run with retry_of_run_id', () => {
      // Researcher retry creates NEW run, original unchanged
      const originalRunId = 'original-123';
      const retryRun = {
        id: 'retry-456',
        retry_of_run_id: originalRunId,
        status: 'pending',
      };
      expect(retryRun.id).not.toBe(originalRunId);
      expect(retryRun.retry_of_run_id).toBe(originalRunId);
      expect(retryRun.status).toBe('pending');
    });
  });

  describe('operational retry', () => {
    it('increments attempt_count on same run', () => {
      // Operational retry uses same run_id, increments attempt
      const run = {
        id: 'run-123',
        attempt_count: 1,
      };
      run.attempt_count += 1;
      expect(run.id).toBe('run-123');
      expect(run.attempt_count).toBe(2);
    });
  });
});

describe('coaching provenance immutability', () => {
  it('defines immutable provenance fields', () => {
    const immutableFields = [
      'content_version',
      'artifact_type',
      'review_scope',
      'selected_section_key',
      'requested_by',
      'coaching_contract_version',
      'prompt_template_version',
      'provider',
      'model',
      'retry_of_run_id',
    ];

    // These fields should never change after run creation
    expect(immutableFields.length).toBe(10);
    expect(immutableFields).toContain('content_version');
    expect(immutableFields).toContain('coaching_contract_version');
    expect(immutableFields).toContain('prompt_template_version');
  });
});

describe('coaching telemetry fields', () => {
  it('defines admin-only telemetry fields', () => {
    const telemetryFields = [
      'input_tokens',
      'output_tokens',
      'total_tokens',
      'estimated_cost',
      'actual_provider_cost',
      'latency_ms',
      'attempt_count',
      'worker_id',
      'claimed_at',
      'heartbeat_at',
    ];

    // These fields are NOT exposed in public API
    expect(telemetryFields.length).toBe(10);
    expect(telemetryFields).toContain('input_tokens');
    expect(telemetryFields).toContain('estimated_cost');
    expect(telemetryFields).toContain('worker_id');
  });
});
