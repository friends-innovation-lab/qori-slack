'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Change path column from VARCHAR(255) to TEXT to support longer URLs
    await queryInterface.changeColumn('research_status', 'path', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to VARCHAR(255)
    await queryInterface.changeColumn('research_status', 'path', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  }
};

