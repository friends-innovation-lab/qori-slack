const corsConfig        = require('./cors');
const routerConfig      = require('./router');
const sentryConfig      = require('./sentry');
const compressionConfig = require('./compression');

module.exports = {
  corsConfig,
  routerConfig,
  sentryConfig,
  compressionConfig
};
