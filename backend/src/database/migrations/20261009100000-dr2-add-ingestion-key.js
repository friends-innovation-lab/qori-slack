'use strict';

/**
 * Migration: DR-2 — Add ingestion_key for idempotent insight extraction
 *
 * Enables idempotent AI insight extraction:
 * - Same extraction retry produces no duplicate insights
 * - Concurrent workers cannot create duplicates
 *
 * ingestion_key format: {discovery_run_id}:{variable_key}:{item_id}
 * Example: run_123:discovered_barriers:barrier-001
 *
 * Partial unique constraint: only enforced when ingestion_key is NOT NULL.
 * This allows existing constructs (without ingestion tracking) to remain unaffected.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add ingestion_key column
    await queryInterface.addColumn('evidence_constructs', 'ingestion_key', {
      type: Sequelize.STRING(200),
      allowNull: true,
      comment: 'Idempotency key for AI-extracted insights. Format: {run_id}:{variable_key}:{item_id}',
    });

    // Create partial unique index for idempotency
    // Only applies when ingestion_key is NOT NULL
    await queryInterface.addIndex('evidence_constructs', ['project_id', 'ingestion_key'], {
      name: 'idx_evidence_constructs_project_ingestion_key',
      unique: true,
      where: { ingestion_key: { [Sequelize.Op.ne]: null } },
    });

    console.log('Added ingestion_key column with partial unique constraint for DR-2');
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('evidence_constructs', 'idx_evidence_constructs_project_ingestion_key');
    await queryInterface.removeColumn('evidence_constructs', 'ingestion_key');

    console.log('Removed DR-2 ingestion_key column');
  },
};
