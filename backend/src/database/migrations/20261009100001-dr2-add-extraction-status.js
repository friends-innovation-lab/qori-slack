'use strict';

/**
 * Migration: DR-2 — Add insight extraction status tracking to discovery_artifacts
 *
 * Enables durable retry of insight extraction:
 * - extraction_status: tracks success/failed/pending
 * - extraction_attempted_at: when extraction was last attempted
 * - extraction_failure_reason: why extraction failed (for retry)
 * - extraction_insight_count: how many insights were created
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('discovery_artifacts', 'extraction_status', {
      type: Sequelize.STRING(20),
      allowNull: true,
      comment: 'Insight extraction status: pending, success, partial, failed, not_applicable',
    });

    await queryInterface.addColumn('discovery_artifacts', 'extraction_attempted_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When insight extraction was last attempted',
    });

    await queryInterface.addColumn('discovery_artifacts', 'extraction_failure_reason', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Reason for extraction failure (if failed or partial)',
    });

    await queryInterface.addColumn('discovery_artifacts', 'extraction_insight_count', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Number of insights successfully created',
    });

    // Index for finding artifacts needing extraction retry
    await queryInterface.addIndex('discovery_artifacts', ['extraction_status'], {
      name: 'idx_discovery_artifacts_extraction_status',
      where: {
        extraction_status: { [Sequelize.Op.in]: ['failed', 'partial'] },
      },
    });

    console.log('Added DR-2 extraction status tracking to discovery_artifacts');
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('discovery_artifacts', 'idx_discovery_artifacts_extraction_status');
    await queryInterface.removeColumn('discovery_artifacts', 'extraction_insight_count');
    await queryInterface.removeColumn('discovery_artifacts', 'extraction_failure_reason');
    await queryInterface.removeColumn('discovery_artifacts', 'extraction_attempted_at');
    await queryInterface.removeColumn('discovery_artifacts', 'extraction_status');

    console.log('Removed DR-2 extraction status columns');
  },
};
