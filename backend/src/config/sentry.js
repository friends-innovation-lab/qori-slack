// config/sentry.js

const Sentry = require('@sentry/node');
const Tracing = require('@sentry/tracing');

const { NODE_ENV, SENTRY_DSN } = process.env;

module.exports = function(app) {
  return {
    dsn: NODE_ENV !== 'development' ? SENTRY_DSN : undefined,
    environment: NODE_ENV,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Tracing.Integrations.Express({ app }),
      new Tracing.Integrations.Postgres(),
    ],
    tracesSampleRate: 1.0,
  };
};
