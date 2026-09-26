/**
 * Coach M2 Migration — Add MAX_ATTEMPTS_EXCEEDED failure code
 *
 * Extends the coaching_runs failure_code CHECK constraint to include
 * MAX_ATTEMPTS_EXCEEDED for bounded operational retry exhaustion.
 */

'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // 1. Drop existing CHECK constraint
    await queryInterface.sequelize.query(`
      ALTER TABLE coaching_runs
      DROP CONSTRAINT IF EXISTS coaching_runs_failure_code_check
    `);

    // 2. Add updated CHECK constraint with MAX_ATTEMPTS_EXCEEDED
    await queryInterface.sequelize.query(`
      ALTER TABLE coaching_runs
      ADD CONSTRAINT coaching_runs_failure_code_check
      CHECK (failure_code IS NULL OR failure_code IN (
        'PROVIDER_UNAVAILABLE',
        'PROVIDER_TIMEOUT',
        'RATE_LIMITED',
        'INVALID_MODEL_RESPONSE',
        'OUTPUT_VALIDATION_FAILED',
        'CONTEXT_BUILD_FAILED',
        'GENERATION_FAILED',
        'MAX_ATTEMPTS_EXCEEDED'
      ))
    `);

    // 3. Add index for pending runs ordered by requested_at (worker queue polling)
    // This supports the SKIP LOCKED claim pattern efficiently
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS coaching_runs_pending_queue_idx
      ON coaching_runs (requested_at ASC)
      WHERE status = 'pending'
    `);

    // 4. Add index for stale run detection
    // Supports finding running jobs with old heartbeat
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS coaching_runs_stale_detection_idx
      ON coaching_runs (heartbeat_at ASC)
      WHERE status = 'running'
    `);
  },

  async down(queryInterface) {
    // Drop new indexes
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS coaching_runs_stale_detection_idx
    `);
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS coaching_runs_pending_queue_idx
    `);

    // Revert CHECK constraint to M1 version
    await queryInterface.sequelize.query(`
      ALTER TABLE coaching_runs
      DROP CONSTRAINT IF EXISTS coaching_runs_failure_code_check
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE coaching_runs
      ADD CONSTRAINT coaching_runs_failure_code_check
      CHECK (failure_code IS NULL OR failure_code IN (
        'PROVIDER_UNAVAILABLE',
        'PROVIDER_TIMEOUT',
        'RATE_LIMITED',
        'INVALID_MODEL_RESPONSE',
        'OUTPUT_VALIDATION_FAILED',
        'CONTEXT_BUILD_FAILED',
        'GENERATION_FAILED'
      ))
    `);
  },
};
