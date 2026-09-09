/**
 * Local Test Auth Adapter — PLAT-3
 *
 * Test-only adapter that accepts X-Test-Actor-PublicId header.
 * Resolves actor from DB by public_id. No tokens, no secrets.
 *
 * INVARIANT: This adapter MUST NEVER activate in production or on any
 * remotely accessible deployment. It is restricted to:
 * - NODE_ENV === 'test' (automated tests)
 * - ALLOW_TEST_AUTH === 'true' (explicit local development opt-in)
 *
 * Railway DEV/PROD both run NODE_ENV=production and must never set
 * ALLOW_TEST_AUTH. The Workspace uses OIDC for remote browser auth.
 */

import type { Request } from 'express';
import type { AuthAdapter, IdentityEvidence } from './types';

function isTestAuthAllowed(): boolean {
  if (process.env.NODE_ENV === 'test') return true;
  if (process.env.ALLOW_TEST_AUTH === 'true' && process.env.NODE_ENV === 'development') return true;
  return false;
}

export const localTestAdapter: AuthAdapter = {
  name: 'local_test',

  async extractIdentity(req: Request): Promise<IdentityEvidence | null> {
    if (!isTestAuthAllowed()) {
      return null;
    }

    const actorPublicId = req.headers['x-test-actor-publicid'] as string | undefined;
    if (!actorPublicId) {
      return null;
    }

    return {
      provider: 'local_test',
      providerSubject: actorPublicId,
      displayName: undefined,
    };
  },
};
