/**
 * /api/v1/auth — Authentication endpoints for web session management.
 *
 * Provides:
 * - OIDC Authorization Code + PKCE flow (authorize → callback → session)
 * - CSRF token endpoint
 * - Logout / session revocation
 * - Session status check
 * - Legacy POST /callback (Bearer token → session, preserved)
 */

import { Router } from 'express';
import { randomBytes, createHash, timingSafeEqual as cryptoTimingSafeEqual } from 'crypto';
import { requireAuth } from '../../../middleware/auth';
import { generateCsrfToken } from '../../../middleware/csrf';
import { buildApplicationContext } from '../../../middleware/auth/contextBuilder';
import type { IdentityEvidence } from '../../../middleware/auth/types';

const router = Router();

// ─── OIDC Configuration ─────────────────────────────────────────

interface OidcConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  jwksUri: string;
  redirectUri: string;
  postLoginRedirect: string;
}

function getOidcConfig(): OidcConfig | null {
  const issuer = process.env.OIDC_ISSUER;
  const clientId = process.env.OIDC_CLIENT_ID;
  const clientSecret = process.env.OIDC_CLIENT_SECRET;
  const jwksUri = process.env.OIDC_JWKS_URI;
  const redirectUri = process.env.OIDC_REDIRECT_URI;
  const postLoginRedirect = process.env.OIDC_POST_LOGIN_REDIRECT || '/';

  if (!issuer || !clientId || !clientSecret || !jwksUri || !redirectUri) {
    return null;
  }

  return { issuer, clientId, clientSecret, jwksUri, redirectUri, postLoginRedirect };
}

/** PKCE: generate code_verifier (43-128 URL-safe chars) */
function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

/** PKCE: derive code_challenge from verifier using S256 */
function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/** OIDC state nonce expiry: 10 minutes */
const OIDC_STATE_MAX_AGE_MS = 10 * 60 * 1000;

/** Join a path onto an issuer URL without producing double slashes. */
function issuerUrl(issuer: string, path: string): string {
  // new URL(path, base) requires the base to end with '/' for correct
  // resolution when the base has no trailing path component, so we
  // normalise but never strip meaningful path segments.
  const base = issuer.endsWith('/') ? issuer : `${issuer}/`;
  return new URL(path, base).toString();
}

// ─── OIDC Authorization Code + PKCE Flow ────────────────────────

/**
 * GET /api/v1/auth/oidc/authorize
 *
 * Initiates the OIDC Authorization Code + PKCE flow.
 * Generates state nonce and PKCE code_verifier, stores both in server
 * session, and redirects the browser to the IdP authorization endpoint.
 *
 * Fails closed: returns 503 if OIDC is not configured.
 */
router.get('/oidc/authorize', (req, res) => {
  const config = getOidcConfig();
  if (!config) {
    res.status(503).json({
      error: {
        code: 'OIDC_NOT_CONFIGURED',
        message: 'OIDC authentication is not configured on this server',
      },
    });
    return;
  }

  // Generate one-time state nonce and PKCE verifier
  const state = randomBytes(32).toString('hex');
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Store in server session (never exposed to browser)
  if (req.session) {
    req.session.oidcState = state;
    req.session.oidcCodeVerifier = codeVerifier;
    req.session.oidcStateCreatedAt = Date.now();
  }

  // Construct IdP authorization URL
  const authUrl = new URL(issuerUrl(config.issuer, 'authorize'));
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', config.clientId);
  authUrl.searchParams.set('redirect_uri', config.redirectUri);
  authUrl.searchParams.set('scope', 'openid profile email');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', codeChallenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  // Save session before redirect (ensures state is persisted)
  req.session?.save((err) => {
    if (err) {
      console.error('[AUTH/OIDC] Failed to save session before redirect:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Authentication initiation failed' },
      });
      return;
    }
    res.redirect(authUrl.toString());
  });
});

/**
 * GET /api/v1/auth/oidc/callback
 *
 * Handles the IdP redirect after user authentication.
 * Validates state, exchanges authorization code for tokens,
 * verifies the ID token, resolves the Qori actor, and establishes
 * a server-side session.
 *
 * Security:
 * - State nonce verified and consumed (one-time use)
 * - PKCE code_verifier sent with token exchange
 * - Confidential client: client_secret used server-side
 * - ID token validated: issuer, audience, signature, exp, nbf, sub
 * - Session regenerated to prevent fixation
 * - No tokens stored in browser
 */
