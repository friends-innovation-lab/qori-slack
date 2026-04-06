const sequelize = require("../database");

const addNewUser = async (user) => {
  try {
    const existingUser = await sequelize.models.User.findOne({
      where: {
        platform_user_id: user.platform_user_id,
        platform_workspace_id: user.platform_workspace_id,
      },
    });

    if (!existingUser) {
      await sequelize.models.User.create(user);
    } else {
      await sequelize.models.User.update(user, {
        where: {
          platform_user_id: user.platform_user_id,
          platform_workspace_id: user.platform_workspace_id,
        },
      });
    }

    return user;
  } catch (error) {
    console.error("Error in addNewUser: ", error);
    throw new Error("Failed to add or update user");
  }
};

module.exports = {
  addNewUser,
};
