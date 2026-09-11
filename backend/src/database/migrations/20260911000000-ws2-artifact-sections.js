'use strict';

/**
 * WS-2: Add artifact_sections table and content_version to research_artifacts.
 *
 * artifact_sections stores editable prose content per artifact section.
 * content_version on research_artifacts provides artifact-level optimistic
 * concurrency for the entire editable document transaction.
 *
 * study_variables remains the cascade projection for structured domain values
 * (objectives, questions, barriers). artifact_sections stores artifact body
 * content (AI-generated prose, edited narrative) — a separate concern.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add content_version to research_artifacts
    await queryInterface.addColumn('research_artifacts', 'content_version', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    });

    // 2. Create artifact_sections table
    await queryInterface.createTable('artifact_sections', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      artifact_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'research_artifacts', key: 'id' },
        onDelete: 'CASCADE',
      },
      section_key: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      content_type: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'prose',
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_by: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
    });

    // 3. Unique constraint: one section per artifact
    await queryInterface.addConstraint('artifact_sections', {
      fields: ['artifact_id', 'section_key'],
      type: 'unique',
      name: 'artifact_sections_artifact_id_section_key_unique',
    });

    // 4. Index for artifact lookup
    await queryInterface.addIndex('artifact_sections', ['artifact_id'], {
      name: 'artifact_sections_artifact_id_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('artifact_sections');
    await queryInterface.removeColumn('research_artifacts', 'content_version');
  },
};
