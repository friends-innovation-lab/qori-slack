// controllers/auth.js

const createError = require("http-errors");
const db = require("../database/index");
const { fetchUserInfo, getOAuthTokens } = require("../helpers/slack/auth");

// POST /auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await db.models.user.findOne({ where: { email } });

    if (!user) {
      return next(createError(400, "There is no user with this email address!"));
    }

    const isValidPassword = await user.validatePassword(password);
    if (!isValidPassword) {
      return next(createError(400, "Incorrect password!"));
    }

    const token = user.generateToken();
    const refreshToken = user.generateToken("2h");
    return res.status(200).json({ token, refreshToken });
  } catch (err) {
    return next(err);
  }
};

// POST /auth/register
const register = async (req, res, next) => {
  console.log("hello")
  console.log("🚀 ~ register ~ response:", response)
  try {
    const user = await db.models.user.create(req.body, {
      fields: ["firstName", "lastName", "email", "password"],
    });

    const token = user.generateToken();
    const refreshToken = user.generateToken("2h");
    res.status(201).json({ token, refreshToken });
  } catch (err) {
    next(err);
  }
};

// GET /auth/me
const getCurrentUser = async (req, res, next) => {
  try {
    delete req.user.dataValues.password;
    res.json(req.user);
  } catch (err) {
    next(err);
  }
};

const slackLogin = async (_req, res) => {
  const base   = 'https://slack.com/oauth/v2/authorize';
  const params = new URLSearchParams({
    client_id:    process.env.SLACK_CLIENT_ID,
    scope:        process.env.SLACK_SCOPES,  // adjust if you need more scopes
    redirect_uri: process.env.SLACK_REDIRECT_URI
  });
  res.redirect(`${base}?${params}`);
};

const slackCallback = async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code) throw createError(400, "Missing OAuth code");

    // Exchange code for tokens
    const oauth       = await getOAuthTokens(code);
    const userToken   = oauth.access_token;
    const slackUserId = oauth.authed_user.id;

    // Fetch Slack profile
    const profile = await fetchUserInfo(userToken, slackUserId);
    console.log("🚀 ~ slackCallback ~ profile:", profile)
    const isOwner = profile.is_owner || profile.is_admin;

    // Upsert into our User table
    const [user] = await db.models.user.upsert({
      slackId:               slackUserId,
      teamId:                oauth.team.id,
      teamName:              oauth.team.name,
      name:                  profile.name,
      realName:              profile.real_name,
      deleted:               profile.deleted,
      color:                 profile.color,
      tz:                    profile.tz,
      tzLabel:               profile.tz_label,
      tzOffset:              profile.tz_offset,
      title:                 profile.profile.title,
      phone:                 profile.profile.phone,
      skype:                 profile.profile.skype,
      displayName:           profile.profile.display_name,
      avatar24:              profile.profile.image_24,
      avatar32:              profile.profile.image_32,
      avatar48:              profile.profile.image_48,
      avatar72:              profile.profile.image_72,
      avatar192:             profile.profile.image_192,
      avatar512:             profile.profile.image_512,
      firstName:             profile.profile.first_name,
      lastName:              profile.profile.last_name,
      email:                 profile.profile.email,
      isAdmin:               profile.is_admin,
      isOwner:               profile.is_owner,
      isPrimaryOwner:        profile.is_primary_owner,
      isRestricted:          profile.is_restricted,
      isUltraRestricted:     profile.is_ultra_restricted,
      isBot:                 profile.is_bot,
      isAppUser:             profile.is_app_user,
      isEmailConfirmed:      profile.is_email_confirmed,
      whoCanShareContactCard: profile.who_can_share_contact_card,
      updatedTs:             profile.updated
    }, {
      returning: true,
      fields: [
        'slackId','teamId','teamName','name','realName','deleted','color',
        'tz','tzLabel','tzOffset','title','phone','skype','displayName',
        'avatar24','avatar32','avatar48','avatar72','avatar192','avatar512',
        'firstName','lastName','email','isAdmin','isOwner','isPrimaryOwner',
        'isRestricted','isUltraRestricted','isBot','isAppUser','isEmailConfirmed',
        'whoCanShareContactCard','updatedTs'
      ]
    });


    // Issue our JWTs exactly as in email/password login
    const token        = user.generateToken();
    const refreshToken = user.generateToken('2h');

    // Redirect (or respond JSON) with tokens
    return res.redirect(
      `${process.env.FRONTEND_URI}/auth/success?token=${token}&refreshToken=${refreshToken}`
    );
  } catch (err) {
    next(err);
  }
}

// PUT /auth/me
const updateCurrentUser = async (req, res, next) => {
  try {
    await req.user.update(req.body, {
      fields: ["firstName", "lastName", "email"],
    });
    res.status(200).json({ success: true });
  } catch (err) {
    next(err);
  }
};

// DELETE /auth/me
const deleteCurrentUser = async (req, res, next) => {
  try {
    await req.user.destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// PUT /auth/me/password
const updatePassword = async (req, res, next) => {
  try {
    const { current, password } = req.body;
    const isValidPassword = await req.user.validatePassword(current);
    if (!isValidPassword) {
      return next(createError(400, "Incorrect password!"));
    }

    req.user.password = password;
    await req.user.save();
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  login,
  register,
  getCurrentUser,
  updateCurrentUser,
  deleteCurrentUser,
  updatePassword,
  slackLogin,
  slackCallback
};
