'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if column already exists
    const tableDescription = await queryInterface.describeTable('study_notes');
    
    if (!tableDescription.transcript) {
      await queryInterface.addColumn('study_notes', 'transcript', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Whether the notes include a transcript'
      });
      console.log('✅ Added transcript column to study_notes');
    } else {
      console.log('⚠️ transcript column already exists, skipping');
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable('study_notes');
    
    if (tableDescription.transcript) {
      await queryInterface.removeColumn('study_notes', 'transcript');
    }
  },
};
