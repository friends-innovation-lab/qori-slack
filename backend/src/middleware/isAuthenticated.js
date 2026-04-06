// middleware/isAuthenticated.js

const createError = require('http-errors');

module.exports = async function (req, res, next) {
  if (!req.user) {
    return next(createError(401, 'Not authenticated!'));
  }
  next();
};
