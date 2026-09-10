/**
 * WS-1: Middleware Tests — CORS, session cookie policy, CSRF topology.
 */

// ─── CORS config ────────────────────────────────────────────────

describe('CORS configuration', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  function loadCorsConfig() {
    return require('../../config/cors');
  }

  it('has credentials: true', () => {
    const config = loadCorsConfig();
    expect(config.credentials).toBe(true);
  });

  it('includes X-CSRF-Token in allowedHeaders', () => {
    const config = loadCorsConfig();
    expect(config.allowedHeaders).toContain('X-CSRF-Token');
  });

  it('includes Content-Type in allowedHeaders', () => {
    const config = loadCorsConfig();
    expect(config.allowedHeaders).toContain('Content-Type');
  });

  it('includes Authorization in allowedHeaders', () => {
    const config = loadCorsConfig();
    expect(config.allowedHeaders).toContain('Authorization');
  });

  it('uses explicit origin from CORS_ALLOWED_ORIGIN', () => {
    process.env.CORS_ALLOWED_ORIGIN = 'https://workspace.example.com';
    delete process.env.CORS_ALLOWED_ORIGINS;
    const config = loadCorsConfig();
    expect(config.origin).toBe('https://workspace.example.com');
  });

  it('uses multiple origins from CORS_ALLOWED_ORIGINS', () => {
    process.env.CORS_ALLOWED_ORIGINS = 'https://a.example.com, https://b.example.com';
    const config = loadCorsConfig();
    expect(config.origin).toEqual(['https://a.example.com', 'https://b.example.com']);
  });

  it('CORS_ALLOWED_ORIGINS takes precedence over CORS_ALLOWED_ORIGIN', () => {
    process.env.CORS_ALLOWED_ORIGIN = 'https://single.example.com';
    process.env.CORS_ALLOWED_ORIGINS = 'https://multi.example.com';
    const config = loadCorsConfig();
    expect(config.origin).toEqual(['https://multi.example.com']);
  });

  it('permissive (undefined) when no env vars set', () => {
    delete process.env.CORS_ALLOWED_ORIGIN;
    delete process.env.CORS_ALLOWED_ORIGINS;
    const config = loadCorsConfig();
    expect(config.origin).toBeUndefined();
  });
});

// ─── Session cookie policy ──────────────────────────────────────

describe('Session cookie policy', () => {
  it('exports createSessionMiddleware', () => {
    const { createSessionMiddleware } = require('../../middleware/session');
    expect(typeof createSessionMiddleware).toBe('function');
  });
});

// ─── Session proxy + secure cookie behind TLS-terminating proxy ──

describe('Session proxy configuration for reverse-proxy HTTPS', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  /**
   * Helper: spy on express-session to capture the options it receives.
   * Returns the SessionOptions passed to the session() call.
   */
  function captureSessionOptions() {
    let captured: Record<string, unknown> | undefined;
    jest.doMock('express-session', () => {
      const fn = (opts: Record<string, unknown>) => {
        captured = opts;
        return (_req: unknown, _res: unknown, next: () => void) => next();
      };
      fn.default = fn;
      return fn;
    });
    // Ensure Redis store doesn't interfere
    delete process.env.REDIS_URL;
    process.env.SESSION_SECRET = 'test-secret-for-proxy-tests';

    const { createSessionMiddleware } = require('../../middleware/session');
    createSessionMiddleware();
    return captured!;
  }

  it('sets proxy: true when SameSite=None (cross-site Railway topology)', () => {
    process.env.SESSION_SAMESITE = 'none';
    const opts = captureSessionOptions();
    expect(opts.proxy).toBe(true);
    expect((opts.cookie as Record<string, unknown>).secure).toBe(true);
    expect((opts.cookie as Record<string, unknown>).sameSite).toBe('none');
  });

  it('sets proxy: true in production (secure cookies require proxy trust)', () => {
    process.env.NODE_ENV = 'production';
    process.env.SESSION_SAMESITE = 'lax';
    const opts = captureSessionOptions();
    expect(opts.proxy).toBe(true);
    expect((opts.cookie as Record<string, unknown>).secure).toBe(true);
  });

  it('does not set proxy when cookies are not Secure (local dev)', () => {
    process.env.NODE_ENV = 'development';
    process.env.SESSION_SAMESITE = 'lax';
    const opts = captureSessionOptions();
    expect(opts.proxy).toBeUndefined();
    expect((opts.cookie as Record<string, unknown>).secure).toBe(false);
  });

  it('saveUninitialized is false (new sessions require explicit save)', () => {
    process.env.SESSION_SAMESITE = 'none';
    const opts = captureSessionOptions();
    expect(opts.saveUninitialized).toBe(false);
  });

  it('SameSite=None forces Secure=true (invariant)', () => {
    process.env.SESSION_SAMESITE = 'none';
    process.env.NODE_ENV = 'development'; // even in dev
    const opts = captureSessionOptions();
    expect((opts.cookie as Record<string, unknown>).secure).toBe(true);
    expect((opts.cookie as Record<string, unknown>).sameSite).toBe('none');
  });

  it('cookie name is qori.sid', () => {
    process.env.SESSION_SAMESITE = 'none';
    const opts = captureSessionOptions();
    expect(opts.name).toBe('qori.sid');
  });
});

// ─── CSRF topology ──────────────────────────────────────────────

describe('CSRF cookie topology', () => {
  it('exports generateCsrfToken and csrfProtection', () => {
    const { generateCsrfToken, csrfProtection } = require('../../middleware/csrf');
    expect(typeof generateCsrfToken).toBe('function');
    expect(typeof csrfProtection).toBe('function');
  });
});
