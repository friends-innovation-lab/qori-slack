/**
 * M7b End-to-End budgetedInvoke Malformed Metadata Tests — DISC-WEB-1D-2
 *
 * Tests the real budgetedInvoke() path with deterministic fake models
 * to verify malformed provider usage_metadata handling.
 *
 * Invariant: "No refund or counter corruption from unreliable usage metadata"
 *
 * For each malformed value:
 * 1. Provider invocation occurs exactly once
 * 2. Exactly one reservation is created
 * 3. Reservation remains 'reserved', not 'reconciled'
 * 4. No output-token refund occurs
 * 5. Persisted budget counters remain unchanged
 * 6. Wrapper does not falsely report reconciled: true
 */

import { getTestDb, truncateAll } from './setup/testDb';
import type { Sequelize } from 'sequelize';
import type { CreationAttributes } from 'sequelize';

import type { Organization } from '../../database/models/organization';
import type { Project } from '../../database/models/project';
import type { Actor } from '../../database/models/actor';
import type { ControlledTestSession } from '../../database/models/controlled_test_session';
import type { ControlledTestReservation } from '../../database/models/controlled_test_reservation';

import { budgetedInvoke, type BudgetedInvokeResult } from '../../helpers/budgetedInvoke';
import * as modelProvider from '../../helpers/modelProvider';

// Mock the model provider to inject deterministic fake models
jest.mock('../../helpers/modelProvider', () => {
  const actual = jest.requireActual('../../helpers/modelProvider');
  return {
    ...actual,
    createControlledTestModel: jest.fn(),
  };
});

const mockModelProvider = modelProvider as jest.Mocked<typeof modelProvider>;

