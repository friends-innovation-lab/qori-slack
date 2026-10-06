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
 * Historical runs: marker_index is nullable for legacy records that predate DISC-3B.
 * New runs receive a marker at creation time.
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

      // 5. Backfill marker_index for existing runs (by creation order within project/type)
      //    This is safe because we're assigning deterministically by created_at order
      await queryInterface.sequelize.query(
        `WITH ranked AS (
          SELECT id, project_id, discovery_type,
                 ROW_NUMBER() OVER (
                   PARTITION BY project_id, discovery_type
                   ORDER BY created_at ASC
                 ) AS rn
          FROM discovery_runs
          WHERE marker_index IS NULL
        )
        UPDATE discovery_runs dr
        SET marker_index = r.rn
        FROM ranked r
        WHERE dr.id = r.id`,
        { transaction }
      );

      // 6. Initialize counters for existing project/type combinations
      await queryInterface.sequelize.query(
        `INSERT INTO discovery_marker_counters (project_id, discovery_type, next_index, created_at, updated_at)
         SELECT project_id, discovery_type, COALESCE(MAX(marker_index), 0) + 1, NOW(), NOW()
         FROM discovery_runs
         WHERE marker_index IS NOT NULL
         GROUP BY project_id, discovery_type
         ON CONFLICT (project_id, discovery_type) DO UPDATE
         SET next_index = EXCLUDED.next_index,
             updated_at = NOW()`,
        { transaction }
      );

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
