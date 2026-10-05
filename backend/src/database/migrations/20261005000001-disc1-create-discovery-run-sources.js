'use strict';

/**
 * Migration: DISC-1 — Create discovery_run_sources join table
 *
 * Relational join between DiscoveryRun and EvidenceSource.
 * One run may have 1..N sources; one source may participate in multiple runs.
 *
 * Constraints:
 *   - Duplicate (run_id, source_id) prevented by unique index
 *   - source_order is deterministic (order of upload/association)
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('discovery_run_sources', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      discovery_run_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'discovery_runs', key: 'id' },
        onDelete: 'CASCADE',
        comment: 'FK to discovery_runs',
      },

      evidence_source_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'evidence_sources', key: 'id' },
        onDelete: 'CASCADE',
        comment: 'FK to evidence_sources',
      },

      source_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Deterministic order of sources within the run',
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Unique constraint: no duplicate associations
    await queryInterface.addIndex('discovery_run_sources', ['discovery_run_id', 'evidence_source_id'], {
      name: 'idx_discovery_run_sources_unique',
      unique: true,
    });

    // Index for efficient source lookup
    await queryInterface.addIndex('discovery_run_sources', ['evidence_source_id'], {
      name: 'idx_discovery_run_sources_source',
    });

    // Index for ordered source retrieval
    await queryInterface.addIndex('discovery_run_sources', ['discovery_run_id', 'source_order'], {
      name: 'idx_discovery_run_sources_order',
    });

    console.log('Created discovery_run_sources join table');
  },

  async down(queryInterface) {
    await queryInterface.dropTable('discovery_run_sources');
    console.log('Dropped discovery_run_sources join table');
  },
};
