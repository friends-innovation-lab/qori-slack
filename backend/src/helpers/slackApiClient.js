// utils/slackApiClient.js
const axios = require("axios");

const slackApiClient = axios.create({
  baseURL: "https://slack.com/api/",
  headers: {
    Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    "Content-Type": "application/json",
  },
});

module.exports = slackApiClient;
