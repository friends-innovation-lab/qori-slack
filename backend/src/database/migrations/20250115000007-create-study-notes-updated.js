'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('study_notes', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },

      // Study Information
      study_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'research_studies',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      study_name: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Name of the research study'
      },

      // File Information
      filename: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Name of the notes file'
      },
      file_path: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Custom file path for organization'
      },
      file_url: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'URL to the file in repository or storage'
      },

      // Session Information
      session_date: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Date of the research session'
      },
      session_time: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Time of the research session'
      },
      participant_name: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Name of the research participant'
      },

      // Researcher Information
      researcher: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Name of the researcher who conducted the session'
      },

      // Manual timestamp fields
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },

      // User tracking
      created_by: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Slack user ID who created the notes'
      }
    });

    // Add foreign key constraint for study_id
    await queryInterface.addConstraint('study_notes', {
      fields: ['study_id'],
      type: 'foreign key',
      name: 'fk_study_notes_study_id',
      references: {
        table: 'research_studies',
        field: 'id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    // Create basic indexes for performance
    await queryInterface.addIndex('study_notes', ['study_id'], {
      name: 'idx_study_notes_study_id'
    });

    await queryInterface.addIndex('study_notes', ['filename'], {
      name: 'idx_study_notes_filename'
    });

    await queryInterface.addIndex('study_notes', ['created_at'], {
      name: 'idx_study_notes_created_at'
    });

    await queryInterface.addIndex('study_notes', ['created_by'], {
      name: 'idx_study_notes_created_by'
    });
  },

  async down(queryInterface, Sequelize) {
    // Remove foreign key constraints first
    await queryInterface.removeConstraint('study_notes', 'fk_study_notes_study_id');

    // Drop the table
    await queryInterface.dropTable('study_notes');
  }
};
