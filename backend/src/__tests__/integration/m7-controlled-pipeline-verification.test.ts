/**
 * DISC-WEB-1D-2 M7a: Controlled Pipeline Verification Tests (P0)
 *
 * P0 tests that exercise REAL controlled execution paths with deterministic
 * fake providers. These tests verify:
 *
 * 1. Multi-step budget exhaustion through actual YAML execution pipeline
 * 2. YAML generation retry with budget reservation per attempt
 * 3. Extraction retry through controlled routing
 * 4. Claim-guard retry budget accounting
 *
 * Key invariant: Each provider invocation creates a separate budget reservation.
 * Retries do NOT reuse reservations — they create fresh ones.
 *
 * These tests use the real `executeAiGenerationTasks()` path, NOT direct
 * `reserveBudget()` calls. They mock only the LLM provider to return
 * deterministic responses.
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { CreationAttributes } from 'sequelize';
import type { Project } from '../../database/models/project';
import type { Actor } from '../../database/models/actor';
import type { DiscoveryRun } from '../../database/models/discovery_run';
import type { ControlledTestSession } from '../../database/models/controlled_test_session';
import {
  createSession,
  bindRunToSession,
  getSessionById,
  reserveBudget,
} from '../../services/controlled-test-budget.service';
import {
  runInControlledContext,
  _resetLifecycleState,
} from '../../context/controlledExecutionContext';
import { executeAiGenerationTasks, type PostGenerationValidation, type ClaimViolationLike } from '../../helpers/langchain';
import { extractVariables, type EmitSpec } from '../../helpers/variableExtractor';
import { finalizeControlledExecution } from '../../application/discovery.app-service';
import {
  markArtifactFailed,
  getCurrentArtifactForRun,
} from '../../services/discovery-artifact.service';
import * as modelProvider from '../../helpers/modelProvider';

// ─── Test Database Setup ──────────────────────────────────────────────────────

const sequelize = getTestDb();
const ProjectModel = sequelize.models.Project;
const ActorModel = sequelize.models.Actor;
const DiscoveryRunModel = sequelize.models.DiscoveryRun;
const DiscoveryArtifactModel = sequelize.models.DiscoveryArtifact;
const ControlledTestReservationModel = sequelize.models.ControlledTestReservation;

// Test fixtures
let projectId: number;
let actorId: number;

async function setupFixtures(): Promise<void> {
  const project = await ProjectModel.create({
    name: 'M7a Pipeline Test Project',
    slug: 'm7a-pipeline-test',
    status: 'active',
    created_by: 'U_TEST',
    organization_id: TEST_ORG_ID,
  });
  projectId = (project as unknown as { id: number }).id;

  const actor = await ActorModel.create({
    organization_id: TEST_ORG_ID,
    display_name: 'M7a Test Researcher',
    status: 'active',
  });
  actorId = (actor as unknown as { id: number }).id;
}

async function createTestDiscoveryRun(): Promise<number> {
  const run = await DiscoveryRunModel.create({
    project_id: projectId,
    discovery_type: 'desk_research',
    topic: 'M7a Test Topic',
    topic_slug: 'm7a-test-topic',
    source_intent: 'Pipeline Testing',
    actor_id: actorId,
    created_by_identity: 'U_TEST',
    status: 'pending',
  } as CreationAttributes<DiscoveryRun>);
  return (run as unknown as { id: number }).id;
}

async function createBoundSession(runId: number): Promise<ControlledTestSession> {
  const session = await createSession({
    maxRequests: 10,
    maxInputTokens: 100000,
    maxOutputTokens: 50000,
    actorId: actorId,
  });
  await bindRunToSession(session.id, runId, projectId);
  // Reload to get updated session
  const reloaded = await getSessionById(session.id);
  return reloaded!;
}

async function getReservationCount(sessionId: number): Promise<number> {
  const [rows] = await sequelize.query(
    'SELECT COUNT(*) as count FROM controlled_test_reservations WHERE session_id = :sessionId',
    { replacements: { sessionId } },
  );
  return Number((rows as Array<{ count: string }>)[0].count);
}

// ─── Deterministic Fake Model Factory ─────────────────────────────────────────

interface DeterministicModelConfig {
  /** Responses to return in order. Once exhausted, throws error. */
  responses: Array<{
    content: string;
    inputTokens?: number;
    outputTokens?: number;
  }>;
  /** Optional error to throw on nth invocation (1-indexed). */
  errorOnInvocation?: number;
  /** Token count to return from getNumTokens. Default: 100 */
  tokenEstimate?: number;
}

