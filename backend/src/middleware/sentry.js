// middleware/sentry.js

const { configureScope } = require('@sentry/node');

module.exports = function (req, res, next) {
  if (req.user) {
    configureScope(scope => {
      scope.setUser({ id: req.user.id, email: req.user.email });
    });
  }
  next();
};
