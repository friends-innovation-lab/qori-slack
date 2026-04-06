const { DataTypes, Model } = require("sequelize");

module.exports = function (sequelize) {
  class ChannelConfig extends Model {
    static associate(models) {
      // Define associations here, if any
    }
  }

  ChannelConfig.init(
    {
      channel_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      github_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      repo_id: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      repo: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      product_folder_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      sub_folder_name: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: sequelize.literal("CURRENT_TIMESTAMP"),
      },
    },
    {
      tableName: "channel_config",
      underscored: true,
      timestamps: false, // You’re managing created_at and updated_at manually
      sequelize,
    }
  );

  return ChannelConfig;
};
