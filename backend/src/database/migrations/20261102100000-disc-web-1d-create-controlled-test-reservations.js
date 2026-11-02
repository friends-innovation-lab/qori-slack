'use strict';

/**
 * DISC-WEB-1D-2 M3 Safety Fix: Create controlled_test_reservations table.
 *
 * Each reservation represents a single atomic budget allocation within a session.
 * Reservations track:
 * - Reserved input/output tokens at creation
 * - Actual output tokens after reconciliation
 * - State transition: reserved → reconciled
 *
 * Key invariants:
 * - Each reservation belongs to exactly one session
 * - A reservation can only be reconciled once (state=reserved → reconciled)
 * - Reconciliation is idempotent at the database level
 * - Unused output allocation is released only on first reconciliation
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Create controlled_test_reservations table
    await queryInterface.createTable('controlled_test_reservations', {
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
        comment: 'Public identifier for API references',
      },

      // Session binding (immutable)
      session_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'controlled_test_sessions', key: 'id' },
        onDelete: 'CASCADE',
        comment: 'Parent controlled test session',
      },

      // State: reserved (budget allocated, not yet reconciled) or reconciled (budget finalized)
      state: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'reserved',
        comment: 'Reservation state: reserved or reconciled',
      },

      // Reserved amounts (immutable, set at creation)
      reserved_input_tokens: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Input tokens reserved for this request (immutable)',
      },
      reserved_output_tokens: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Output tokens reserved for this request (immutable)',
      },

      // Actual amounts (set during reconciliation)
      actual_input_tokens: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Actual input tokens reported by provider (set on reconciliation)',
      },
      actual_output_tokens: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Actual output tokens reported by provider (set on reconciliation)',
      },

      // Purpose/provenance (optional)
      purpose: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Human-readable purpose for logging/debugging',
      },

      // Timestamps
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'When the reservation was created',
      },
      reconciled_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the reservation was reconciled (null if still reserved)',
      },
    });

    // 2. CHECK constraint for state values
    await queryInterface.sequelize.query(`
      ALTER TABLE controlled_test_reservations
      ADD CONSTRAINT controlled_test_reservations_state_check
      CHECK (state IN ('reserved', 'reconciled'))
    `);

    // 3. CHECK constraint: reserved tokens must be positive
    await queryInterface.sequelize.query(`
      ALTER TABLE controlled_test_reservations
      ADD CONSTRAINT controlled_test_reservations_reserved_positive_check
      CHECK (reserved_input_tokens > 0 AND reserved_output_tokens > 0)
    `);

    // 4. CHECK constraint: actual tokens must be non-negative when set
    await queryInterface.sequelize.query(`
      ALTER TABLE controlled_test_reservations
      ADD CONSTRAINT controlled_test_reservations_actual_nonnegative_check
      CHECK (
        (actual_input_tokens IS NULL OR actual_input_tokens >= 0) AND
        (actual_output_tokens IS NULL OR actual_output_tokens >= 0)
      )
    `);

    // 5. CHECK constraint: reconciled state must have actual_output_tokens and reconciled_at
    await queryInterface.sequelize.query(`
      ALTER TABLE controlled_test_reservations
      ADD CONSTRAINT controlled_test_reservations_reconciled_complete_check
      CHECK (
        (state = 'reconciled' AND actual_output_tokens IS NOT NULL AND reconciled_at IS NOT NULL) OR
        (state = 'reserved' AND reconciled_at IS NULL)
      )
    `);

    // 6. Index for session lookups
    await queryInterface.addIndex('controlled_test_reservations', ['session_id'], {
      name: 'controlled_test_reservations_session_id_idx',
    });

    // 7. Index for state queries (finding unreconciled reservations)
    await queryInterface.addIndex('controlled_test_reservations', ['state'], {
      name: 'controlled_test_reservations_state_idx',
    });

    // 8. Index for public_id lookups
    await queryInterface.addIndex('controlled_test_reservations', ['public_id'], {
      name: 'controlled_test_reservations_public_id_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('controlled_test_reservations');
  },
};
