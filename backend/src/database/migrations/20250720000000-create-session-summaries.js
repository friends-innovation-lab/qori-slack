'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('session_summaries', {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      study_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'research_studies',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      study_name: {
        type: Sequelize.STRING(500),
        allowNull: false,
        comment: 'Name of the research study'
      },
      filename: {
        type: Sequelize.STRING(500),
        allowNull: false,
        comment: 'Name of the session summary file'
      },
      file_path: {
        type: Sequelize.STRING(1000),
        allowNull: true,
        comment: 'Path to the file in repository'
      },
      file_url: {
        type: Sequelize.STRING(1000),
        allowNull: true,
        comment: 'URL to the file in repository or storage'
      },
      created_by: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Slack user ID who created the summary'
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
    });

    // Add index for faster lookups
    await queryInterface.addIndex('session_summaries', ['study_id']);
    await queryInterface.addIndex('session_summaries', ['study_name']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('session_summaries');
  },
};

