// helpers/slack.js

const axios  = require("axios");
const dotenv = require("dotenv");
dotenv.config();

const clientId     = process.env.SLACK_CLIENT_ID;
const clientSecret = process.env.SLACK_CLIENT_SECRET;
const redirectUri  = process.env.SLACK_REDIRECT_URI;

async function getOAuthTokens(code) {
  const resp = await axios.post(
    "https://slack.com/api/oauth.v2.access",
    null,
    { params: { code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri }}
  );
  if (!resp.data.ok) throw new Error(resp.data.error);
  return resp.data;
}

async function fetchUserInfo(token, userId) {
  const resp = await axios.get(
    "https://slack.com/api/users.info",
    { headers: { Authorization: `Bearer ${token}` }, params: { user: userId }}
  );
  if (!resp.data.ok) throw new Error(resp.data.error);
  return resp.data.user;
}

module.exports = { getOAuthTokens, fetchUserInfo };
