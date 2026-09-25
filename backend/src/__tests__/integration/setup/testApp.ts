/**
 * Test App Factory — provides Express app for HTTP integration tests.
 *
 * This module creates an Express app configured for testing:
 * - Uses test database (via DB_* env var override)
 * - Skips Slack Bolt app start
 * - Skips server.listen()
 *
 * Usage:
 *   import { getTestApp } from './setup/testApp';
 *   const app = getTestApp();
 *   const response = await request(app).get('/api/v1/health');
 */

// Set test database env vars BEFORE importing any modules that read them
// This must happen before database/index.ts is imported
process.env.DB_NAME = process.env.TEST_DB_NAME ?? 'qori_test';
process.env.DB_HOST = process.env.TEST_DB_HOST ?? 'localhost';
process.env.DB_PORT = process.env.TEST_DB_PORT ?? '5432';
process.env.DB_USER = process.env.TEST_DB_USER ?? process.env.USER ?? 'qori_test';
process.env.DB_PASSWORD = process.env.TEST_DB_PASSWORD ?? '';
process.env.DB_DIALECT = 'postgres';
process.env.NODE_ENV = 'test';

import express, { Express, Router } from 'express';

// Import after setting env vars
import { apiErrorHandler } from '../../../middleware/apiErrorHandler';

let testAppInstance: Express | null = null;

/**
 * Creates or returns a singleton Express app for testing.
 * Routes are loaded lazily to ensure env vars are set first.
 */
export function getTestApp(): Express {
  if (testAppInstance) return testAppInstance;

  const app = express();

  // Minimal middleware for API testing (skip cors/compression for simplicity)
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Mount API routes - dynamic import to ensure DB_* vars are set
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const apiRouterModule = require('../../../routes/api');
  const apiRouter: Router = apiRouterModule.default || apiRouterModule;
  app.use('/api', apiRouter);

  // API error handler
  app.use('/api', apiErrorHandler);

  // Generic 404 handler
  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  });

  testAppInstance = app;
  return app;
}

/**
 * Reset the test app instance. Call after tests that modify global state.
 */
export function resetTestApp(): void {
  testAppInstance = null;
}
