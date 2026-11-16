'use strict';

/**
 * DISC-WEB-2: Add session_type discriminator for researcher vs supervised sessions.
 *
 * This migration enables researcher-controlled execution to coexist with M10 supervised
 * execution by distinguishing session types:
 *
 * - 'supervised': M10 controlled test sessions (global singleton preserved)
 * - 'researcher': Web researcher sessions (one active per actor)
 *
 * Key design decisions:
 * 1. Existing records default to 'supervised' (backward compatible)
 * 2. Global singleton index is replaced with type-specific indexes
 * 3. Researcher sessions use per-actor constraint (created_by_actor_id)
 * 4. Both session types share the same budget enforcement infrastructure
 *
 * Rollback is safe: removes new column and recreates original global singleton index.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // ═══════════════════════════════════════════════════════════════════════════
    // Step 1: Add session_type column with default 'supervised'
    // ═══════════════════════════════════════════════════════════════════════════
    await queryInterface.addColumn('controlled_test_sessions', 'session_type', {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: 'supervised',
      comment: 'Session type: supervised (M10 global singleton) or researcher (per-actor)',
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // Step 2: Add CHECK constraint for valid session types
    // ═══════════════════════════════════════════════════════════════════════════
    await queryInterface.sequelize.query(`
      ALTER TABLE controlled_test_sessions
      ADD CONSTRAINT controlled_test_sessions_session_type_check
      CHECK (session_type IN ('supervised', 'researcher'))
    `);

    // ═══════════════════════════════════════════════════════════════════════════
    // Step 3: Drop existing global singleton index
    // ═══════════════════════════════════════════════════════════════════════════
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS controlled_test_sessions_single_active_idx
    `);

    // ═══════════════════════════════════════════════════════════════════════════
    // Step 4: Create supervised singleton index (preserves M10 invariant)
    // Only ONE active supervised session can exist at any time
    // ═══════════════════════════════════════════════════════════════════════════
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX controlled_test_sessions_single_active_supervised_idx
      ON controlled_test_sessions ((1))
      WHERE status = 'active' AND session_type = 'supervised'
    `);

    // ═══════════════════════════════════════════════════════════════════════════
    // Step 5: Create researcher per-actor index
    // ONE active researcher session per actor
    // ═══════════════════════════════════════════════════════════════════════════
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX controlled_test_sessions_single_active_researcher_idx
      ON controlled_test_sessions (created_by_actor_id)
      WHERE status = 'active' AND session_type = 'researcher'
    `);

    // ═══════════════════════════════════════════════════════════════════════════
    // Step 6: Add index for session type queries
    // ═══════════════════════════════════════════════════════════════════════════
    await queryInterface.addIndex('controlled_test_sessions', ['session_type', 'status'], {
      name: 'controlled_test_sessions_type_status_idx',
    });
  },

  async down(queryInterface) {
    // ═══════════════════════════════════════════════════════════════════════════
    // Rollback: Remove new indexes and column, restore original global singleton
    // ═══════════════════════════════════════════════════════════════════════════

    // Drop new indexes
    await queryInterface.removeIndex(
      'controlled_test_sessions',
      'controlled_test_sessions_type_status_idx'
    );

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS controlled_test_sessions_single_active_researcher_idx
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS controlled_test_sessions_single_active_supervised_idx
    `);

    // Drop CHECK constraint
    await queryInterface.sequelize.query(`
      ALTER TABLE controlled_test_sessions
      DROP CONSTRAINT IF EXISTS controlled_test_sessions_session_type_check
    `);

    // Remove column
    await queryInterface.removeColumn('controlled_test_sessions', 'session_type');

    // Restore original global singleton index
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX controlled_test_sessions_single_active_idx
      ON controlled_test_sessions (status)
      WHERE status = 'active'
    `);
  },
};
