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

// ─── CSRF SameSite=None cookie emission ─────────────────────────

describe('CSRF cookie with SameSite=None (Railway cross-site topology)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  function makeRes() {
    const headers: Record<string, string | string[]> = {};
    return {
      getHeader(name: string) { return headers[name]; },
      setHeader(name: string, value: string | string[]) { headers[name] = value; },
      headers,
    };
  }

  it('SESSION_SAMESITE=none emits valid SameSite=None CSRF cookie', () => {
    process.env.SESSION_SAMESITE = 'none';
    process.env.SESSION_SECRET = 'test-csrf-secret';
    const { generateCsrfToken } = require('../../middleware/csrf');
    const res = makeRes();
    const token = generateCsrfToken(res);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    const setCookie = res.headers['Set-Cookie'] as string;
    expect(setCookie).toContain('SameSite=None');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('qori.csrf=');
  });

  it('SameSite=None forces Secure on CSRF cookie', () => {
    process.env.SESSION_SAMESITE = 'none';
    process.env.NODE_ENV = 'development';
    process.env.SESSION_SECRET = 'test-csrf-secret';
    const { generateCsrfToken } = require('../../middleware/csrf');
    const res = makeRes();
    generateCsrfToken(res);
    const setCookie = res.headers['Set-Cookie'] as string;
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=None');
  });

  it('SESSION_SAMESITE=lax emits valid Lax CSRF cookie', () => {
    process.env.SESSION_SAMESITE = 'lax';
    process.env.SESSION_SECRET = 'test-csrf-secret';
    const { generateCsrfToken } = require('../../middleware/csrf');
    const res = makeRes();
    generateCsrfToken(res);
    const setCookie = res.headers['Set-Cookie'] as string;
    expect(setCookie).toContain('SameSite=Lax');
  });

  it('SESSION_SAMESITE=strict emits valid Strict CSRF cookie', () => {
    process.env.SESSION_SAMESITE = 'strict';
    process.env.SESSION_SECRET = 'test-csrf-secret';
    const { generateCsrfToken } = require('../../middleware/csrf');
    const res = makeRes();
    generateCsrfToken(res);
    const setCookie = res.headers['Set-Cookie'] as string;
    expect(setCookie).toContain('SameSite=Strict');
  });

  it('default (no SESSION_SAMESITE) emits Lax CSRF cookie', () => {
    delete process.env.SESSION_SAMESITE;
    process.env.SESSION_SECRET = 'test-csrf-secret';
    const { generateCsrfToken } = require('../../middleware/csrf');
    const res = makeRes();
    generateCsrfToken(res);
    const setCookie = res.headers['Set-Cookie'] as string;
    expect(setCookie).toContain('SameSite=Lax');
  });

  it('CSRF token matches cookie value (validation path)', () => {
    process.env.SESSION_SAMESITE = 'none';
    process.env.SESSION_SECRET = 'test-csrf-secret';
    const { generateCsrfToken } = require('../../middleware/csrf');
    const res = makeRes();
    const token = generateCsrfToken(res);
    const setCookie = res.headers['Set-Cookie'] as string;
    // Cookie value is token.signature — token portion must match returned token
    const match = setCookie.match(/qori\.csrf=([^;]+)/);
    expect(match).not.toBeNull();
    const [cookieToken] = match![1].split('.');
    expect(cookieToken).toBe(token);
  });

  it('malformed SESSION_SAMESITE falls back to lax', () => {
    process.env.SESSION_SAMESITE = 'INVALID_VALUE';
    process.env.SESSION_SECRET = 'test-csrf-secret';
    const { generateCsrfToken } = require('../../middleware/csrf');
    const res = makeRes();
    // Should not throw — falls back to lax
    generateCsrfToken(res);
    const setCookie = res.headers['Set-Cookie'] as string;
    expect(setCookie).toContain('SameSite=Lax');
  });
});

// ─── Trusted proxy topology-aware default ───────────────────────

describe('parseTrustedProxy topology-aware default', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns 1 when TRUSTED_PROXY unset and SESSION_SAMESITE=none (Railway proxy)', () => {
    const { parseTrustedProxy } = require('../../middleware/trustedProxy');
    process.env.SESSION_SAMESITE = 'none';
    expect(parseTrustedProxy(undefined)).toBe(1);
  });

  it('returns 1 when TRUSTED_PROXY unset and NODE_ENV=production', () => {
    const { parseTrustedProxy } = require('../../middleware/trustedProxy');
    process.env.NODE_ENV = 'production';
    delete process.env.SESSION_SAMESITE;
    expect(parseTrustedProxy(undefined)).toBe(1);
  });

  it('returns false when TRUSTED_PROXY unset in local dev (no proxy)', () => {
    const { parseTrustedProxy } = require('../../middleware/trustedProxy');
    process.env.NODE_ENV = 'development';
    delete process.env.SESSION_SAMESITE;
    expect(parseTrustedProxy(undefined)).toBe(false);
  });

  it('returns 1 when TRUSTED_PROXY explicitly "false" in production (topology override)', () => {
    const { parseTrustedProxy } = require('../../middleware/trustedProxy');
    process.env.NODE_ENV = 'production';
    expect(parseTrustedProxy('false')).toBe(1);
  });

  it('explicit TRUSTED_PROXY value overrides topology default', () => {
    const { parseTrustedProxy } = require('../../middleware/trustedProxy');
    process.env.SESSION_SAMESITE = 'none';
    expect(parseTrustedProxy('2')).toBe(2);
    expect(parseTrustedProxy('loopback')).toBe('loopback');
  });

  it('proxied request with X-Forwarded-For does not conflict with trust proxy=1', () => {
    // Simulates that express-rate-limit will not throw ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
    // when trust proxy is set to 1 (not false)
    const { parseTrustedProxy } = require('../../middleware/trustedProxy');
    process.env.SESSION_SAMESITE = 'none';
    const result = parseTrustedProxy(undefined);
    // express-rate-limit throws when result === false and X-Forwarded-For is present
    // result must NOT be false in proxy topology
    expect(result).not.toBe(false);
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThan(0);
  });
});
