'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Increase VARCHAR limits for fields that might contain long paths/URLs
    await queryInterface.changeColumn('study_notes', 'file_path', {
      type: Sequelize.STRING(1000),
      allowNull: true,
      comment: 'Custom file path for organization'
    });

    await queryInterface.changeColumn('study_notes', 'file_url', {
      type: Sequelize.STRING(1000),
      allowNull: true,
      comment: 'URL to the file in repository or storage'
    });

    await queryInterface.changeColumn('study_notes', 'filename', {
      type: Sequelize.STRING(500),
      allowNull: false,
      comment: 'Name of the notes file'
    });

    await queryInterface.changeColumn('study_notes', 'study_name', {
      type: Sequelize.STRING(500),
      allowNull: false,
      comment: 'Name of the research study'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to original VARCHAR(255) limits
    await queryInterface.changeColumn('study_notes', 'file_path', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Custom file path for organization'
    });

    await queryInterface.changeColumn('study_notes', 'file_url', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'URL to the file in repository or storage'
    });

    await queryInterface.changeColumn('study_notes', 'filename', {
      type: Sequelize.STRING(255),
      allowNull: false,
      comment: 'Name of the notes file'
    });

    await queryInterface.changeColumn('study_notes', 'study_name', {
      type: Sequelize.STRING(255),
      allowNull: false,
      comment: 'Name of the research study'
    });
  }
};
