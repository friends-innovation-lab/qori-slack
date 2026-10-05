'use strict';

/**
 * Migration: DISC-1 — Add discovery_artifact FK to study_variables
 *
 * Establishes real lineage from cascade variables to canonical DiscoveryArtifact.
 *
 * Strategy (per locked decision):
 *   - Preserve existing historical rows (discovery_artifact_id string remains)
 *   - Add new FK column discovery_artifact_fk_id (integer)
 *   - Backfill only where identity is deterministically recoverable
 *   - Unresolved historical lineage remains explicitly unresolved
 *
 * The original discovery_artifact_id (string) is kept for:
 *   - Historical compatibility
 *   - Slug-based identification (topic slug)
 *   - Gradual migration
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add new FK column (nullable for migration)
    await queryInterface.addColumn('study_variables', 'discovery_artifact_fk_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'discovery_artifacts', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'FK to canonical discovery_artifacts (NULL for historical/unresolved)',
    });

    // Index for efficient artifact lookup
    await queryInterface.addIndex('study_variables', ['discovery_artifact_fk_id'], {
      name: 'idx_study_variables_discovery_artifact_fk',
    });

    console.log('Added discovery_artifact_fk_id column to study_variables');

    // Log counts for audit
    const [results] = await queryInterface.sequelize.query(`
      SELECT
        COUNT(*) FILTER (WHERE scope = 'discovery') as discovery_vars,
        COUNT(DISTINCT discovery_artifact_id) FILTER (WHERE scope = 'discovery' AND discovery_artifact_id IS NOT NULL) as distinct_artifact_ids
      FROM study_variables
    `);

    const counts = results[0] || { discovery_vars: 0, distinct_artifact_ids: 0 };
    console.log(`Discovery variable audit: ${counts.discovery_vars} total, ${counts.distinct_artifact_ids} distinct artifact IDs`);
    console.log('Backfill will occur after DiscoveryArtifact rows are created');
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('study_variables', 'idx_study_variables_discovery_artifact_fk');
    await queryInterface.removeColumn('study_variables', 'discovery_artifact_fk_id');
    console.log('Removed discovery_artifact_fk_id column from study_variables');
  },
};
