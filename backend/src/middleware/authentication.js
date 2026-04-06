// middleware/authentication.js

const db = require("../database/index");
const { tokenHelper } = require("../helpers");

module.exports = async function authenticate(req, res, next) {
  const authorization = req.headers.authorization || "";
  const refreshToken  = req.headers.refreshtoken || "";

  req.user = null;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return next();
  }

  const token = authorization.substring(7);
  let tokenData;
  try {
    tokenData = await tokenHelper.verifyToken(token);
  } catch {
    return next();
  }

  const user = await db.models.user.findByPk(tokenData.id).catch(() => null);
  if (!user) {
    return next({ status: 401, message: "There is no user" });
  }

  req.user = user;

  // Refresh tokens if expiring within 15 minutes
  const now = Date.now();
  const exp = tokenData.exp * 1000;
  const minutesLeft = Math.round((exp - now) / 60000);

  if (refreshToken && minutesLeft < 15) {
    try {
      const rtData = await tokenHelper.verifyToken(refreshToken);
      if (rtData.id === tokenData.id) {
        const newToken        = user.generateToken();
        const newRefreshToken = user.generateToken("2h");
        res.setHeader("Token", newToken);
        res.setHeader("RefreshToken", newRefreshToken);
      }
    } catch {
      // ignore refresh errors
    }
  }

  return next();
};
