// models/session_summary.js

const { DataTypes, Model } = require("sequelize");

module.exports = (sequelize) => {
    class SessionSummary extends Model {
        static associate(models) {
            // many-to-one → many summaries per study
            this.belongsTo(models.ResearchStudy, {
                foreignKey: "study_id",
                as: "study",
                onDelete: "CASCADE",
            });
        }
    }

    SessionSummary.init(
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
                comment: 'Name of the session summary file'
            },
            file_path: {
                type: DataTypes.STRING(1000),
                allowNull: true,
                comment: 'Path to the file in repository'
            },
            file_url: {
                type: DataTypes.STRING(1000),
                allowNull: true,
                comment: 'URL to the file in repository or storage'
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
                comment: 'Slack user ID who created the summary'
            },

        },
        {
            tableName: "session_summaries",
            underscored: true,
            timestamps: false, // Disable automatic timestamps
            sequelize,
        }
    );

    return SessionSummary;
};

