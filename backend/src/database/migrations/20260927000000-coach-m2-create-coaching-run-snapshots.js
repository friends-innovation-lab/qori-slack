'use strict';

/**
 * Coach M2: Create coaching_run_snapshots table.
 *
 * Stores immutable artifact content snapshot at run creation time.
 * This ensures Coach can execute against the exact content the researcher
 * requested, even if the artifact is later edited before execution.
 *
 * Key design:
 * - One immutable snapshot per run
 * - Captured transactionally with run creation
 * - Contains canonical structured content (not TipTap/HTML/Markdown)
 * - Execution snapshot, not a new canonical source of truth
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('coaching_run_snapshots', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4,
      },
      run_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true, // One snapshot per run
        references: {
          model: 'coaching_runs',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      snapshot_schema_version: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: '1.0.0',
        comment: 'Schema version for canonical_snapshot_json format',
      },
      artifact_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      artifact_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Artifact internal ID at snapshot time',
      },
      artifact_public_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'Artifact public ID for provenance',
      },
      content_version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Exact content_version captured',
      },
      canonical_snapshot_json: {
        type: Sequelize.JSONB,
        allowNull: false,
        comment: 'Structured artifact content at snapshot time',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    // Index for run lookup (covered by unique constraint, but explicit for clarity)
    await queryInterface.addIndex('coaching_run_snapshots', ['run_id'], {
      name: 'idx_coaching_run_snapshots_run_id',
    });

    // Index for artifact lookup (debugging, audit)
    await queryInterface.addIndex('coaching_run_snapshots', ['artifact_id', 'content_version'], {
      name: 'idx_coaching_run_snapshots_artifact_version',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('coaching_run_snapshots');
  },
};
