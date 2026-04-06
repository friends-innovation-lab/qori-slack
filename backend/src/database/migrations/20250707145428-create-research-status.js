'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('research_status', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      approved_by: {
        type: Sequelize.STRING,
        allowNull: false
      },
      reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('approve', 'rejected', 'need_changes', 'created'),
        allowNull: false,
        defaultValue: 'approve'
      },
      path: {
        type: Sequelize.STRING,
        allowNull: true
      },
      file_name: {
        type: Sequelize.STRING,
        allowNull: true
      },
      approved_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      created_by: {
        type: Sequelize.STRING,
        allowNull: true
      }
    });
  },

  async down(queryInterface, Sequelize) {
    // drop the table
    await queryInterface.dropTable('research_status');

    // if you're using Postgres, also drop the enum type:
    // (MySQL will clean up automatically)
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_research_status_status";'
    );
  }
};
