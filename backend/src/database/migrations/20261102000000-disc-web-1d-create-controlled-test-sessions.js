'use strict';

/**
 * DISC-WEB-1D-2 M1: Create controlled_test_sessions table for AI execution budgeting.
 *
 * Controlled test sessions enforce hard limits on AI invocation during dev testing.
 * Each session binds to exactly ONE discovery run and tracks request/token budgets.
 *
 * Key invariants:
 * - At most one session with status='active' exists at any time (partial unique index)
 * - Each session binds to at most one run (unique constraint on discovery_run_id)
 * - A cancelled/exhausted/completed session's bound run is ALWAYS identifiable by run_id
 * - Budget reservation is atomic (UPDATE with preconditions)
 *
 * Status transitions:
 *   active → cancelled (manual abort)
 *   active → exhausted (budget depleted)
 *   active → completed (run finished successfully)
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create controlled_test_sessions table
    await queryInterface.createTable('controlled_test_sessions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      public_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
        comment: 'Public identifier for API/UI references',
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'active',
        comment: 'Session status: active, cancelled, exhausted, completed',
      },

      // Run binding — nullable until bound, then immutable
      discovery_run_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'discovery_runs', key: 'id' },
        onDelete: 'SET NULL',
        comment: 'Bound discovery run (null until run starts, immutable once set)',
      },

      // Budget limits (immutable after creation)
      max_requests: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Maximum AI requests allowed (immutable)',
      },
      max_input_tokens: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Maximum input tokens allowed (immutable)',
      },
      max_output_tokens: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Maximum output tokens allowed (immutable)',
      },

      // Usage tracking (atomically updated during reservation/reconciliation)
      used_requests: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Requests consumed (incremented atomically on each invoke)',
      },
      used_input_tokens: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Input tokens consumed (updated during reconciliation)',
      },
      used_output_tokens: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Output tokens consumed (updated during reconciliation)',
      },

      // Actor who created the session
      created_by_actor_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'actors', key: 'id' },
        onDelete: 'SET NULL',
        comment: 'Actor who created this controlled test session',
      },

      // Terminal state metadata
      cancellation_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Reason for cancellation (if status=cancelled)',
      },

      // Timestamps
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      cancelled_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when session was cancelled',
      },
      exhausted_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when budget was exhausted',
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Timestamp when bound run completed successfully',
      },
    });

    // 2. CHECK constraint for status values
    await queryInterface.sequelize.query(`
      ALTER TABLE controlled_test_sessions
      ADD CONSTRAINT controlled_test_sessions_status_check
      CHECK (status IN ('active', 'cancelled', 'exhausted', 'completed'))
    `);

    // 3. CHECK constraint: budget limits must be positive
    await queryInterface.sequelize.query(`
      ALTER TABLE controlled_test_sessions
      ADD CONSTRAINT controlled_test_sessions_budget_positive_check
      CHECK (max_requests > 0 AND max_input_tokens > 0 AND max_output_tokens > 0)
    `);

    // 4. CHECK constraint: usage cannot exceed limits
    await queryInterface.sequelize.query(`
      ALTER TABLE controlled_test_sessions
      ADD CONSTRAINT controlled_test_sessions_usage_within_budget_check
      CHECK (
        used_requests <= max_requests AND
        used_input_tokens <= max_input_tokens AND
        used_output_tokens <= max_output_tokens
      )
    `);

    // 5. CHECK constraint: terminal timestamps consistent with status
    await queryInterface.sequelize.query(`
      ALTER TABLE controlled_test_sessions
      ADD CONSTRAINT controlled_test_sessions_terminal_timestamps_check
      CHECK (
        (status = 'cancelled' AND cancelled_at IS NOT NULL) OR
        (status = 'exhausted' AND exhausted_at IS NOT NULL) OR
        (status = 'completed' AND completed_at IS NOT NULL) OR
        (status = 'active' AND cancelled_at IS NULL AND exhausted_at IS NULL AND completed_at IS NULL)
      )
    `);

    // 6. Partial unique index: at most one active session
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX controlled_test_sessions_single_active_idx
      ON controlled_test_sessions (status)
      WHERE status = 'active'
    `);

    // 7. Unique index on discovery_run_id (non-null only) — each run binds to at most one session
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX controlled_test_sessions_discovery_run_id_unique_idx
      ON controlled_test_sessions (discovery_run_id)
      WHERE discovery_run_id IS NOT NULL
    `);

    // 8. Index for lookup by public_id
    await queryInterface.addIndex('controlled_test_sessions', ['public_id'], {
      name: 'controlled_test_sessions_public_id_idx',
    });

    // 9. Index for lookup by discovery_run_id (for run → session lookup)
    await queryInterface.addIndex('controlled_test_sessions', ['discovery_run_id'], {
      name: 'controlled_test_sessions_discovery_run_id_idx',
    });

    // 10. Index for status queries
    await queryInterface.addIndex('controlled_test_sessions', ['status'], {
      name: 'controlled_test_sessions_status_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('controlled_test_sessions');
  },
};
