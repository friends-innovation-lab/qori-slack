'use strict';

/**
 * Migration: DISC-WEB-1D-2 M5d — Add is_controlled column to discovery_runs
 *
 * Enables controlled test runs to be excluded from the ordinary poller.
 * Controlled runs are created with is_controlled = TRUE.
 * Ordinary runs (existing and new) have is_controlled = FALSE.
 *
 * This column supports poller isolation without changing the run status model.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add is_controlled column with NOT NULL DEFAULT FALSE
    // All existing rows will have FALSE (ordinary runs)
    await queryInterface.addColumn('discovery_runs', 'is_controlled', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'True for controlled test runs, excluded from ordinary poller',
    });

    // Partial index for efficient lookup of controlled runs
    // Most queries will filter WHERE is_controlled = FALSE
    await queryInterface.sequelize.query(`
      CREATE INDEX idx_discovery_runs_is_controlled
      ON discovery_runs (is_controlled)
      WHERE is_controlled = TRUE
    `);

    console.log('Added is_controlled column to discovery_runs for DISC-WEB-1D-2 M5d');
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS idx_discovery_runs_is_controlled
    `);
    await queryInterface.removeColumn('discovery_runs', 'is_controlled');
    console.log('Removed is_controlled column from discovery_runs');
  },
};
