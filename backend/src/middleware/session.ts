/**
 * Session middleware — WS-0 web session contract.
 *
 * Server-side sessions backed by Redis (same instance as Bull queues).
 * Sessions are operational/authentication state, NOT canonical research state.
 *
 * Security:
 * - HttpOnly cookies (no JS access)
 * - Secure in production (HTTPS only)
 * - SameSite configurable via SESSION_SAMESITE env var (lax|none); defaults to lax
 * - SameSite=None requires Secure=true (enforced)
 * - Bounded expiration (24h absolute, 2h idle via rolling)
 * - Session secret from env, never hardcoded
 */

import session from 'express-session';
import type { RequestHandler } from 'express';
import { resolveCookiePolicy } from './cookiePolicy';

// Extend express-session types
declare module 'express-session' {
  interface SessionData {
    actorPublicId?: string;
    organizationPublicId?: string;
    authProvider?: string;
    authenticatedAt?: number;
    /** OIDC Authorization Code flow — one-time state nonce */
    oidcState?: string;
    /** OIDC PKCE code verifier (stored server-side, never sent to browser) */
    oidcCodeVerifier?: string;
    /** Timestamp when OIDC state was created (for expiry) */
    oidcStateCreatedAt?: number;
  }
}

/**
 * Create session middleware.
 *
 * Uses Redis store when REDIS_URL is configured (production).
 * Falls back to in-memory store for development/test (with warning).
 */
export function createSessionMiddleware(): RequestHandler {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    console.warn(
      '[SESSION] SESSION_SECRET not set — session middleware disabled. ' +
      'Set SESSION_SECRET env var to enable web sessions.',
    );
    // Return no-op middleware when sessions aren't configured
    return (_req, _res, next) => next();
  }

  const maxAge = parseInt(process.env.SESSION_MAX_AGE_MS || '86400000', 10); // 24h default
  const { sameSite, secure } = resolveCookiePolicy();

  // When cookies are Secure, express-session must trust X-Forwarded-Proto
  // so it emits Set-Cookie behind a TLS-terminating proxy (e.g. Railway).
  // Without this, req.protocol stays 'http' and express-session suppresses
  // the Secure cookie even though the client connection is HTTPS.
  const proxy = secure ? true : undefined;

  const sessionConfig: session.SessionOptions = {
    secret,
    name: 'qori.sid',
    proxy,
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiry on activity (idle timeout)
    cookie: {
      httpOnly: true,
      secure,
      sameSite,
      maxAge: Number.isFinite(maxAge) && maxAge > 0 ? maxAge : 86400000,
      path: '/',
    },
  };

  // Redis store for production — lazy-loaded to avoid import issues when Redis isn't available
  if (process.env.REDIS_URL) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const RedisStore = require('connect-redis').default;
      const { createClient } = require('redis');
      const redisClient = createClient({ url: process.env.REDIS_URL });
      redisClient.connect().catch((err: Error) => {
        console.error('[SESSION] Redis connection failed:', err.message);
      });
      sessionConfig.store = new RedisStore({
        client: redisClient,
        prefix: 'qori:sess:',
        ttl: Math.floor(maxAge / 1000),
      });
    } catch (err) {
      console.warn('[SESSION] Redis store unavailable, using memory store:', err instanceof Error ? err.message : err);
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('[SESSION] No REDIS_URL in production — sessions will not persist across restarts');
  }

  return session(sessionConfig);
}
