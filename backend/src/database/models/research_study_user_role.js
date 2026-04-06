// models/research_study_user_role.js

const { DataTypes, Model } = require("sequelize");

module.exports = (sequelize) => {
  class ResearchStudyUserRole extends Model {
    static associate(models) {
      // each role belongs to one study
      this.belongsTo(models.ResearchStudy, {
        foreignKey: "research_id",
        as: "study",
        onDelete: "CASCADE",
      });
    }
  }

  ResearchStudyUserRole.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      research_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "research_studies",
          key: "id",
        },
      },
      user_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      role: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: sequelize.literal("CURRENT_TIMESTAMP"),
      },
    },
    {
      tableName: "research_study_user_roles",
      underscored: true,
      timestamps: false,
      sequelize,
    }
  );

  return ResearchStudyUserRole;
};
