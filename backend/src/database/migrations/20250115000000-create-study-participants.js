'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('study_participants', {
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
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      participant_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      contact_details: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      recruitment_source: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      scheduled_date: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      scheduled_time: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      status_select: {
        type: Sequelize.STRING,
        allowNull: true,
        defaultValue: 'Pending',
      },
      notes_field: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      demographics_info: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      added_by: {
        type: Sequelize.STRING,
        allowNull: false,
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

    // Add indexes for better performance
    await queryInterface.addIndex('study_participants', ['study_id']);
    await queryInterface.addIndex('study_participants', ['status_select']);
    await queryInterface.addIndex('study_participants', ['scheduled_date']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('study_participants');
  },
}; 
