/**
 * M7b Budget Metadata Verification Tests — DISC-WEB-1D-2
 *
 * Tests that malformed provider usage metadata does not corrupt budget state.
 *
 * Invariant: "No refund or counter corruption from unreliable usage metadata"
 *
 * Test Matrix:
 * - NaN output_tokens → service throws → wrapper catches → no reconciliation
 * - Infinity output_tokens → service throws → wrapper catches → no reconciliation
 * - Negative output_tokens → service throws → wrapper catches → no reconciliation
 * - String output_tokens → service throws → wrapper catches → no reconciliation
 * - Fractional output_tokens → floor'd and reconciled conservatively
 */

import { getTestDb, truncateAll, TEST_ORG_ID } from './setup/testDb';
import type { Sequelize, Transaction } from 'sequelize';
import type { CreationAttributes } from 'sequelize';

import type { Organization } from '../../database/models/organization';
import type { Project } from '../../database/models/project';
import type { Actor } from '../../database/models/actor';
import type { ControlledTestSession } from '../../database/models/controlled_test_session';
import type { ControlledTestReservation } from '../../database/models/controlled_test_reservation';

import {
  reserveBudget,
  reconcileUsage,
  InvalidBudgetInputError,
  type ReconcileUsageInput,
} from '../../services/controlled-test-budget.service';

