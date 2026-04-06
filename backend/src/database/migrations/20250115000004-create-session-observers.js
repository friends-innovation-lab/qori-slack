'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('session_observers', {
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
      participant_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'study_participants',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      session_id: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Session identifier like pt001, pt002, etc.',
      },
      requester_id: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Slack user ID of the person requesting to observe',
      },
      requester_name: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Display name of the requester',
      },
      role: {
        type: Sequelize.ENUM('note_taker', 'silent_observer', 'pm_observer', 'stakeholder'),
        allowNull: false,
        comment: 'Observer role type',
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Reason for wanting to observe',
      },
      status: {
        type: Sequelize.ENUM('pending', 'approved', 'denied', 'removed'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Current status of the observer request',
      },
      approved_by: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Slack user ID of the person who approved/denied',
      },
      approved_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the request was approved/denied',
      },
      guidelines_sent: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether observer guidelines have been sent',
      },
      guidelines_sent_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When guidelines were sent',
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
    await queryInterface.addIndex('session_observers', ['study_id']);
    await queryInterface.addIndex('session_observers', ['session_id']);
    await queryInterface.addIndex('session_observers', ['requester_id']);
    await queryInterface.addIndex('session_observers', ['status']);
    await queryInterface.addIndex('session_observers', ['role']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('session_observers');
  },
}; 
