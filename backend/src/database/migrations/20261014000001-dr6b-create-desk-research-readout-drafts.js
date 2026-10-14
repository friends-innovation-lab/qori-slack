'use strict';

/**
 * Migration: DR-6b — Create desk_research_readout_drafts table
 *
 * Mutable working draft content (one per readout).
 * Per DR-6b canonical contract:
 * - Single mutable draft per readout
 * - content_version for optimistic concurrency
 * - Review state tracking (findings_checked, implications_reviewed)
 *
 * Review state semantics:
 * - findings_checked: Array of finding IDs that have been checked against evidence
 * - implications_reviewed: Array of implication IDs that have been reviewed
 * - Service layer resets these when content changes invalidate prior review
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('desk_research_readout_drafts', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      // Parent readout (one draft per readout)
      readout_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { model: 'desk_research_readouts', key: 'id' },
        onDelete: 'CASCADE',
        comment: 'Parent readout (1:1 relationship)',
      },

      // Mutable content
      content: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: '{}',
        comment: 'Draft content: { summary, findings, limitations, implications }',
      },

      // Review state (arrays of checked/reviewed item IDs)
      findings_checked: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: '[]',
        comment: 'Finding IDs that have been checked against evidence',
      },
      implications_reviewed: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: '[]',
        comment: 'Implication IDs that have been reviewed',
      },

      // Optimistic concurrency
      content_version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Optimistic concurrency version (incremented on each save)',
      },

      // Edit tracking
      last_edited_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'Timestamp of last edit',
      },
      last_edited_by_actor_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'actors', key: 'id' },
        onDelete: 'SET NULL',
        comment: 'Actor who last edited (NULL for system-generated)',
      },
    });

    // Unique constraint on readout_id (already in column def, but explicit index)
    await queryInterface.addIndex('desk_research_readout_drafts', ['readout_id'], {
      name: 'uq_draft_readout_id',
      unique: true,
    });

    // Constraint: content_version must be positive
    await queryInterface.sequelize.query(`
      ALTER TABLE desk_research_readout_drafts
      ADD CONSTRAINT chk_draft_content_version_positive
      CHECK (content_version >= 1)
    `);

    console.log('Created desk_research_readout_drafts table');
  },

  async down(queryInterface) {
    await queryInterface.dropTable('desk_research_readout_drafts');
    console.log('Dropped desk_research_readout_drafts table');
  },
};
