'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('research_plans', {
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
        }
      },
      study_name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Name of the research study'
      },
      filename: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Name of the plan file'
      },
      file_path: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Custom file path for organization'
      },
      file_url: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'URL to the file in repository or storage'
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
      created_by: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Slack user ID who created the plan'
      },
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('research_plans');
  },
};