router.get('/oidc/callback', async (req, res) => {
  const config = getOidcConfig();
  if (!config) {
    res.status(503).json({
      error: { code: 'OIDC_NOT_CONFIGURED', message: 'OIDC not configured' },
    });
    return;
  }

  const { code, state, error: oidcError, error_description: oidcErrorDesc } = req.query;

  // IdP returned an error
  if (oidcError) {
    console.error(`[AUTH/OIDC] IdP error: ${oidcError} — ${oidcErrorDesc || 'no description'}`);
    res.status(401).json({
      error: {
        code: 'OIDC_IDP_ERROR',
        message: `Authentication failed: ${oidcErrorDesc || oidcError}`,
      },
    });
    return;
  }

  if (!code || typeof code !== 'string') {
    res.status(400).json({
      error: { code: 'OIDC_MISSING_CODE', message: 'Missing authorization code' },
    });
    return;
  }

  if (!state || typeof state !== 'string') {
    res.status(400).json({
      error: { code: 'OIDC_MISSING_STATE', message: 'Missing state parameter' },
    });
    return;
  }

  // ── Verify state nonce ──────────────────────────────────────
  const sessionState = req.session?.oidcState;
  const sessionCodeVerifier = req.session?.oidcCodeVerifier;
  const sessionStateCreatedAt = req.session?.oidcStateCreatedAt;

  // Clear OIDC state immediately (one-time use, prevents replay)
  if (req.session) {
    delete req.session.oidcState;
    delete req.session.oidcCodeVerifier;
    delete req.session.oidcStateCreatedAt;
  }

  if (!sessionState || !sessionCodeVerifier) {
    res.status(400).json({
      error: {
        code: 'OIDC_STATE_MISSING',
        message: 'No pending OIDC flow found. Please start the sign-in process again.',
      },
    });
    return;
  }

  // Constant-time comparison to prevent timing attacks
  if (state.length !== sessionState.length || !safeEqual(state, sessionState)) {
    console.error('[AUTH/OIDC] State mismatch — possible CSRF or replay');
    res.status(400).json({
      error: { code: 'OIDC_STATE_MISMATCH', message: 'Invalid state parameter' },
    });
    return;
  }

  // Check state age
  if (sessionStateCreatedAt && Date.now() - sessionStateCreatedAt > OIDC_STATE_MAX_AGE_MS) {
    res.status(400).json({
      error: {
        code: 'OIDC_STATE_EXPIRED',
        message: 'Sign-in flow expired. Please try again.',
      },
    });
    return;
  }

  // ── Exchange authorization code for tokens ──────────────────
  let tokenResponse: { id_token?: string; access_token?: string };
  try {
    const tokenUrl = issuerUrl(config.issuer, 'oauth/token');
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code_verifier: sessionCodeVerifier,
    });

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text();
      console.error(`[AUTH/OIDC] Token exchange failed (${tokenRes.status}):`, errBody);
      res.status(401).json({
        error: { code: 'OIDC_TOKEN_EXCHANGE_FAILED', message: 'Authentication failed during token exchange' },
      });
      return;
    }

    tokenResponse = await tokenRes.json() as { id_token?: string; access_token?: string };
  } catch (err) {
    console.error('[AUTH/OIDC] Token exchange error:', err instanceof Error ? err.message : err);
    res.status(502).json({
      error: { code: 'OIDC_TOKEN_EXCHANGE_ERROR', message: 'Could not reach identity provider' },
    });
    return;
  }

  const idToken = tokenResponse.id_token;
  if (!idToken) {
    res.status(401).json({
      error: { code: 'OIDC_NO_ID_TOKEN', message: 'Identity provider did not return an ID token' },
    });
    return;
  }

  // ── Verify ID token ─────────────────────────────────────────
  let payload: { sub?: string; iss?: string; name?: unknown };
  try {
    const jose = await import('jose');
    const jwks = jose.createRemoteJWKSet(new URL(config.jwksUri));
    const result = await jose.jwtVerify(idToken, jwks, {
      issuer: config.issuer,
      audience: config.clientId,
      clockTolerance: 30,
    });
    payload = result.payload;
  } catch (err) {
    console.error('[AUTH/OIDC] ID token verification failed:', err instanceof Error ? err.message : err);
    res.status(401).json({
      error: { code: 'OIDC_TOKEN_INVALID', message: 'ID token verification failed' },
    });
    return;
  }

  if (!payload.sub) {
    res.status(401).json({
      error: { code: 'OIDC_MISSING_SUB', message: 'ID token missing subject claim' },
    });
    return;
  }

  if (!payload.iss) {
    res.status(401).json({
      error: { code: 'OIDC_MISSING_ISS', message: 'ID token missing issuer claim' },
    });
    return;
  }

  // ── Resolve Qori actor ──────────────────────────────────────
  const evidence: IdentityEvidence = {
    provider: 'oidc',
    providerSubject: payload.sub,
    providerIssuer: payload.iss,
    displayName: typeof payload.name === 'string' ? payload.name : undefined,
  };

  let ctx;
  try {
    ctx = await buildApplicationContext(evidence);
  } catch (err) {
    console.error('[AUTH/OIDC] Actor resolution failed:', err instanceof Error ? err.message : err);
    res.status(403).json({
      error: {
        code: 'OIDC_ACTOR_UNKNOWN',
        message: 'Your identity provider account is not linked to a Qori organization. Contact your administrator.',
      },
    });
    return;
  }

  // ── Establish session (regenerate to prevent fixation) ──────
  req.session?.regenerate((regenErr) => {
    if (regenErr) {
      console.error('[AUTH/OIDC] Session regeneration failed:', regenErr);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Authentication failed' },
      });
      return;
    }

    req.session.actorPublicId = ctx.actor.publicId;
    req.session.organizationPublicId = ctx.organization.publicId;
    req.session.authProvider = 'oidc';
    req.session.authenticatedAt = Date.now();

    req.session.save((saveErr) => {
      if (saveErr) {
        console.error('[AUTH/OIDC] Session save failed:', saveErr);
        res.status(500).json({
          error: { code: 'INTERNAL_ERROR', message: 'Authentication failed' },
        });
        return;
      }

      // Redirect to Workspace (or configured post-login URL)
      res.redirect(config.postLoginRedirect);
    });
  });
});

