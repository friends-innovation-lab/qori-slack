// routes/auth.js

const express = require("express");
const router = express.Router();
const authController = require("../controllers/auth.controller");
const authValidations = require("./validations/auth");
const { isAuthenticated, validate } = require("../middleware");

router.post("/login", validate(authValidations.loginRules), authController.login);

router.post("/register", validate(authValidations.registerRules), authController.register);

router
  .route("/me")
  .get(isAuthenticated, authController.getCurrentUser)
  .put(isAuthenticated, validate(authValidations.updateProfileRules), authController.updateCurrentUser)
  .delete(isAuthenticated, authController.deleteCurrentUser);

router.route("/slack").get(authController.slackLogin);
router.get("/slack/callback", authController.slackCallback);

router.put(
  "/me/password",
  isAuthenticated,
  validate(authValidations.changePasswordRules),
  authController.updatePassword
);

module.exports = router;
