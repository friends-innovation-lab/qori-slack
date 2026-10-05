'use strict';

/**
 * DISC-2: Add worker claim columns to discovery_runs.
 *
 * Enables async execution with atomic claiming:
 * - worker_id: UUID of claiming worker
 * - claimed_at: When claim was acquired
 * - heartbeat_at: Last liveness signal (for stale detection)
 *
 * Pattern matches coaching_runs for consistency.
 */

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { DataTypes } = Sequelize;

    // Add worker_id column (string format: "discovery-{uuid}" or "sync-{uuid}")
    await queryInterface.addColumn('discovery_runs', 'worker_id', {
      type: DataTypes.STRING(100),
      allowNull: true,
    });

    // Add claimed_at column
    await queryInterface.addColumn('discovery_runs', 'claimed_at', {
      type: DataTypes.DATE,
      allowNull: true,
    });

    // Add heartbeat_at column
    await queryInterface.addColumn('discovery_runs', 'heartbeat_at', {
      type: DataTypes.DATE,
      allowNull: true,
    });

    // Index for efficient worker queries
    await queryInterface.addIndex('discovery_runs', ['status', 'worker_id'], {
      name: 'idx_discovery_runs_status_worker',
      where: { status: 'pending' },
    });

    // Index for stale detection (runs with old heartbeats)
    await queryInterface.addIndex('discovery_runs', ['status', 'heartbeat_at'], {
      name: 'idx_discovery_runs_stale_detection',
      where: { status: 'processing' },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('discovery_runs', 'idx_discovery_runs_stale_detection');
    await queryInterface.removeIndex('discovery_runs', 'idx_discovery_runs_status_worker');
    await queryInterface.removeColumn('discovery_runs', 'heartbeat_at');
    await queryInterface.removeColumn('discovery_runs', 'claimed_at');
    await queryInterface.removeColumn('discovery_runs', 'worker_id');
  },
};
