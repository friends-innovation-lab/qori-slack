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

// ─── CSRF topology ──────────────────────────────────────────────

describe('CSRF cookie topology', () => {
  it('exports generateCsrfToken and csrfProtection', () => {
    const { generateCsrfToken, csrfProtection } = require('../../middleware/csrf');
    expect(typeof generateCsrfToken).toBe('function');
    expect(typeof csrfProtection).toBe('function');
  });
});
