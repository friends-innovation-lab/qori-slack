'use strict';

/**
 * Migration: DISC-WEB-1 — Add idempotency columns to discovery_runs
 *
 * Enables idempotent run creation via X-Idempotency-Key header.
 * Key binding is PERMANENT — never nullified (per v3.1 amendment 1.2.1).
 *
 * idempotency_key: Client-provided UUID (required for sourceRefs path)
 * payload_fingerprint: SHA-256 of normalized request for conflict detection
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('discovery_runs', 'idempotency_key', {
      type: Sequelize.UUID,
      allowNull: true, // Nullable for legacy/Slack runs
      comment: 'Client-provided idempotency key (permanent binding)',
    });

    await queryInterface.addColumn('discovery_runs', 'payload_fingerprint', {
      type: Sequelize.CHAR(64),
      allowNull: true,
      comment: 'SHA-256 of normalized request payload for conflict detection',
    });

    // Partial unique index for idempotency within project scope
    // Only includes rows where idempotency_key IS NOT NULL
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX idx_discovery_runs_idempotency
      ON discovery_runs (project_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL
    `);

    console.log('Added idempotency columns to discovery_runs for DISC-WEB-1');
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_discovery_runs_idempotency
    `);
    await queryInterface.removeColumn('discovery_runs', 'payload_fingerprint');
    await queryInterface.removeColumn('discovery_runs', 'idempotency_key');
    console.log('Removed idempotency columns from discovery_runs');
  },
};
