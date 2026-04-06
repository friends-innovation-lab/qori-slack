'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('research_studies', 'researcher_name', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'Unknown Researcher', // Provide a default value for existing records
    });

    await queryInterface.addColumn('research_studies', 'researcher_email', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'unknown@example.com', // Provide a default value for existing records
    });

    // After adding the columns, remove the default values to make them truly required for new records
    await queryInterface.changeColumn('research_studies', 'researcher_name', {
      type: Sequelize.STRING,
      allowNull: false,
    });

    await queryInterface.changeColumn('research_studies', 'researcher_email', {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('research_studies', 'researcher_email');
    await queryInterface.removeColumn('research_studies', 'researcher_name');
  },
};