describe('M7b Budget Metadata Verification — DISC-WEB-1D-2', () => {
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

    const OrganizationModel = sequelize.models.Organization as typeof Organization;
    testOrg = await OrganizationModel.findOne({ where: { slug: 'test-org' } }) as Organization;

    testActor = await ActorModel.create({
      display_name: 'M7b Budget Test Actor',
      organization_id: testOrg.id,
      status: 'active',
    }) as Actor;

    testProject = await ProjectModel.create({
      name: 'M7b Budget Test Project',
      slug: `m7b-budget-${Date.now()}`,
      created_by: testActor.public_id,
      organization_id: testOrg.id,
      status: 'active',
    }) as Project;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  // Helper to create session with reservation
  async function createSessionWithReservation(): Promise<{
    session: ControlledTestSession;
    reservation: ControlledTestReservation;
    initialUsedOutput: number;
  }> {
    // Create session with budget
    const session = await ControlledTestSessionModel.create({
      project_id: testProject.id,
      actor_id: testActor.id,
      status: 'active',
      max_requests: 10,
      max_input_tokens: 10000,
      max_output_tokens: 5000,
      used_requests: 0,
      used_input_tokens: 0,
      used_output_tokens: 0,
      purpose: 'm7b-budget-test',
      created_by_identity: 'test:m7b',
    } as CreationAttributes<ControlledTestSession>) as ControlledTestSession;

    // Make a reservation
    const reserveResult = await reserveBudget({
      sessionId: session.id,
      estimatedInputTokens: 100,
      reservedOutputTokens: 500, // Reserve 500 output tokens
      purpose: 'm7b-test-reservation',
    });

    if (!reserveResult.ok) {
      throw new Error(`Reservation failed: ${reserveResult.reason}`);
    }

    // Get updated session
    const updatedSession = await ControlledTestSessionModel.findByPk(session.id) as ControlledTestSession;

    // Get reservation
    const reservation = await ControlledTestReservationModel.findByPk(reserveResult.reservationId!) as ControlledTestReservation;

    return {
      session: updatedSession,
      reservation,
      initialUsedOutput: updatedSession.used_output_tokens,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MALFORMED OUTPUT TOKENS: Service rejects without mutation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Malformed output_tokens rejection', () => {
    it('rejects NaN output_tokens with InvalidBudgetInputError', async () => {
      const { session, reservation, initialUsedOutput } = await createSessionWithReservation();

      const reconcileInput: ReconcileUsageInput = {
        reservationId: reservation.id,
        actualInputTokens: 100,
        actualOutputTokens: NaN,
      };

      // Service should throw
      await expect(reconcileUsage(reconcileInput)).rejects.toThrow(InvalidBudgetInputError);
      await expect(reconcileUsage(reconcileInput)).rejects.toThrow('must be a finite number');

      // Verify budget counters unchanged
      const sessionAfter = await ControlledTestSessionModel.findByPk(session.id) as ControlledTestSession;
      expect(sessionAfter.used_output_tokens).toBe(initialUsedOutput);

      // Verify reservation not reconciled
      const reservationAfter = await ControlledTestReservationModel.findByPk(reservation.id) as ControlledTestReservation;
      expect(reservationAfter.state).toBe('reserved');
    });

    it('rejects Infinity output_tokens with InvalidBudgetInputError', async () => {
      const { session, reservation, initialUsedOutput } = await createSessionWithReservation();

      const reconcileInput: ReconcileUsageInput = {
        reservationId: reservation.id,
        actualInputTokens: 100,
        actualOutputTokens: Infinity,
      };

      await expect(reconcileUsage(reconcileInput)).rejects.toThrow(InvalidBudgetInputError);
      await expect(reconcileUsage(reconcileInput)).rejects.toThrow('must be a finite number');

      // Verify budget unchanged
      const sessionAfter = await ControlledTestSessionModel.findByPk(session.id) as ControlledTestSession;
      expect(sessionAfter.used_output_tokens).toBe(initialUsedOutput);

      // Verify reservation not reconciled
      const reservationAfter = await ControlledTestReservationModel.findByPk(reservation.id) as ControlledTestReservation;
      expect(reservationAfter.state).toBe('reserved');
    });

    it('rejects -Infinity output_tokens with InvalidBudgetInputError', async () => {
      const { session, reservation, initialUsedOutput } = await createSessionWithReservation();

      const reconcileInput: ReconcileUsageInput = {
        reservationId: reservation.id,
        actualInputTokens: 100,
        actualOutputTokens: -Infinity,
      };

      await expect(reconcileUsage(reconcileInput)).rejects.toThrow(InvalidBudgetInputError);

      // Verify budget unchanged
      const sessionAfter = await ControlledTestSessionModel.findByPk(session.id) as ControlledTestSession;
      expect(sessionAfter.used_output_tokens).toBe(initialUsedOutput);
    });

    it('rejects negative output_tokens with InvalidBudgetInputError', async () => {
      const { session, reservation, initialUsedOutput } = await createSessionWithReservation();

      const reconcileInput: ReconcileUsageInput = {
        reservationId: reservation.id,
        actualInputTokens: 100,
        actualOutputTokens: -100,
      };

      await expect(reconcileUsage(reconcileInput)).rejects.toThrow(InvalidBudgetInputError);
      await expect(reconcileUsage(reconcileInput)).rejects.toThrow('cannot be negative');

      // Verify budget unchanged
      const sessionAfter = await ControlledTestSessionModel.findByPk(session.id) as ControlledTestSession;
      expect(sessionAfter.used_output_tokens).toBe(initialUsedOutput);

      // Verify reservation not reconciled
      const reservationAfter = await ControlledTestReservationModel.findByPk(reservation.id) as ControlledTestReservation;
      expect(reservationAfter.state).toBe('reserved');
    });

    it('rejects string output_tokens with InvalidBudgetInputError', async () => {
      const { session, reservation, initialUsedOutput } = await createSessionWithReservation();

      const reconcileInput = {
        reservationId: reservation.id,
        actualInputTokens: 100,
        actualOutputTokens: '100' as unknown as number, // TypeScript bypass
      };

      await expect(reconcileUsage(reconcileInput)).rejects.toThrow(InvalidBudgetInputError);
      await expect(reconcileUsage(reconcileInput)).rejects.toThrow('must be a finite number');

      // Verify budget unchanged
      const sessionAfter = await ControlledTestSessionModel.findByPk(session.id) as ControlledTestSession;
      expect(sessionAfter.used_output_tokens).toBe(initialUsedOutput);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FRACTIONAL OUTPUT TOKENS: Floor'd conservatively
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Fractional output_tokens handling', () => {
    it('floors fractional output_tokens conservatively', async () => {
      const { session, reservation, initialUsedOutput } = await createSessionWithReservation();

      // Reservation reserved 500 output tokens
      // Actual usage: 250.7 → should floor to 250
      // Release: 500 - 250 = 250 tokens
      const reconcileInput: ReconcileUsageInput = {
        reservationId: reservation.id,
        actualInputTokens: 100,
        actualOutputTokens: 250.7,
      };

      const result = await reconcileUsage(reconcileInput);

      expect(result.ok).toBe(true);
      expect(result.alreadyReconciled).toBe(false);
      expect(result.tokensReleased).toBe(250); // 500 - floor(250.7)

      // Verify reservation marked reconciled with floor'd value
      const reservationAfter = await ControlledTestReservationModel.findByPk(reservation.id) as ControlledTestReservation;
      expect(reservationAfter.state).toBe('reconciled');
      expect(reservationAfter.actual_output_tokens).toBe(250);

      // Verify session budget updated correctly
      const sessionAfter = await ControlledTestSessionModel.findByPk(session.id) as ControlledTestSession;
      // used_output = initial - released = 500 - 250 = 250
      expect(sessionAfter.used_output_tokens).toBe(initialUsedOutput - 250);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // VALID OUTPUT TOKENS: Normal reconciliation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Valid output_tokens handling', () => {
    it('reconciles zero output_tokens correctly', async () => {
      const { session, reservation, initialUsedOutput } = await createSessionWithReservation();

      const reconcileInput: ReconcileUsageInput = {
        reservationId: reservation.id,
        actualInputTokens: 100,
        actualOutputTokens: 0, // Empty response
      };

      const result = await reconcileUsage(reconcileInput);

      expect(result.ok).toBe(true);
      expect(result.tokensReleased).toBe(500); // All reserved tokens released

      // Verify session budget
      const sessionAfter = await ControlledTestSessionModel.findByPk(session.id) as ControlledTestSession;
      expect(sessionAfter.used_output_tokens).toBe(0);
    });

    it('reconciles exact reserved amount correctly', async () => {
      const { session, reservation, initialUsedOutput } = await createSessionWithReservation();

      const reconcileInput: ReconcileUsageInput = {
        reservationId: reservation.id,
        actualInputTokens: 100,
        actualOutputTokens: 500, // Exact reserved amount
      };

      const result = await reconcileUsage(reconcileInput);

      expect(result.ok).toBe(true);
      expect(result.tokensReleased).toBe(0); // No release needed

      // Verify session budget unchanged
      const sessionAfter = await ControlledTestSessionModel.findByPk(session.id) as ControlledTestSession;
      expect(sessionAfter.used_output_tokens).toBe(initialUsedOutput);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // IDEMPOTENCY: Duplicate reconciliation
  // ═══════════════════════════════════════════════════════════════════════════

  describe('Reconciliation idempotency', () => {
    it('handles duplicate reconciliation calls idempotently', async () => {
      const { session, reservation, initialUsedOutput } = await createSessionWithReservation();

      const reconcileInput: ReconcileUsageInput = {
        reservationId: reservation.id,
        actualInputTokens: 100,
        actualOutputTokens: 300,
      };

      // First reconciliation
      const result1 = await reconcileUsage(reconcileInput);
      expect(result1.ok).toBe(true);
      expect(result1.alreadyReconciled).toBe(false);
      expect(result1.tokensReleased).toBe(200); // 500 - 300

      const sessionAfterFirst = await ControlledTestSessionModel.findByPk(session.id) as ControlledTestSession;
      const usedAfterFirst = sessionAfterFirst.used_output_tokens;

      // Second reconciliation (idempotent)
      const result2 = await reconcileUsage(reconcileInput);
      expect(result2.ok).toBe(true);
      expect(result2.alreadyReconciled).toBe(true);
      expect(result2.tokensReleased).toBe(0); // No additional release

      // Verify budget unchanged by duplicate call
      const sessionAfterSecond = await ControlledTestSessionModel.findByPk(session.id) as ControlledTestSession;
      expect(sessionAfterSecond.used_output_tokens).toBe(usedAfterFirst);
    });
  });
});
