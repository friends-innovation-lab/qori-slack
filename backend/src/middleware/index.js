// middleware/index.js

const authenticationMiddleware = require('./authentication');
const isAuthenticated          = require('./isAuthenticated');
const sentryMiddleware         = require('./sentry');
const validate                 = require('./validate');
const cache                    = require('./cache');

module.exports = {
  authenticationMiddleware,
  isAuthenticated,
  sentryMiddleware,
  validate,
  cache,
};
