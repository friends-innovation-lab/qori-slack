'use strict';

/**
 * M9a: Add project binding and idempotency columns to controlled_test_sessions.
 *
 * DISC-WEB-1D-2 M9a: Controlled Session Creation API
 *
 * Changes:
 * - project_id: FK to projects with ON DELETE RESTRICT (preserve project identity)
 * - idempotency_key: Client-provided UUID for duplicate detection
 * - idempotency_payload_hash: SHA-256 of canonical budget for conflict detection
 * - Composite unique partial index on (created_by_actor_id, project_id, idempotency_key)
 *
 * Preserves existing session records by making all new columns nullable.
 * Legacy sessions with null project_id retain previous behavior.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add project_id column with ON DELETE RESTRICT
    // Nullable for existing sessions (legacy compatibility)
    await queryInterface.addColumn('controlled_test_sessions', 'project_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'projects', key: 'id' },
      onDelete: 'RESTRICT',
      comment: 'Project context for the session (required for new sessions via API)',
    });

    // 2. Add idempotency_key column
    await queryInterface.addColumn('controlled_test_sessions', 'idempotency_key', {
      type: Sequelize.UUID,
      allowNull: true,
      comment: 'Client-provided idempotency key for duplicate detection',
    });

    // 3. Add idempotency_payload_hash column
    await queryInterface.addColumn('controlled_test_sessions', 'idempotency_payload_hash', {
      type: Sequelize.STRING(64),
      allowNull: true,
      comment: 'SHA-256 hash of canonical budget payload for conflict detection',
    });

    // 4. Composite unique partial index: (created_by_actor_id, project_id, idempotency_key)
    // Partial index: only applies when all three are non-null
    // This safely ignores legacy rows with null values
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX controlled_test_sessions_actor_project_idempotency_key_idx
      ON controlled_test_sessions (created_by_actor_id, project_id, idempotency_key)
      WHERE created_by_actor_id IS NOT NULL
        AND project_id IS NOT NULL
        AND idempotency_key IS NOT NULL
    `);

    // 5. Index for project lookup
    await queryInterface.addIndex('controlled_test_sessions', ['project_id'], {
      name: 'controlled_test_sessions_project_id_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS controlled_test_sessions_actor_project_idempotency_key_idx
    `);
    await queryInterface.removeIndex(
      'controlled_test_sessions',
      'controlled_test_sessions_project_id_idx',
    );
    await queryInterface.removeColumn('controlled_test_sessions', 'idempotency_payload_hash');
    await queryInterface.removeColumn('controlled_test_sessions', 'idempotency_key');
    await queryInterface.removeColumn('controlled_test_sessions', 'project_id');
  },
};
