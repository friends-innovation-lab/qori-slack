'use strict';

/**
 * Migration: DR-6b-5a — Add generation claim columns
 *
 * Extends desk_research_readout_versions with worker claim infrastructure:
 * - Idempotency key for request deduplication
 * - Actor tracking for audit
 * - Worker claim fields for distributed execution
 * - Retry tracking with bounded attempts
 *
 * Uses the same pattern as Discovery runs (DISC-2) for consistency.
 *
 * BACKFILL: Existing rows will have NULL for all new nullable columns.
 * attempt_count defaults to 0. No data migration required.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // ─── Add columns ───────────────────────────────────────────────

    // Idempotency key for request deduplication (per readout + actor)
    await queryInterface.addColumn('desk_research_readout_versions', 'idempotency_key', {
      type: Sequelize.STRING(64),
      allowNull: true,
      comment: 'Client-generated idempotency key (scoped to readout + actor)',
    });

    // Actor who requested this generation
    await queryInterface.addColumn('desk_research_readout_versions', 'requested_by_actor_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'actors', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Actor who initiated the generation request',
    });

    // Worker claim fields (matches Discovery pattern)
    await queryInterface.addColumn('desk_research_readout_versions', 'worker_id', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Worker identity that claimed this job (format: readout-gen-{uuid})',
    });

    await queryInterface.addColumn('desk_research_readout_versions', 'claimed_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When the worker claimed this job',
    });

    await queryInterface.addColumn('desk_research_readout_versions', 'heartbeat_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Last heartbeat from the owning worker',
    });

    // Retry tracking
    await queryInterface.addColumn('desk_research_readout_versions', 'attempt_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Number of execution attempts (0 = not yet attempted)',
    });

    await queryInterface.addColumn('desk_research_readout_versions', 'last_error_code', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Machine-readable error code from last failed attempt',
    });

    // ─── Add indexes ───────────────────────────────────────────────

    // Idempotency constraint: unique per readout + actor + key
    // This allows different actors to use the same key for different requests
    await queryInterface.addIndex('desk_research_readout_versions',
      ['readout_id', 'requested_by_actor_id', 'idempotency_key'], {
      name: 'uq_readout_version_idempotency',
      unique: true,
      where: { idempotency_key: { [Sequelize.Op.ne]: null } },
    });

    // Worker claim lookup for polling
    await queryInterface.addIndex('desk_research_readout_versions',
      ['generation_status', 'heartbeat_at'], {
      name: 'idx_readout_version_claim_status',
      where: { generation_status: { [Sequelize.Op.in]: ['pending', 'generating'] } },
    });

    // ─── Add constraints ───────────────────────────────────────────

    // Attempt count must be non-negative
    await queryInterface.sequelize.query(`
      ALTER TABLE desk_research_readout_versions
      ADD CONSTRAINT chk_version_attempt_count_non_negative
      CHECK (attempt_count >= 0)
    `);

    // Claimed jobs must have worker_id
    await queryInterface.sequelize.query(`
      ALTER TABLE desk_research_readout_versions
      ADD CONSTRAINT chk_version_claimed_has_worker
      CHECK (
        (claimed_at IS NULL AND worker_id IS NULL AND heartbeat_at IS NULL)
        OR (claimed_at IS NOT NULL AND worker_id IS NOT NULL)
      )
    `);

    console.log('Added generation claim columns to desk_research_readout_versions');
  },

  async down(queryInterface) {
    // Drop constraints first
    await queryInterface.sequelize.query(`
      ALTER TABLE desk_research_readout_versions
      DROP CONSTRAINT IF EXISTS chk_version_claimed_has_worker
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE desk_research_readout_versions
      DROP CONSTRAINT IF EXISTS chk_version_attempt_count_non_negative
    `);

    // Drop indexes
    await queryInterface.removeIndex('desk_research_readout_versions', 'idx_readout_version_claim_status');
    await queryInterface.removeIndex('desk_research_readout_versions', 'uq_readout_version_idempotency');

    // Drop columns
    await queryInterface.removeColumn('desk_research_readout_versions', 'last_error_code');
    await queryInterface.removeColumn('desk_research_readout_versions', 'attempt_count');
    await queryInterface.removeColumn('desk_research_readout_versions', 'heartbeat_at');
    await queryInterface.removeColumn('desk_research_readout_versions', 'claimed_at');
    await queryInterface.removeColumn('desk_research_readout_versions', 'worker_id');
    await queryInterface.removeColumn('desk_research_readout_versions', 'requested_by_actor_id');
    await queryInterface.removeColumn('desk_research_readout_versions', 'idempotency_key');

    console.log('Removed generation claim columns from desk_research_readout_versions');
  },
};
