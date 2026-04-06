'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Allow sha4 to be NULL
    await queryInterface.changeColumn('research_studies', 'sha4', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    // Change created_by from INTEGER → STRING
    await queryInterface.changeColumn('research_studies', 'created_by', {
      type: Sequelize.STRING,
      allowNull: false,
    });

    // Change user_id from INTEGER → STRING
    await queryInterface.changeColumn('research_study_user_roles', 'user_id', {
      type: Sequelize.STRING,
      allowNull: false,
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert sha4 to NOT NULL
    await queryInterface.changeColumn('research_studies', 'sha4', {
      type: Sequelize.STRING,
      allowNull: false,
    });

    // Revert created_by back to INTEGER
    await queryInterface.changeColumn('research_studies', 'created_by', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });

    // Revert user_id back to INTEGER
    await queryInterface.changeColumn('research_study_user_roles', 'user_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });
  }
};
