const slackApiClient = require("./slackApiClient");


const getTeamInfo = async () => {
  try {
    const workspace = await slackApiClient.get("team.info");

    return workspace.data.team;
  } catch (error) {
    console.error("Error fetching team info:", error);
    throw new Error("Failed to fetch team info");
  }
};

const getAllMembers = async () => {
  try {
    const workspace = await slackApiClient.get("users.list");

    return workspace.data.members.filter((member) => !member.is_bot && member.id !== "USLACKBOT");
  } catch (error) {
    console.error("Error fetching all members:", error);
    throw new Error("Failed to fetch all members");
  }
};

module.exports = {
  getTeamInfo,
  getAllMembers,
};
