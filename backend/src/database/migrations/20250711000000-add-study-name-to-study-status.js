'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('research_status', 'study_name', {
      type: Sequelize.STRING,
      allowNull: true,
      after: 'id',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('research_status', 'study_name');
  },
}; 
