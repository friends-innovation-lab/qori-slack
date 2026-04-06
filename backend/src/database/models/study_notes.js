// models/study_notes.js

const { DataTypes, Model } = require("sequelize");

module.exports = (sequelize) => {
  class StudyNotes extends Model {
    static associate(models) {
      // many-to-one → many notes per study
      this.belongsTo(models.ResearchStudy, {
        foreignKey: "study_id",
        as: "study",
        onDelete: "CASCADE",
      });

    }
  }

  StudyNotes.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      // Study Information
      study_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'research_studies',
          key: 'id'
        }
      },
      study_name: {
        type: DataTypes.STRING(500),
        allowNull: false,
        comment: 'Name of the research study'
      },

      // File Information
      filename: {
        type: DataTypes.STRING(500),
        allowNull: false,
        comment: 'Name of the notes file'
      },
      file_path: {
        type: DataTypes.STRING(1000),
        allowNull: true,
        comment: 'Custom file path for organization'
      },
      file_url: {
        type: DataTypes.STRING(1000),
        allowNull: true,
        comment: 'URL to the file in repository or storage'
      },

      transcript: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Whether the notes include a transcript'
      },

      // Session Information
      session_date: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Date of the research session'
      },
      session_time: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Time of the research session'
      },
      participant_name: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Name of the research participant'
      },

      // Researcher Information
      researcher: {
        type: DataTypes.STRING,
        allowNull: true,
        comment: 'Name of the researcher who conducted the session'
      },

      // Manual timestamp fields
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal("CURRENT_TIMESTAMP"),
      },

      // User tracking
      created_by: {
        type: DataTypes.STRING,
        allowNull: false,
        comment: 'Slack user ID who created the notes'
      },

    },
    {
      tableName: "study_notes",
      underscored: true,
      timestamps: false, // Disable automatic timestamps
      sequelize,

    }
  );

  return StudyNotes;
};