function createDeterministicModel(config: DeterministicModelConfig) {
  let invocationCount = 0;
  const responses = [...config.responses]; // Copy to avoid mutation

  return {
    getNumTokens: jest.fn().mockResolvedValue(config.tokenEstimate ?? 100),
    invoke: jest.fn().mockImplementation(async () => {
      invocationCount++;

      if (config.errorOnInvocation && invocationCount === config.errorOnInvocation) {
        throw new Error(`Deterministic error on invocation ${invocationCount}`);
      }

      const response = responses.shift();
      if (!response) {
        throw new Error(`No more deterministic responses configured (invocation ${invocationCount})`);
      }

      return {
        content: response.content,
        usage_metadata: {
          input_tokens: response.inputTokens ?? 100,
          output_tokens: response.outputTokens ?? 50,
        },
      };
    }),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DISC-WEB-1D-2 M7a: Controlled Pipeline Verification (P0)', () => {
  // Store original implementations
  let originalCreateControlledTestModel: typeof modelProvider.createControlledTestModel;
  let originalCreateModel: typeof modelProvider.createModel;

  beforeAll(() => {
    // Store originals
    originalCreateControlledTestModel = modelProvider.createControlledTestModel;
    originalCreateModel = modelProvider.createModel;
  });

  beforeEach(async () => {
    await truncateAll();
    await setupFixtures();
    _resetLifecycleState();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original implementations
    (modelProvider as any).createControlledTestModel = originalCreateControlledTestModel;
    (modelProvider as any).createModel = originalCreateModel;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // P0-1: Multi-step budget exhaustion through real YAML pipeline
  // ═══════════════════════════════════════════════════════════════════════════

  describe('P0-1: Multi-step budget exhaustion via YAML pipeline', () => {
    it('each AI task creates a separate budget reservation', async () => {
      const runId = await createTestDiscoveryRun();
      const session = await createBoundSession(runId);

      // Configure fake model to return deterministic responses
      const fakeModel = createDeterministicModel({
        responses: [
          { content: 'Task 1 response', inputTokens: 100, outputTokens: 50 },
          { content: 'Task 2 response', inputTokens: 150, outputTokens: 75 },
          { content: 'Task 3 response', inputTokens: 120, outputTokens: 60 },
        ],
      });

      // Mock both createControlledTestModel (for controlled path) and createModel (for ordinary path)
      (modelProvider as any).createControlledTestModel = jest.fn().mockReturnValue(fakeModel);
      (modelProvider as any).createModel = jest.fn().mockReturnValue(fakeModel);

      // Define 3 simple YAML tasks
      const tasks = [
        { task_id: 'task_1', prompt: 'Generate task 1: {{input}}' },
        { task_id: 'task_2', prompt: 'Generate task 2: {{input}}' },
        { task_id: 'task_3', prompt: 'Generate task 3: {{input}}' },
      ];

      const inputValues = { input: 'test input' };

      // Execute within controlled context
      const result = await runInControlledContext(
        { sessionId: session.id, discoveryRunId: runId, purpose: 'P0-1 test' },
        async () => executeAiGenerationTasks(tasks, inputValues),
      );

      // Verify all 3 tasks executed (order not guaranteed due to Promise.all)
      expect(Object.keys(result)).toHaveLength(3);
      expect(result.task_1).toBeDefined();
      expect(result.task_2).toBeDefined();
      expect(result.task_3).toBeDefined();
      // At least one response per task
      const responses = [result.task_1, result.task_2, result.task_3];
      expect(responses.every(r => r.includes('response'))).toBe(true);

      // Verify 3 separate reservations were created
      const reservationCount = await getReservationCount(session.id);
      expect(reservationCount).toBe(3);

      // Verify invoke was called 3 times
      expect(fakeModel.invoke).toHaveBeenCalledTimes(3);
    });

    it('exhaustion before provider invocation prevents any dispatch', async () => {
      const runId = await createTestDiscoveryRun();
      // Create session with only 2 request budget
      const session = await createSession({
        maxRequests: 2,
        maxInputTokens: 100000,
        maxOutputTokens: 50000,
        actorId: actorId,
      });
      await bindRunToSession(session.id, runId, projectId);

      const fakeModel = createDeterministicModel({
        responses: [
          { content: 'Task 1 response' },
          { content: 'Task 2 response' },
          { content: 'Task 3 response - should never reach' },
        ],
      });

      (modelProvider as any).createControlledTestModel = jest.fn().mockReturnValue(fakeModel);
      (modelProvider as any).createModel = jest.fn().mockReturnValue(fakeModel);

      const tasks = [
        { task_id: 'task_1', prompt: 'Task 1' },
        { task_id: 'task_2', prompt: 'Task 2' },
        { task_id: 'task_3', prompt: 'Task 3 - should fail' },
      ];

      // Execute within controlled context - should fail on 3rd task
      await expect(
        runInControlledContext(
          { sessionId: session.id, discoveryRunId: runId, purpose: 'P0-1 exhaustion test' },
          async () => executeAiGenerationTasks(tasks, {}),
        ),
      ).rejects.toThrow(/budget/i);

      // Verify only 2 reservations were created (budget exhausted before 3rd)
      const reservationCount = await getReservationCount(session.id);
      expect(reservationCount).toBe(2);

      // Verify invoke was called only 2 times
      expect(fakeModel.invoke).toHaveBeenCalledTimes(2);
    });

    it('token exhaustion blocks before dispatch', async () => {
      const runId = await createTestDiscoveryRun();
      // Create session with very limited input token budget
      const session = await createSession({
        maxRequests: 100,
        maxInputTokens: 150, // Only enough for ~1.5 tasks at 100 tokens each
        maxOutputTokens: 50000,
        actorId: actorId,
      });
      await bindRunToSession(session.id, runId, projectId);

      const fakeModel = createDeterministicModel({
        tokenEstimate: 100, // Each task measures 100 input tokens
        responses: [
          { content: 'Task 1 response', inputTokens: 100, outputTokens: 50 },
          { content: 'Task 2 response - should not reach' },
        ],
      });

      (modelProvider as any).createControlledTestModel = jest.fn().mockReturnValue(fakeModel);
      (modelProvider as any).createModel = jest.fn().mockReturnValue(fakeModel);

      const tasks = [
        { task_id: 'task_1', prompt: 'Task 1' },
        { task_id: 'task_2', prompt: 'Task 2 - should fail on token budget' },
      ];

      // First task should succeed, second should fail on budget
      await expect(
        runInControlledContext(
          { sessionId: session.id, discoveryRunId: runId, purpose: 'P0-1 token exhaustion' },
          async () => executeAiGenerationTasks(tasks, {}),
        ),
      ).rejects.toThrow(/budget/i);

      // Only 1 reservation should complete (2nd fails at reservation stage)
      const reservationCount = await getReservationCount(session.id);
      expect(reservationCount).toBe(1);

      // Only 1 invoke
      expect(fakeModel.invoke).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // P0-2: YAML generation retry with claim-guard
  // ═══════════════════════════════════════════════════════════════════════════

  describe('P0-2: Claim-guard retry creates fresh reservation', () => {
    it('claim-guard retry creates second reservation for same task', async () => {
      const runId = await createTestDiscoveryRun();
      const session = await createBoundSession(runId);

      // First response has a claim violation, second (retry) is clean
      const fakeModel = createDeterministicModel({
        responses: [
          { content: 'INVALID: This contains fabricated claim' }, // Fails validation
          { content: 'Valid response without violations' }, // Retry succeeds
        ],
      });

      (modelProvider as any).createControlledTestModel = jest.fn().mockReturnValue(fakeModel);
      (modelProvider as any).createModel = jest.fn().mockReturnValue(fakeModel);

      // Create a post-validation that detects "fabricated" as a violation
      const postValidation: PostGenerationValidation = {
        taskIds: new Set(['validated_task']),
        validate: (taskId: string, text: string): ClaimViolationLike[] => {
          if (text.includes('fabricated')) {
            return [{
              class: 'unsupported_claim',
              description: 'Contains fabricated content',
              evidence: 'fabricated claim',
            }];
          }
          return [];
        },
        buildRetryGuidance: (violations: ClaimViolationLike[]) =>
          `RETRY: Avoid the following violations: ${violations.map(v => v.description).join(', ')}`,
        fallbackText: () => 'Fallback text',
      };

      const tasks = [
        { task_id: 'validated_task', prompt: 'Generate validated content' },
      ];

      const inputValues = {
        __postValidation: postValidation,
      };

      const result = await runInControlledContext(
        { sessionId: session.id, discoveryRunId: runId, purpose: 'P0-2 claim-guard retry' },
        async () => executeAiGenerationTasks(tasks, inputValues),
      );

      // Result should be from retry (clean response)
      expect(result.validated_task).toBe('Valid response without violations');

      // TWO reservations: initial + retry
      const reservationCount = await getReservationCount(session.id);
      expect(reservationCount).toBe(2);

      // invoke called twice: initial + retry
      expect(fakeModel.invoke).toHaveBeenCalledTimes(2);
    });

    it('claim-guard fallback still counts both attempts against budget', async () => {
      const runId = await createTestDiscoveryRun();
      const session = await createBoundSession(runId);

      // Both responses fail validation
      const fakeModel = createDeterministicModel({
        responses: [
          { content: 'BAD: fabricated content' },
          { content: 'STILL BAD: another fabricated response' },
        ],
      });

      (modelProvider as any).createControlledTestModel = jest.fn().mockReturnValue(fakeModel);
      (modelProvider as any).createModel = jest.fn().mockReturnValue(fakeModel);

      const postValidation: PostGenerationValidation = {
        taskIds: new Set(['validated_task']),
        validate: (taskId: string, text: string): ClaimViolationLike[] => {
          if (text.includes('fabricated')) {
            return [{
              class: 'unsupported_claim',
              description: 'Contains fabricated content',
              evidence: 'fabricated',
            }];
          }
          return [];
        },
        buildRetryGuidance: () => 'RETRY: Remove fabricated claims',
        fallbackText: () => 'DETERMINISTIC_FALLBACK',
      };

      const tasks = [{ task_id: 'validated_task', prompt: 'Generate content' }];

      const result = await runInControlledContext(
        { sessionId: session.id, discoveryRunId: runId, purpose: 'P0-2 fallback test' },
        async () => executeAiGenerationTasks(tasks, { __postValidation: postValidation }),
      );

      // Result should be fallback
      expect(result.validated_task).toBe('DETERMINISTIC_FALLBACK');

      // Both attempts count as reservations
      const reservationCount = await getReservationCount(session.id);
      expect(reservationCount).toBe(2);

      expect(fakeModel.invoke).toHaveBeenCalledTimes(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // P0-3: Provider error with retry creates multiple reservations
  // ═══════════════════════════════════════════════════════════════════════════

  describe('P0-3: Provider error handling and budget retention', () => {
    it('provider error retains reservation (no reconciliation credit)', async () => {
      const runId = await createTestDiscoveryRun();
      const session = await createBoundSession(runId);

      // Model throws on first invocation
      const fakeModel = createDeterministicModel({
        responses: [],
        errorOnInvocation: 1,
      });

      (modelProvider as any).createControlledTestModel = jest.fn().mockReturnValue(fakeModel);
      (modelProvider as any).createModel = jest.fn().mockReturnValue(fakeModel);

      const tasks = [{ task_id: 'error_task', prompt: 'This will error' }];

      // Should throw provider error
      await expect(
        runInControlledContext(
          { sessionId: session.id, discoveryRunId: runId, purpose: 'P0-3 error test' },
          async () => executeAiGenerationTasks(tasks, {}),
        ),
      ).rejects.toThrow(/Controlled AI invocation failed|Deterministic error/);

      // Reservation was created but NOT reconciled (conservative retention)
      const reservationCount = await getReservationCount(session.id);
      expect(reservationCount).toBe(1);

      // Check session used_requests incremented (budget consumed)
      const updatedSession = await getSessionById(session.id);
      expect(updatedSession!.used_requests).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // P0-4: Context isolation verification
  // ═══════════════════════════════════════════════════════════════════════════

  describe('P0-4: Context isolation between sequential executions', () => {
    it('sequential sessions maintain separate budget contexts', async () => {
      // Test verifies that different sessions track their own reservations separately.
      // Due to single-active-session constraint, we execute sequentially.

      // --- Session 1 ---
      const runId1 = await createTestDiscoveryRun();
      const session1 = await createBoundSession(runId1);

      const fakeModel1 = createDeterministicModel({
        responses: [{ content: 'Session 1 response' }],
      });

      (modelProvider as any).createControlledTestModel = jest.fn().mockReturnValue(fakeModel1);
      (modelProvider as any).createModel = jest.fn().mockReturnValue(fakeModel1);

      const tasks = [{ task_id: 'task', prompt: 'Generate' }];

      await runInControlledContext(
        { sessionId: session1.id, discoveryRunId: runId1 },
        async () => executeAiGenerationTasks(tasks, {}),
      );

      // Check session1 has 1 reservation
      const reservations1 = await getReservationCount(session1.id);
      expect(reservations1).toBe(1);

      // Complete session1 so we can create session2
      await sequelize.query(
        'UPDATE controlled_test_sessions SET status = :status, completed_at = NOW() WHERE id = :id',
        { replacements: { status: 'completed', id: session1.id } },
      );

      // --- Session 2 ---
      const runId2 = await createTestDiscoveryRun();
      const session2 = await createBoundSession(runId2);

      const fakeModel2 = createDeterministicModel({
        responses: [{ content: 'Session 2 response' }],
      });

      (modelProvider as any).createControlledTestModel = jest.fn().mockReturnValue(fakeModel2);
      (modelProvider as any).createModel = jest.fn().mockReturnValue(fakeModel2);

      await runInControlledContext(
        { sessionId: session2.id, discoveryRunId: runId2 },
        async () => executeAiGenerationTasks(tasks, {}),
      );

      // Check session2 has its own 1 reservation (not shared with session1)
      const reservations2 = await getReservationCount(session2.id);
      expect(reservations2).toBe(1);

      // Session1 still has only 1 reservation (not affected by session2)
      const reservations1After = await getReservationCount(session1.id);
      expect(reservations1After).toBe(1);

      // Total reservations should be 2 (one per session)
      const [totalRows] = await sequelize.query(
        'SELECT COUNT(*) as count FROM controlled_test_reservations',
      );
      expect(Number((totalRows as Array<{ count: string }>)[0].count)).toBe(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // P0-5: Skip-when bypasses budget (no AI call)
  // ═══════════════════════════════════════════════════════════════════════════

  describe('P0-5: skip_when tasks do not consume budget', () => {
    it('skipped tasks do not create reservations', async () => {
      const runId = await createTestDiscoveryRun();
      const session = await createBoundSession(runId);

      const fakeModel = createDeterministicModel({
        responses: [{ content: 'Task 2 response' }],
      });

      (modelProvider as any).createControlledTestModel = jest.fn().mockReturnValue(fakeModel);
      (modelProvider as any).createModel = jest.fn().mockReturnValue(fakeModel);

      const tasks = [
        {
          task_id: 'skipped_task',
          prompt: 'This should not run',
          skip_when: 'not upstream_data', // Evaluates to true (skip) when upstream_data is falsy
          skip_output: 'SKIPPED',
        },
        {
          task_id: 'executed_task',
          prompt: 'This should run',
        },
      ];

      const inputValues = {
        upstream_data: undefined, // Makes skip_when evaluate to true
      };

      const result = await runInControlledContext(
        { sessionId: session.id, discoveryRunId: runId },
        async () => executeAiGenerationTasks(tasks, inputValues),
      );

      expect(result.skipped_task).toBe('SKIPPED');
      expect(result.executed_task).toBe('Task 2 response');

      // Only 1 reservation (for executed_task, not for skipped_task)
      const reservationCount = await getReservationCount(session.id);
      expect(reservationCount).toBe(1);

      // Only 1 invoke
      expect(fakeModel.invoke).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // P0-6: Variable extraction retry creates separate reservations
  // ═══════════════════════════════════════════════════════════════════════════

  describe('P0-6: Variable extraction retry under controlled context', () => {
    it('extraction retry creates second reservation after parse failure', async () => {
      const runId = await createTestDiscoveryRun();
      const session = await createBoundSession(runId);

      // First response: invalid JSON (triggers retry)
      // Second response: valid JSON matching schema
      const fakeModel = createDeterministicModel({
        responses: [
          { content: 'NOT VALID JSON - this will fail parse' },
          { content: '{"test_variable": {"key": "value", "count": 42}}' },
        ],
      });

      (modelProvider as any).createControlledTestModel = jest.fn().mockReturnValue(fakeModel);
      (modelProvider as any).createModel = jest.fn().mockReturnValue(fakeModel);

      // Minimal emit spec for extraction
      const emitsSpec: EmitSpec[] = [
        {
          key: 'test_variable',
          schema: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              count: { type: 'integer' },
            },
          },
                  },
      ];

      const renderedOutput = 'Test document content for extraction';
      const inputValues = {};

      const result = await runInControlledContext(
        { sessionId: session.id, discoveryRunId: runId, purpose: 'P0-6 extraction retry' },
        async () => extractVariables(renderedOutput, emitsSpec, inputValues),
      );

      // Result should contain extracted variable from retry
      expect(result).not.toBeNull();
      expect(result!.test_variable).toBeDefined();
      expect(result!.test_variable.value).toEqual({ key: 'value', count: 42 });

      // TWO reservations: initial (failed parse) + retry (success)
      const reservationCount = await getReservationCount(session.id);
      expect(reservationCount).toBe(2);

      // invoke called twice
      expect(fakeModel.invoke).toHaveBeenCalledTimes(2);
    });

    it('failed extraction attempt retains full reservation', async () => {
      const runId = await createTestDiscoveryRun();
      const session = await createBoundSession(runId);

      // Both responses fail
      const fakeModel = createDeterministicModel({
        responses: [
          { content: 'INVALID JSON 1' },
          { content: 'INVALID JSON 2' },
        ],
      });

      (modelProvider as any).createControlledTestModel = jest.fn().mockReturnValue(fakeModel);
      (modelProvider as any).createModel = jest.fn().mockReturnValue(fakeModel);

      const emitsSpec: EmitSpec[] = [
        {
          key: 'test_variable',
          schema: { type: 'object', properties: { field: { type: 'string' } } },
                  },
      ];

      const result = await runInControlledContext(
        { sessionId: session.id, discoveryRunId: runId },
        async () => extractVariables('Content', emitsSpec, {}),
      );

      // Extraction failed (returns null)
      expect(result).toBeNull();

      // Both attempts created reservations (not released on failure)
      const reservationCount = await getReservationCount(session.id);
      expect(reservationCount).toBe(2);

      // Session budget was consumed
      const updatedSession = await getSessionById(session.id);
      expect(updatedSession!.used_requests).toBe(2);
    });

    it('budget exhaustion prevents second extraction attempt', async () => {
      const runId = await createTestDiscoveryRun();
      // Create session with only 1 request budget
      const session = await createSession({
        maxRequests: 1,
        maxInputTokens: 100000,
        maxOutputTokens: 50000,
        actorId: actorId,
      });
      await bindRunToSession(session.id, runId, projectId);

      // First response invalid (would trigger retry, but budget exhausted)
      const fakeModel = createDeterministicModel({
        responses: [
          { content: 'INVALID JSON' },
          { content: '{"test_variable": "should not reach"}' },
        ],
      });

      (modelProvider as any).createControlledTestModel = jest.fn().mockReturnValue(fakeModel);
      (modelProvider as any).createModel = jest.fn().mockReturnValue(fakeModel);

      const emitsSpec: EmitSpec[] = [
        {
          key: 'test_variable',
          schema: { type: 'object', properties: { field: { type: 'string' } } },
                  },
      ];

      // Should NOT throw - extraction returns null on failure, doesn't throw budget error
      // The retry is blocked by budget exhaustion and extraction fails gracefully
      const result = await runInControlledContext(
        { sessionId: session.id, discoveryRunId: runId },
        async () => extractVariables('Content', emitsSpec, {}),
      );

      // Extraction failed (first attempt failed, retry blocked by budget)
      expect(result).toBeNull();

      // Only 1 reservation (second attempt blocked)
      const reservationCount = await getReservationCount(session.id);
      expect(reservationCount).toBe(1);

      // Only 1 invoke
      expect(fakeModel.invoke).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // P0-7: Controlled execution failure containment
  // ═══════════════════════════════════════════════════════════════════════════

  describe('P0-7: Controlled execution failure containment', () => {
    it('provider error during AI generation allows failure finalization', async () => {
      // This test uses a provider error (not budget exhaustion) so the session
      // remains 'active' at the time of failure, allowing proper finalization.
      const runId = await createTestDiscoveryRun();
      // Update run to processing status (required for finalization)
      await sequelize.query(
        'UPDATE discovery_runs SET status = :status, worker_id = :workerId WHERE id = :id',
        { replacements: { status: 'processing', workerId: 'test-worker', id: runId } },
      );

      // Create session with plenty of budget
      const session = await createSession({
        maxRequests: 10,
        maxInputTokens: 100000,
        maxOutputTokens: 50000,
        actorId: actorId,
      });
      await bindRunToSession(session.id, runId, projectId);

      // Model errors on first invocation
      const fakeModel = createDeterministicModel({
        responses: [],
        errorOnInvocation: 1,
      });

      (modelProvider as any).createControlledTestModel = jest.fn().mockReturnValue(fakeModel);
      (modelProvider as any).createModel = jest.fn().mockReturnValue(fakeModel);

      const tasks = [{ task_id: 'task_1', prompt: 'Task 1 - will error' }];

      // Execute and catch provider error
      let caughtError: Error | null = null;
      try {
        await runInControlledContext(
          { sessionId: session.id, discoveryRunId: runId },
          async () => executeAiGenerationTasks(tasks, {}),
        );
      } catch (error) {
        caughtError = error as Error;
      }

      // Verify error was thrown
      expect(caughtError).not.toBeNull();
      expect(caughtError!.message).toMatch(/provider_error|Deterministic error/i);

      // Verify reservation was created (but not reconciled due to error)
      const reservationCount = await getReservationCount(session.id);
      expect(reservationCount).toBe(1);

      // Session is still active (not exhausted)
      const preFinalizationSession = await getSessionById(session.id);
      expect(preFinalizationSession!.status).toBe('active');

      // Finalize as failed (this is what the real execution path would do)
      const finalization = await finalizeControlledExecution(
        runId,
        session.id,
        'failed',
        caughtError!.message,
      );

      // Finalization succeeded
      expect(finalization.error).toBeUndefined();
      expect(finalization.success).toBe(true);

      // Run status is 'failed' (cannot finalize as completed)
      expect(finalization.runStatus).toBe('failed');

      // Session reached expected terminal state ('cancelled' for failed outcomes)
      expect(finalization.sessionStatus).toBe('cancelled');

      // Verify database state
      const [runRows] = await sequelize.query(
        'SELECT status, failure_code FROM discovery_runs WHERE id = :id',
        { replacements: { id: runId } },
      );
      const runRecord = (runRows as Array<{ status: string; failure_code: string }>)[0];
      expect(runRecord.status).toBe('failed');
      expect(runRecord.failure_code).toBe('CONTROLLED_EXECUTION_FAILURE');
    });

    it('budget exhaustion blocks execution and prevents completion', async () => {
      // When budget limit is reached, reservation fails with budget_exceeded.
      // The controlled run cannot complete successfully.
      const runId = await createTestDiscoveryRun();
      await sequelize.query(
        'UPDATE discovery_runs SET status = :status, worker_id = :workerId WHERE id = :id',
        { replacements: { status: 'processing', workerId: 'test-worker', id: runId } },
      );

      // Create session with only 2 request budget
      const session = await createSession({
        maxRequests: 2,
        maxInputTokens: 100000,
        maxOutputTokens: 50000,
        actorId: actorId,
      });
      await bindRunToSession(session.id, runId, projectId);

      const fakeModel = createDeterministicModel({
        responses: [
          { content: 'Task 1 OK' },
          { content: 'Task 2 OK' },
          { content: 'Task 3 - should not reach' },
        ],
      });

      (modelProvider as any).createControlledTestModel = jest.fn().mockReturnValue(fakeModel);
      (modelProvider as any).createModel = jest.fn().mockReturnValue(fakeModel);

      const tasks = [
        { task_id: 'task_1', prompt: 'Task 1' },
        { task_id: 'task_2', prompt: 'Task 2' },
        { task_id: 'task_3', prompt: 'Task 3 - exceeds budget' },
      ];

      // Execute and catch budget exhaustion error
      let caughtError: Error | null = null;
      try {
        await runInControlledContext(
          { sessionId: session.id, discoveryRunId: runId },
          async () => executeAiGenerationTasks(tasks, {}),
        );
      } catch (error) {
        caughtError = error as Error;
      }

      // Verify budget_exceeded error was thrown
      expect(caughtError).not.toBeNull();
      expect(caughtError!.message).toMatch(/budget/i);

      // Initial provider attempts executed (2), third blocked
      expect(fakeModel.invoke).toHaveBeenCalledTimes(2);

      // Third attempt rejected BEFORE provider dispatch
      const reservationCount = await getReservationCount(session.id);
      expect(reservationCount).toBe(2);

      // Session may be 'active' or 'exhausted' depending on reconciliation timing
      // (tasks execute in parallel, so reconciliation order affects final state)
      const postSession = await getSessionById(session.id);
      expect(['active', 'exhausted']).toContain(postSession!.status);

      // Run remains in 'processing' (execution threw before completion)
      const [runRows] = await sequelize.query(
        'SELECT status FROM discovery_runs WHERE id = :id',
        { replacements: { id: runId } },
      );
      expect((runRows as Array<{ status: string }>)[0].status).toBe('processing');

      // KEY INVARIANT: The controlled run CANNOT be finalized as 'completed'
      // because the execution threw an error.
      //
      // We don't actually call finalizeControlledExecution here because
      // the session state (active vs exhausted) varies based on reconciliation timing.
      // What matters is that:
      // 1. The execution FAILED (caughtError is not null)
      // 2. The run remains in 'processing' status (not completed)
      // 3. The provider was blocked on the third attempt (only 2 invocations)
      // 4. Budget was properly tracked (2 reservations)
      //
      // This test verifies failure CONTAINMENT - the run did not succeed.
    });

    it('failed controlled artifact transitions to failed status', async () => {
      const runId = await createTestDiscoveryRun();
      await sequelize.query(
        'UPDATE discovery_runs SET status = :status, worker_id = :workerId WHERE id = :id',
        { replacements: { status: 'processing', workerId: 'test-worker', id: runId } },
      );

      const session = await createBoundSession(runId);

      // Create artifact in 'generating' status (simulating artifact created during execution)
      const artifact = await DiscoveryArtifactModel.create({
        project_id: projectId,
        discovery_run_id: runId,
        artifact_type: 'desk_research',
        title: 'Test Artifact',
        topic_slug: 'm7a-test-topic',
        status: 'generating',
        template_name: 'test',
        template_version: '1.0',
        derivation_fingerprint: 'test-hash',
        actor_id: actorId,
        generated_by_identity: 'U_TEST',
      });
      const artifactId = (artifact as unknown as { id: number }).id;

      // Simulate execution failure (provider error)
      const fakeModel = createDeterministicModel({
        responses: [],
        errorOnInvocation: 1,
      });

      (modelProvider as any).createControlledTestModel = jest.fn().mockReturnValue(fakeModel);
      (modelProvider as any).createModel = jest.fn().mockReturnValue(fakeModel);

      const tasks = [{ task_id: 'failing_task', prompt: 'Will fail' }];

      let caughtError: Error | null = null;
      try {
        await runInControlledContext(
          { sessionId: session.id, discoveryRunId: runId },
          async () => executeAiGenerationTasks(tasks, {}),
        );
      } catch (error) {
        caughtError = error as Error;
      }

      expect(caughtError).not.toBeNull();

      // CRITICAL: M5e path calls markArtifactFailed when execution fails after artifact creation
      // This simulates what executeControlledDiscoveryRunInner does in its catch block (line 2165)
      await markArtifactFailed(artifactId);

      // Finalize run/session as failed
      await finalizeControlledExecution(runId, session.id, 'failed', caughtError!.message);

      // Verify artifact transitioned to 'failed' status
      const [artifactRows] = await sequelize.query(
        'SELECT status FROM discovery_artifacts WHERE id = :artifactId',
        { replacements: { artifactId } },
      );
      const artifacts = artifactRows as Array<{ status: string }>;
      expect(artifacts[0].status).toBe('failed');

      // Verify canonical reader excludes the failed artifact
      const canonicalArtifact = await getCurrentArtifactForRun(runId);
      expect(canonicalArtifact).toBeNull();
    });

    it('canonical reader excludes non-current artifacts', async () => {
      const runId = await createTestDiscoveryRun();

      // Create artifacts in various non-current states
      await DiscoveryArtifactModel.create({
        project_id: projectId,
        discovery_run_id: runId,
        artifact_type: 'desk_research',
        title: 'Generating Artifact',
        topic_slug: 'm7a-generating',
        status: 'generating',
        template_name: 'test',
        template_version: '1.0',
        derivation_fingerprint: 'hash-1',
        actor_id: actorId,
        generated_by_identity: 'U_TEST',
      });

      await DiscoveryArtifactModel.create({
        project_id: projectId,
        discovery_run_id: runId,
        artifact_type: 'desk_research',
        title: 'Failed Artifact',
        topic_slug: 'm7a-failed',
        status: 'failed',
        template_name: 'test',
        template_version: '1.0',
        derivation_fingerprint: 'hash-2',
        actor_id: actorId,
        generated_by_identity: 'U_TEST',
      });

      await DiscoveryArtifactModel.create({
        project_id: projectId,
        discovery_run_id: runId,
        artifact_type: 'desk_research',
        title: 'Superseded Artifact',
        topic_slug: 'm7a-superseded',
        status: 'superseded',
        template_name: 'test',
        template_version: '1.0',
        derivation_fingerprint: 'hash-3',
        actor_id: actorId,
        generated_by_identity: 'U_TEST',
      });

      // Canonical reader should return null (no 'current' artifact)
      const canonicalArtifact = await getCurrentArtifactForRun(runId);
      expect(canonicalArtifact).toBeNull();

      // Verify all 3 artifacts exist in DB
      const [allRows] = await sequelize.query(
        'SELECT status FROM discovery_artifacts WHERE discovery_run_id = :runId',
        { replacements: { runId } },
      );
      expect((allRows as Array<{ status: string }>).length).toBe(3);
    });

    it('cancelled session blocks all execution attempts', async () => {
      const runId = await createTestDiscoveryRun();
      await sequelize.query(
        'UPDATE discovery_runs SET status = :status, worker_id = :workerId WHERE id = :id',
        { replacements: { status: 'processing', workerId: 'test-worker', id: runId } },
      );

      const session = await createBoundSession(runId);

      // Cancel the session BEFORE execution
      await sequelize.query(
        `UPDATE controlled_test_sessions
         SET status = 'cancelled', cancelled_at = NOW(), cancellation_reason = 'Pre-execution cancellation'
         WHERE id = :id`,
        { replacements: { id: session.id } },
      );

      const fakeModel = createDeterministicModel({
        responses: [{ content: 'Should not reach' }],
      });

      (modelProvider as any).createControlledTestModel = jest.fn().mockReturnValue(fakeModel);
      (modelProvider as any).createModel = jest.fn().mockReturnValue(fakeModel);

      const tasks = [{ task_id: 'task_1', prompt: 'Task 1' }];

      // Execute - should fail immediately on session_terminal
      let caughtError: Error | null = null;
      try {
        await runInControlledContext(
          { sessionId: session.id, discoveryRunId: runId },
          async () => executeAiGenerationTasks(tasks, {}),
        );
      } catch (error) {
        caughtError = error as Error;
      }

      // Should have caught an error (session terminal)
      expect(caughtError).not.toBeNull();
      expect(caughtError!.message).toMatch(/session_terminal|cancelled/i);

      // No invocations should have happened (blocked at reservation)
      expect(fakeModel.invoke).not.toHaveBeenCalled();

      // No reservations created
      const reservationCount = await getReservationCount(session.id);
      expect(reservationCount).toBe(0);

      // Session remains in cancelled state
      const [sessionRows] = await sequelize.query(
        'SELECT status FROM controlled_test_sessions WHERE id = :id',
        { replacements: { id: session.id } },
      );
      expect((sessionRows as Array<{ status: string }>)[0].status).toBe('cancelled');
    });
  });
});
