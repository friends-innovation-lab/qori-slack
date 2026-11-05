/**
 * CORS Preflight Integration Tests
 *
 * Verifies that browser preflight (OPTIONS) requests from authorized origins
 * receive correct Access-Control-Allow-* headers for cross-origin API calls.
 *
 * Test matrix:
 * - [PREFLIGHT_HEADERS]  OPTIONS request with required headers is allowed
 * - [IDEMPOTENCY_KEY]    Idempotency-Key header is permitted for controlled sessions
 * - [UNAUTHORIZED_ORIGIN] Non-allowed origins are rejected
 * - [CREDENTIALS]        Access-Control-Allow-Credentials is true
 */

import express, { Express } from 'express';
import request from 'supertest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const cors = require('cors');

describe('CORS Preflight', () => {
  const AUTHORIZED_ORIGIN = 'https://qori-workspace-dev.up.railway.app';
  let app: Express;

  beforeAll(() => {
    // Store original env
    const originalOrigins = process.env.CORS_ALLOWED_ORIGINS;
    const originalOrigin = process.env.CORS_ALLOWED_ORIGIN;

    // Set up env for test (mimics Railway dev config)
    process.env.CORS_ALLOWED_ORIGINS = AUTHORIZED_ORIGIN;
    delete process.env.CORS_ALLOWED_ORIGIN;

    // Clear require cache to reload cors config with new env
    jest.resetModules();

    // Load fresh cors config
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const corsConfig = require('../../config/cors');

    // Create test app with CORS middleware
    app = express();
    app.use(cors(corsConfig));

    // Dummy POST endpoint for preflight target
    app.post('/api/v1/projects/:projectId/discovery/controlled-sessions', (_req, res) => {
      res.json({ data: { sessionPublicId: 'test-session' } });
    });

    // Restore env after config loaded
    if (originalOrigins !== undefined) {
      process.env.CORS_ALLOWED_ORIGINS = originalOrigins;
    } else {
      delete process.env.CORS_ALLOWED_ORIGINS;
    }
    if (originalOrigin !== undefined) {
      process.env.CORS_ALLOWED_ORIGIN = originalOrigin;
    }
  });

  describe('preflight OPTIONS from authorized origin', () => {
    it('permits content-type, x-csrf-token, and idempotency-key headers', async () => {
      const response = await request(app)
        .options('/api/v1/projects/test-project/discovery/controlled-sessions')
        .set('Origin', AUTHORIZED_ORIGIN)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type,x-csrf-token,idempotency-key');

      expect(response.status).toBe(200);

      // Verify Access-Control-Allow-Origin matches our origin
      expect(response.headers['access-control-allow-origin']).toBe(AUTHORIZED_ORIGIN);

      // Verify Access-Control-Allow-Headers includes our required headers
      const allowedHeaders = response.headers['access-control-allow-headers'];
      expect(allowedHeaders).toBeDefined();
      const headerList = allowedHeaders.toLowerCase();
      expect(headerList).toContain('content-type');
      expect(headerList).toContain('x-csrf-token');
      expect(headerList).toContain('idempotency-key');

      // Verify credentials are allowed (required for session cookies)
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('permits POST method', async () => {
      const response = await request(app)
        .options('/api/v1/projects/test-project/discovery/controlled-sessions')
        .set('Origin', AUTHORIZED_ORIGIN)
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type');

      expect(response.status).toBe(200);
      // CORS middleware allows all methods by default when origin is valid
      expect(response.headers['access-control-allow-origin']).toBe(AUTHORIZED_ORIGIN);
    });
  });

  describe('preflight from unauthorized origin', () => {
    it('does not include Access-Control-Allow-Origin for unknown origin', async () => {
      const response = await request(app)
        .options('/api/v1/projects/test-project/discovery/controlled-sessions')
        .set('Origin', 'https://malicious-site.example.com')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type,x-csrf-token,idempotency-key');

      // Origin not in allowed list - CORS middleware won't set the header
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('cors config includes Idempotency-Key', () => {
    it('allowedHeaders array contains Idempotency-Key', () => {
      jest.resetModules();
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const corsConfig = require('../../config/cors');
      expect(corsConfig.allowedHeaders).toContain('Idempotency-Key');
    });
  });
});
