'use strict';

/**
 * DR-6b-5b: Add retry_after column for bounded transient-failure backoff
 *
 * Adds a nullable `retry_after` timestamp to desk_research_readout_versions.
 * This column indicates the earliest time a pending job can be claimed,
 * enabling bounded backoff for transient provider errors.
 *
 * Design rationale:
 * - Separates retry timing (pending jobs) from heartbeat (in-progress jobs)
 * - Preserves the existing chk_version_claimed_has_worker constraint
 * - Existing rows remain valid without backfill (NULL = immediately claimable)
 *
 * Backoff schedule (configurable via env):
 * - Attempt 1: immediate (first try)
 * - Attempt 2: 5 second delay
 * - Attempt 3: 15 second delay
 * - Attempt 4+: terminal failure
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add retry_after column for bounded backoff timing
    await queryInterface.addColumn('desk_research_readout_versions', 'retry_after', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Earliest time this pending job can be claimed (bounded retry backoff). NULL = immediately claimable.',
    });

    // Partial index for efficient pending job claims with retry timing
    // Query pattern: WHERE generation_status = 'pending' AND (retry_after IS NULL OR retry_after <= NOW())
    await queryInterface.addIndex('desk_research_readout_versions', ['generation_status', 'retry_after'], {
      name: 'idx_version_pending_retry_after',
      where: { generation_status: 'pending' },
    });

    console.log('[DR-6b-5b] Added retry_after column and index for bounded transient-failure backoff');
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('desk_research_readout_versions', 'idx_version_pending_retry_after');
    await queryInterface.removeColumn('desk_research_readout_versions', 'retry_after');
    console.log('[DR-6b-5b] Removed retry_after column and index');
  },
};
