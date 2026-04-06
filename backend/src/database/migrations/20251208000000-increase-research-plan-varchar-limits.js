'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Increase VARCHAR limits for fields that might contain long paths/URLs
    await queryInterface.changeColumn('research_plans', 'filename', {
      type: Sequelize.STRING(500),
      allowNull: false,
      comment: 'Name of the plan file'
    });

    await queryInterface.changeColumn('research_plans', 'file_path', {
      type: Sequelize.STRING(1000),
      allowNull: true,
      comment: 'Custom file path for organization'
    });

    await queryInterface.changeColumn('research_plans', 'file_url', {
      type: Sequelize.STRING(1000),
      allowNull: true,
      comment: 'URL to the file in repository or storage'
    });

    console.log('✅ Increased VARCHAR limits for research_plans table');
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to original VARCHAR(255) limits
    await queryInterface.changeColumn('research_plans', 'filename', {
      type: Sequelize.STRING(255),
      allowNull: false,
      comment: 'Name of the plan file'
    });

    await queryInterface.changeColumn('research_plans', 'file_path', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Custom file path for organization'
    });

    await queryInterface.changeColumn('research_plans', 'file_url', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'URL to the file in repository or storage'
    });
  }
};

