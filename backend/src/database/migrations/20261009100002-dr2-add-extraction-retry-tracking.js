'use strict';

/**
 * Migration: DR-2 — Add extraction retry tracking to discovery_artifacts
 *
 * Enables bounded retry of failed/partial insight extractions:
 * - extraction_attempt_count: tracks retry attempts
 * - extraction_next_retry_at: when to retry (exponential backoff)
 * - extraction_permanent_failure: flag for non-retryable errors
 * - extraction_claimed_by: worker ID for atomic claims
 * - extraction_claimed_at: claim timestamp for expiry recovery
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('discovery_artifacts', 'extraction_attempt_count', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Number of extraction attempts (including initial)',
    });

    await queryInterface.addColumn('discovery_artifacts', 'extraction_next_retry_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When to retry extraction (exponential backoff)',
    });

    await queryInterface.addColumn('discovery_artifacts', 'extraction_permanent_failure', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'True if extraction failed with non-retryable error',
    });

    await queryInterface.addColumn('discovery_artifacts', 'extraction_claimed_by', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Worker ID holding extraction retry claim',
    });

    await queryInterface.addColumn('discovery_artifacts', 'extraction_claimed_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When extraction retry was claimed (for expiry recovery)',
    });

    // Index for finding artifacts eligible for extraction retry
    await queryInterface.addIndex('discovery_artifacts',
      ['extraction_status', 'extraction_permanent_failure', 'extraction_next_retry_at'],
      {
        name: 'idx_discovery_artifacts_extraction_retry_eligible',
        where: {
          extraction_status: { [Sequelize.Op.in]: ['failed', 'partial'] },
          extraction_permanent_failure: false,
        },
      }
    );

    // Index for claim expiry recovery
    await queryInterface.addIndex('discovery_artifacts', ['extraction_claimed_at'], {
      name: 'idx_discovery_artifacts_extraction_claimed',
      where: { extraction_claimed_by: { [Sequelize.Op.ne]: null } },
    });

    console.log('Added DR-2 extraction retry tracking columns to discovery_artifacts');
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('discovery_artifacts', 'idx_discovery_artifacts_extraction_claimed');
    await queryInterface.removeIndex('discovery_artifacts', 'idx_discovery_artifacts_extraction_retry_eligible');
    await queryInterface.removeColumn('discovery_artifacts', 'extraction_claimed_at');
    await queryInterface.removeColumn('discovery_artifacts', 'extraction_claimed_by');
    await queryInterface.removeColumn('discovery_artifacts', 'extraction_permanent_failure');
    await queryInterface.removeColumn('discovery_artifacts', 'extraction_next_retry_at');
    await queryInterface.removeColumn('discovery_artifacts', 'extraction_attempt_count');

    console.log('Removed DR-2 extraction retry tracking columns');
  },
};
