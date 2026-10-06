'use strict';

/**
 * DISC-3B: Add marker_index to discovery_runs for stable D/S/V markers.
 *
 * Marker identity belongs to the DiscoveryRun (not Artifact) because:
 * - One marker per run
 * - Multiple artifact versions per run retain the same marker
 *
 * Concurrency protection via unique constraint on (project_id, discovery_type, marker_index).
 * Allocation uses atomic UPDATE ... RETURNING pattern on a counter table.
 *
 * Historical runs: marker_index is NULL for legacy records that predate DISC-3B.
 * LOCKED RULE: No backfill — historical D/S/V identity cannot be fabricated from
 * created_at order, topic slug, or any inferred ordering.
 *
 * New runs after this migration receive durable markers starting at 1.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // 1. Add marker_index column to discovery_runs (nullable for historical)
      await queryInterface.addColumn(
        'discovery_runs',
        'marker_index',
        {
          type: Sequelize.INTEGER,
          allowNull: true, // Nullable for historical runs
        },
        { transaction }
      );

      // 2. Create unique constraint for (project_id, discovery_type, marker_index)
      //    Using partial index to allow NULLs for historical runs
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX idx_discovery_runs_marker_unique
         ON discovery_runs (project_id, discovery_type, marker_index)
         WHERE marker_index IS NOT NULL`,
        { transaction }
      );

      // 3. Create marker counter table for atomic allocation
      await queryInterface.createTable(
        'discovery_marker_counters',
        {
          id: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          project_id: {
            type: Sequelize.INTEGER,
            allowNull: false,
            references: { model: 'projects', key: 'id' },
            onDelete: 'CASCADE',
          },
          discovery_type: {
            type: Sequelize.STRING(30),
            allowNull: false,
          },
          next_index: {
            type: Sequelize.INTEGER,
            allowNull: false,
            defaultValue: 1,
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: false,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
          },
        },
        { transaction }
      );

      // 4. Unique constraint on counter table
      await queryInterface.addIndex(
        'discovery_marker_counters',
        ['project_id', 'discovery_type'],
        {
          unique: true,
          name: 'idx_marker_counters_unique',
          transaction,
        }
      );

      // 5. Historical runs: marker_index intentionally left NULL
      //    LOCKED RULE: Do NOT fabricate historical D/S/V identity from:
      //    - current list position
      //    - topic slug
      //    - GitHub filename
      //    - arbitrary row ordering (including created_at)
      //
      //    Historical runs have no pre-existing canonical marker identity.
      //    New runs after this migration receive durable markers starting at 1.
      //    Counter table starts empty; first allocation per project/type creates row.
      //
      //    NO BACKFILL. Historical marker_index remains NULL.

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();

    try {
      // Drop counter table
      await queryInterface.dropTable('discovery_marker_counters', { transaction });

      // Drop unique index
      await queryInterface.sequelize.query(
        'DROP INDEX IF EXISTS idx_discovery_runs_marker_unique',
        { transaction }
      );

      // Remove marker_index column
      await queryInterface.removeColumn('discovery_runs', 'marker_index', { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