/** Constant-time string comparison */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return cryptoTimingSafeEqual(bufA, bufB);
}

// ─── CSRF / Session / Logout ────────────────────────────────────

/**
 * GET /api/v1/auth/csrf-token
 * Returns a CSRF token for the current session. Sets the CSRF cookie.
 */
router.get('/csrf-token', (req, res) => {
  const token = generateCsrfToken(res);
  res.json({ data: { token } });
});

/**
 * POST /api/v1/auth/callback
 * OIDC callback — receives identity evidence and establishes a session.
 *
 * In production, the OIDC flow works as:
 * 1. Browser redirects to IdP authorization endpoint
 * 2. IdP authenticates user, redirects back with authorization code
 * 3. Backend exchanges code for tokens (server-side)
 * 4. Backend validates ID token, creates session
 * 5. Browser receives session cookie
 *
 * This endpoint handles step 4-5. The actual OIDC code exchange
 * must be implemented per-IdP when a live IdP is available.
 * For now, this accepts a Bearer token (ID token) and establishes a session.
 */
router.post('/callback', requireAuth, (req, res) => {
  if (!req.ctx) {
    res.status(401).json({ error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication failed' } });
    return;
  }

  // Establish session from the authenticated context
  if (req.session) {
    req.session.actorPublicId = req.ctx.actor.publicId;
    req.session.organizationPublicId = req.ctx.organization.publicId;
    req.session.authProvider = req.ctx.authenticationProvider;
    req.session.authenticatedAt = Date.now();
  }

  res.json({
    data: {
      actor_public_id: req.ctx.actor.publicId,
      organization_public_id: req.ctx.organization.publicId,
      session_established: true,
    },
  });
});

/**
 * GET /api/v1/auth/session
 * Check current session status.
 */
router.get('/session', (req, res) => {
  if (!req.session?.actorPublicId) {
    res.json({ data: { authenticated: false } });
    return;
  }

  res.json({
    data: {
      authenticated: true,
      actor_public_id: req.session.actorPublicId,
      organization_public_id: req.session.organizationPublicId,
      authenticated_at: req.session.authenticatedAt
        ? new Date(req.session.authenticatedAt).toISOString()
        : null,
    },
  });
});

/**
 * POST /api/v1/auth/logout
 * Destroy session and clear cookies.
 */
router.post('/logout', (req, res) => {
  if (!req.session) {
    res.json({ data: { logged_out: true } });
    return;
  }

  req.session.destroy((err) => {
    if (err) {
      console.error('[AUTH] Session destruction failed:', err);
      res.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Logout failed' },
      });
      return;
    }

    // Clear session and CSRF cookies
    res.clearCookie('qori.sid', { path: '/' });
    res.clearCookie('qori.csrf', { path: '/' });
    res.json({ data: { logged_out: true } });
  });
});

export default router;
