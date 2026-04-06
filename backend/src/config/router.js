const authRouter = require("../routes/auth.route");

module.exports = function (app) {
  app.use("/auth", authRouter);
  // Note: github-webhook route is mounted directly in app.js before express.json()
};
