// models/user.js

const { compare, hash } = require("bcrypt");
const { DataTypes, Model } = require("sequelize");
const { tokenHelper, mailHelper } = require("../../helpers");

module.exports = function (sequelize) {
  class User extends Model {
    get fullName() {
      return `${this.firstName} ${this.lastName}`;
    }

    generateToken(expiresIn = "1h") {
      const data = { id: this.id, email: this.email };
      return tokenHelper.generateToken(data, expiresIn);
    }

    validatePassword(plainPassword) {
      return compare(plainPassword, this.password);
    }

    sendMail(mail) {
      const payload = { ...mail, to: `${this.fullName} <${this.email}>` };
      return mailHelper.sendMail(payload);
    }

    static associate(models) {
    }
  }

  User.init(
    {
      first_name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      last_name: {
        type: DataTypes.STRING,
        allowNull: true, // Nullable
      },
      email: {
        type: DataTypes.STRING,
        allowNull: true, // Email is not unique now
      },
      phone: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      avatar: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      is_admin: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      created_at: {
        type: DataTypes.DATE,
        defaultValue: sequelize.literal("CURRENT_TIMESTAMP"),
      },
      updated_at: {
        type: DataTypes.DATE,
        defaultValue: sequelize.literal("CURRENT_TIMESTAMP"),
        onUpdate: sequelize.literal("CURRENT_TIMESTAMP"),
      },
    },
    {
      tableName: "users",
      underscored: true, // This ensures columns like `created_at` follow the snake_case naming convention
      timestamps: false, // Since you're handling `created_at` and `updated_at` manually
      sequelize,
    }
  );

  User.addHook("beforeSave", async (instance) => {
    if (instance.changed("password")) {
      instance.password = await hash(instance.password, 10);
    }
  });

  User.addHook("afterCreate", (instance) => {
    const payload = {
      subject: "Welcome to Express Starter",
      html: "Your account is created successfully!",
    };
    instance.sendMail(payload);
  });

  User.addHook("afterDestroy", (instance) => {
    const payload = {
      subject: "Sorry to see you go",
      html: "Your account is destroyed successfully!",
    };
    instance.sendMail(payload);
  });

  return User;
};
