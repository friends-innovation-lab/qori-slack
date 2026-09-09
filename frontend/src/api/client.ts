/**
 * API client — ky instance with CSRF, credentials, and error handling.
 *
 * In local dev, Vite proxies /api to the backend (same-origin).
 * In deployed environments, VITE_API_BASE_URL points to the backend service.
 */

import ky from 'ky';
import type { ApiError } from '@qori/api-contracts';

const baseUrl = import.meta.env.VITE_API_BASE_URL || '';

let csrfToken: string | null = null;

/**
 * Fetch a CSRF token from the backend and store it in memory.
 * Called once on app init and after session establishment.
 */
export async function bootstrapCsrf(): Promise<void> {
  try {
    const res = await ky
      .get(`${baseUrl}/api/v1/auth/csrf-token`, { credentials: 'include' })
      .json<{ data: { token: string } }>();
    csrfToken = res.data.token;
  } catch {
    // CSRF bootstrap failure is not fatal — GET requests work without it.
    // POST/PUT/DELETE will fail with 403, which triggers re-auth.
    csrfToken = null;
  }
}

/**
 * Pre-configured ky instance for all API calls.
 */
export const api = ky.create({
  prefixUrl: `${baseUrl}/api/v1`,
  credentials: 'include',
  hooks: {
    beforeRequest: [
      (request) => {
        if (csrfToken) {
          request.headers.set('X-CSRF-Token', csrfToken);
        }
      },
    ],
    afterResponse: [
      async (_request, _options, response) => {
        if (response.status === 401) {
          // Session expired — redirect to login
          window.location.href = '/login';
        }
      },
    ],
  },
  retry: {
    limit: 0, // No automatic retries — let TanStack Query handle retry logic
  },
});

/**
 * Extract error details from an API error response.
 */
export async function extractApiError(error: unknown): Promise<string> {
  if (error && typeof error === 'object' && 'response' in error) {
    const httpError = error as { response: Response };
    try {
      const body = (await httpError.response.json()) as ApiError;
      return body.error?.message || 'An unexpected error occurred';
    } catch {
      return `Request failed (${httpError.response.status})`;
    }
  }
  return error instanceof Error ? error.message : 'An unexpected error occurred';
}
