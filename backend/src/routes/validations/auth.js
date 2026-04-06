// routes/validations/auth.js

const { body } = require('express-validator');

const loginRules = [
  body('email').isEmail().exists(),
  body('password').exists(),
];

const registerRules = [
  body('firstName').exists(),
  body('lastName').exists(),
  body('email').isEmail().exists(),
  body('password').isLength({ min: 6 }).exists(),
];

const updateProfileRules = [
  body('firstName').optional(),
  body('lastName').optional(),
  body('email').isEmail().optional(),
];

const changePasswordRules = [
  body('current').exists(),
  body('password').isLength({ min: 6 }).exists(),
];

module.exports = {
  loginRules,
  registerRules,
  updateProfileRules,
  changePasswordRules,
};
