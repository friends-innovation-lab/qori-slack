'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('channel_config', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      channel_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      github_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      repo_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      repo: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      product_folder_name: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      sub_folder_name: {
        type: Sequelize.STRING,
        allowNull: true,
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
        // if you’re on MySQL and want it to auto‐update on change:
        // defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('channel_config');
  },
};
