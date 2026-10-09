'use strict';

/**
 * Migration: DR-1 — Extend evidence_constructs for Desk Research insights
 *
 * Adds revision tracking and withdrawal support to EvidenceConstruct.
 * Per SPEC-2 design authority:
 * - Insights belong to the project, not individual studies
 * - Revision history is immutable
 * - Display IDs are IN-0001 format, project-unique, never reused
 *
 * New columns:
 *   - display_sequence: Auto-incrementing project-unique sequence
 *   - latest_revision_id: FK to latest revision (any state)
 *   - accepted_revision_id: FK to currently accepted revision
 *   - version: Optimistic concurrency version
 *   - withdrawn_at: When insight was withdrawn
 *   - withdrawn_by: Actor who withdrew
 *   - withdrawal_reason: Required reason for withdrawal (D6)
 *
 * Desk research insights use construct_type = 'desk_insight'.
 * Existing construct types and consumers are unaffected.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add new columns to evidence_constructs
    await queryInterface.addColumn('evidence_constructs', 'display_sequence', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Project-unique display sequence for IN-NNNN format. NULL for non-insight constructs.',
    });

    await queryInterface.addColumn('evidence_constructs', 'latest_revision_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'FK to latest revision (any state). NULL for constructs without revision tracking.',
    });

    await queryInterface.addColumn('evidence_constructs', 'accepted_revision_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'FK to currently accepted revision. NULL if never accepted or withdrawn.',
    });

    await queryInterface.addColumn('evidence_constructs', 'version', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: 'Optimistic concurrency version. Incremented on each state change.',
    });

    await queryInterface.addColumn('evidence_constructs', 'withdrawn_at', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'When the insight was withdrawn from synthesis eligibility.',
    });

    await queryInterface.addColumn('evidence_constructs', 'withdrawn_by', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'Actor identity who withdrew the insight.',
    });

    await queryInterface.addColumn('evidence_constructs', 'withdrawal_reason', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Required reason for withdrawal (per D6).',
    });

    // Add desk_insight to construct_type enum by updating CHECK constraint
    // Drop the existing constraint
    await queryInterface.sequelize.query(`
      ALTER TABLE evidence_constructs
      DROP CONSTRAINT IF EXISTS chk_construct_type
    `);

    // Recreate with desk_insight added
    await queryInterface.sequelize.query(`
      ALTER TABLE evidence_constructs
      ADD CONSTRAINT chk_construct_type CHECK (
        construct_type IN (
          'knowledge_gap', 'barrier', 'research_question', 'stakeholder_constraint',
          'nugget', 'survey_pattern', 'survey_dataset_summary', 'field_distribution',
          'cross_tab', 'usability_finding', 'journey_stage', 'recommendation',
          'finding', 'theme', 'persona', 'ticket_candidate',
          'survey_qualitative_pattern', 'survey_individual_observation',
          'desk_insight'
        )
      )
    `);

    // Create partial unique index for display_sequence per project
    // Only applies to desk_insight constructs
    await queryInterface.addIndex('evidence_constructs', ['project_id', 'display_sequence'], {
      name: 'idx_evidence_constructs_project_display_seq',
      unique: true,
      where: { display_sequence: { [Sequelize.Op.ne]: null } },
    });

    // Index for finding insights needing review
    await queryInterface.addIndex('evidence_constructs', ['project_id', 'construct_type', 'withdrawn_at'], {
      name: 'idx_evidence_constructs_project_type_withdrawn',
    });

    // Index for accepted revision lookup
    await queryInterface.addIndex('evidence_constructs', ['accepted_revision_id'], {
      name: 'idx_evidence_constructs_accepted_revision',
    });

    console.log('Extended evidence_constructs with DR-1 revision tracking columns');
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('evidence_constructs', 'idx_evidence_constructs_accepted_revision');
    await queryInterface.removeIndex('evidence_constructs', 'idx_evidence_constructs_project_type_withdrawn');
    await queryInterface.removeIndex('evidence_constructs', 'idx_evidence_constructs_project_display_seq');

    await queryInterface.removeColumn('evidence_constructs', 'withdrawal_reason');
    await queryInterface.removeColumn('evidence_constructs', 'withdrawn_by');
    await queryInterface.removeColumn('evidence_constructs', 'withdrawn_at');
    await queryInterface.removeColumn('evidence_constructs', 'version');
    await queryInterface.removeColumn('evidence_constructs', 'accepted_revision_id');
    await queryInterface.removeColumn('evidence_constructs', 'latest_revision_id');
    await queryInterface.removeColumn('evidence_constructs', 'display_sequence');

    console.log('Reverted DR-1 evidence_constructs extensions');
  },
};
