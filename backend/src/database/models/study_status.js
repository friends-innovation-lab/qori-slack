// models/research_study.js

const { DataTypes, Model } = require('sequelize');

module.exports = (sequelize) => {
  class StudyStatus extends Model {
    static associate() {
      // …
    }
  }

  StudyStatus.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      study_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      approved_by: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      requested_by: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('approve', 'rejected', 'need_changes', 'created'),
        allowNull: false,
        defaultValue: 'approve',
      },
      path: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      file_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      approved_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal('CURRENT_TIMESTAMP'),
      },
      created_by: {
        type: DataTypes.STRING,
        allowNull: true,
      },
    },
    {
      tableName: 'research_status',
      underscored: true,
      timestamps: false,
      sequelize,
    },
  );

  return StudyStatus;
};