describe('M7b budgetedInvoke E2E Malformed Metadata — DISC-WEB-1D-2', () => {
  let sequelize: Sequelize;

  // Models
  let ProjectModel: typeof Project;
  let ActorModel: typeof Actor;
  let ControlledTestSessionModel: typeof ControlledTestSession;
  let ControlledTestReservationModel: typeof ControlledTestReservation;

  // Fixtures
  let testOrg: Organization;
  let testProject: Project;
  let testActor: Actor;

  beforeAll(async () => {
    sequelize = getTestDb();
    await sequelize.authenticate();

    ProjectModel = sequelize.models.Project as typeof Project;
    ActorModel = sequelize.models.Actor as typeof Actor;
    ControlledTestSessionModel = sequelize.models.ControlledTestSession as typeof ControlledTestSession;
    ControlledTestReservationModel = sequelize.models.ControlledTestReservation as typeof ControlledTestReservation;
  });

  beforeEach(async () => {
    await truncateAll();
    jest.clearAllMocks();

    const OrganizationModel = sequelize.models.Organization as typeof Organization;
    testOrg = await OrganizationModel.findOne({ where: { slug: 'test-org' } }) as Organization;

    testActor = await ActorModel.create({
      display_name: 'M7b E2E Test Actor',
      organization_id: testOrg.id,
      status: 'active',
    }) as Actor;

    testProject = await ProjectModel.create({
      name: 'M7b E2E Test Project',
      slug: `m7b-e2e-${Date.now()}`,
      created_by: testActor.public_id,
      organization_id: testOrg.id,
      status: 'active',
    }) as Project;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  // Helper to create active session
  async function createActiveSession(): Promise<ControlledTestSession> {
    return ControlledTestSessionModel.create({
      project_id: testProject.id,
      actor_id: testActor.id,
      status: 'active',
      max_requests: 10,
      max_input_tokens: 10000,
      max_output_tokens: 5000,
      used_requests: 0,
      used_input_tokens: 0,
      used_output_tokens: 0,
      purpose: 'm7b-e2e-test',
      created_by_identity: 'test:m7b-e2e',
    } as CreationAttributes<ControlledTestSession>) as Promise<ControlledTestSession>;
  }

  // Helper to create deterministic fake model
  function createFakeModel(config: {
    tokenEstimate: number;
    responseContent: string;
    usageMetadata: { input_tokens?: number; output_tokens?: unknown } | undefined;
  }) {
    let invokeCallCount = 0;
    return {
      getNumTokens: jest.fn().mockResolvedValue(config.tokenEstimate),
      invoke: jest.fn().mockImplementation(async () => {
        invokeCallCount++;
        return {
          content: config.responseContent,
          usage_metadata: config.usageMetadata,
        };
      }),
      _getInvokeCallCount: () => invokeCallCount,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PARAMETERIZED MALFORMED OUTPUT_TOKENS TESTS
  // ═══════════════════════════════════════════════════════════════════════════

  describe.each([
    { name: 'NaN', value: NaN, description: 'NaN output_tokens' },
    { name: 'Infinity', value: Infinity, description: 'Infinity output_tokens' },
    { name: 'Negative', value: -100, description: 'Negative output_tokens' },
    { name: 'String', value: '100' as unknown as number, description: 'String output_tokens' },
  ])('Malformed output_tokens: $description', ({ name, value }) => {
    it(`handles ${name} output_tokens without counter corruption`, async () => {
      const session = await createActiveSession();

      // Record initial budget state
      const initialUsedRequests = session.used_requests;
      const initialUsedInput = session.used_input_tokens;
      const initialUsedOutput = session.used_output_tokens;

      // Create fake model that returns malformed usage_metadata
      const fakeModel = createFakeModel({
        tokenEstimate: 100,
        responseContent: 'Test response',
        usageMetadata: { input_tokens: 100, output_tokens: value },
      });
      mockModelProvider.createControlledTestModel.mockReturnValue(fakeModel as any);

      // Suppress console.warn for expected reconciliation warning
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Execute budgetedInvoke
      const result: BudgetedInvokeResult = await budgetedInvoke({
        sessionId: session.id,
        prompt: 'Test prompt for malformed metadata',
        purpose: `m7b-e2e-${name}`,
      });

      warnSpy.mockRestore();

      // Assertion 1: Provider invocation occurs exactly once
      expect(fakeModel.invoke).toHaveBeenCalledTimes(1);

      // Assertion 2: Exactly one reservation is created
      const reservations = await ControlledTestReservationModel.findAll({
        where: { session_id: session.id },
      });
      expect(reservations).toHaveLength(1);
      const reservation = reservations[0] as ControlledTestReservation;

      // Assertion 3: Reservation remains 'reserved', not 'reconciled'
      expect(reservation.state).toBe('reserved');

      // Assertion 4: No output-token refund occurs (actual_output_tokens is null)
      expect(reservation.actual_output_tokens).toBeNull();

      // Assertion 5: Persisted budget counters show reservation but no refund
      const sessionAfter = await ControlledTestSessionModel.findByPk(session.id) as ControlledTestSession;
      // used_requests incremented by 1
      expect(sessionAfter.used_requests).toBe(initialUsedRequests + 1);
      // used_input_tokens incremented by token estimate
      expect(sessionAfter.used_input_tokens).toBe(initialUsedInput + 100);
      // used_output_tokens incremented by full reserved amount (4096), NO refund
      expect(sessionAfter.used_output_tokens).toBe(initialUsedOutput + 4096);

      // Assertion 6: Wrapper does not falsely report reconciled: true
      expect(result.ok).toBe(true); // Invocation succeeded
      expect(result.usage?.reconciled).toBe(false); // But NOT reconciled
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VALID OUTPUT_TOKENS: Baseline verification
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Valid output_tokens: Baseline', () => {
    it('reconciles valid integer output_tokens correctly', async () => {
      const session = await createActiveSession();

      const initialUsedOutput = session.used_output_tokens;

      // Create fake model with valid usage_metadata
      const fakeModel = createFakeModel({
        tokenEstimate: 100,
        responseContent: 'Test response',
        usageMetadata: { input_tokens: 100, output_tokens: 500 },
      });
      mockModelProvider.createControlledTestModel.mockReturnValue(fakeModel as any);

      const result = await budgetedInvoke({
        sessionId: session.id,
        prompt: 'Test prompt',
        purpose: 'm7b-e2e-valid',
      });

      // Provider invoked once
      expect(fakeModel.invoke).toHaveBeenCalledTimes(1);

      // Single reservation
      const reservations = await ControlledTestReservationModel.findAll({
        where: { session_id: session.id },
      });
      expect(reservations).toHaveLength(1);
      const reservation = reservations[0] as ControlledTestReservation;

      // Reservation is reconciled
      expect(reservation.state).toBe('reconciled');
      expect(reservation.actual_output_tokens).toBe(500);

      // Budget refunded: reserved 4096, actual 500, refund = 3596
      const sessionAfter = await ControlledTestSessionModel.findByPk(session.id) as ControlledTestSession;
      expect(sessionAfter.used_output_tokens).toBe(initialUsedOutput + 500);

      // Wrapper reports reconciled
      expect(result.ok).toBe(true);
      expect(result.usage?.reconciled).toBe(true);
      expect(result.usage?.actualOutputTokens).toBe(500);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MISSING USAGE_METADATA: No reconciliation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Missing usage_metadata', () => {
    it('skips reconciliation when usage_metadata is undefined', async () => {
      const session = await createActiveSession();

      // Create fake model with NO usage_metadata
      const fakeModel = createFakeModel({
        tokenEstimate: 100,
        responseContent: 'Test response',
        usageMetadata: undefined,
      });
      mockModelProvider.createControlledTestModel.mockReturnValue(fakeModel as any);

      const result = await budgetedInvoke({
        sessionId: session.id,
        prompt: 'Test prompt',
        purpose: 'm7b-e2e-no-metadata',
      });

      // Reservation remains unreonciled
      const reservations = await ControlledTestReservationModel.findAll({
        where: { session_id: session.id },
      });
      expect(reservations).toHaveLength(1);
      expect((reservations[0] as ControlledTestReservation).state).toBe('reserved');

      // Wrapper succeeds but not reconciled
      expect(result.ok).toBe(true);
      expect(result.usage?.reconciled).toBe(false);
      expect(result.usage?.actualOutputTokens).toBeUndefined();
    });
  });
});
