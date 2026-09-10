/**
 * Shared cookie policy — single source of truth for session and CSRF cookies.
 *
 * Both cookies must agree on SameSite/Secure to work in the same topology
 * (Railway cross-site proxy vs. local same-origin dev).
 *
 * Express 4.16.x bundles cookie@0.3.1 which does not support SameSite=None.
 * express-session uses the top-level cookie@0.7.x (which does).
 * This module normalises the policy and provides a serializer that bypasses
 * Express's outdated res.cookie() for the CSRF cookie.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const cookie = require('cookie') as {
  serialize(name: string, value: string, options?: CookieSerializeOptions): string;
};

interface CookieSerializeOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'lax' | 'none' | 'strict' | boolean;
  path?: string;
  maxAge?: number;
  domain?: string;
}

export interface CookiePolicy {
  sameSite: 'lax' | 'none' | 'strict';
  secure: boolean;
}

/**
 * Resolve the topology-aware cookie policy from environment variables.
 *
 * - SESSION_SAMESITE controls cross-origin behavior ('lax' | 'none' | 'strict')
 * - SameSite=None forces Secure=true (RFC invariant)
 * - Production always uses Secure
 */
export function resolveCookiePolicy(): CookiePolicy {
  const isProd = process.env.NODE_ENV === 'production';
  const rawSameSite = (process.env.SESSION_SAMESITE || 'lax').toLowerCase();
  const sameSite: 'lax' | 'none' | 'strict' =
    rawSameSite === 'none' ? 'none' :
    rawSameSite === 'strict' ? 'strict' : 'lax';
  const secure = sameSite === 'none' ? true : isProd;
  return { sameSite, secure };
}

/**
 * Set a cookie using the top-level cookie package (0.7.x), which supports
 * SameSite=None. Bypasses Express's res.cookie() which delegates to the
 * bundled cookie@0.3.1 (no 'none' support).
 */
export function setRawCookie(
  res: { getHeader(name: string): string | string[] | number | undefined; setHeader(name: string, value: string | string[]): void },
  name: string,
  value: string,
  options: CookieSerializeOptions,
): void {
  const header = cookie.serialize(name, value, options);
  const existing = res.getHeader('Set-Cookie');
  if (!existing) {
    res.setHeader('Set-Cookie', header);
  } else if (typeof existing === 'string') {
    res.setHeader('Set-Cookie', [existing, header]);
  } else if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing.map(String), header]);
  }
}
