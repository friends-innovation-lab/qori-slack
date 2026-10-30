/**
 * Create Discovery Run Mutation — DISC-3, DISC-WEB-1C-2a
 *
 * Creates a new Discovery run (desk_research or stakeholder_synthesis).
 * Returns pending run immediately. Worker processes asynchronously.
 *
 * Supports two paths:
 * - Legacy sources[]: Full extracted text in request body (Slack, StakeholderIntake)
 * - sourceRefs[]: Reference tokens from extraction staging (DeskIntake with DISC-WEB-1C)
 *
 * sourceRefs path requires Idempotency-Key header for replay protection.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { HTTPError } from 'ky';
import { api } from '@/api/client';
import { discoveryKeys } from '@/api/queries/useDiscovery';
import type {
  DiscoveryRunSummary,
  CreateDiscoveryRunLegacyInput,
  CreateDiscoveryRunFromRefsInput,
  CreateDiscoveryRunInput,
} from '@qori/api-contracts';

// ─── Local Type Guards ─────────────────────────────────────────────
// NOTE: These are defined locally to avoid ESM/CJS interop issues.
// The api-contracts package compiles to CommonJS and Vite's ESM loader
// cannot resolve runtime function exports re-exported via __exportStar.
// See: DISC-WEB-1C-2a-R1 fix for details.

/**
 * Type guard to check if input uses sourceRefs path.
 */
function isSourceRefsInput(
  input: CreateDiscoveryRunInput,
): input is CreateDiscoveryRunFromRefsInput {
  return 'sourceRefs' in input && Array.isArray((input as CreateDiscoveryRunFromRefsInput).sourceRefs);
}

// ─── Response Types ────────────────────────────────────────────────

export interface CreateDiscoveryRunResponse {
  data: DiscoveryRunSummary;
  meta: {
    message: string;
    /** Whether this was an idempotent replay (sourceRefs path only) */
    isReplay?: boolean;
    pollUrl: string;
    recommendedPollInterval: string;
  };
}

// ─── Error Codes ───────────────────────────────────────────────────

/** Feature flag is disabled */
export const ERROR_FEATURE_DISABLED = 'FEATURE_DISABLED';

/** Idempotency key reused with different payload */
export const ERROR_IDEMPOTENCY_CONFLICT = 'IDEMPOTENCY_CONFLICT';

/** Source refs expired, consumed, or invalid */
export const ERROR_SOURCE_REF_UNAVAILABLE = 'SOURCE_REF_UNAVAILABLE';

// ─── Mutation Variables ────────────────────────────────────────────

/**
 * Variables for legacy sources[] path.
 * No idempotency key required.
 */
export interface CreateRunLegacyVariables {
  input: CreateDiscoveryRunLegacyInput;
}

/**
 * Variables for sourceRefs[] path.
 * Idempotency key is REQUIRED for replay protection.
 */
export interface CreateRunFromRefsVariables {
  input: CreateDiscoveryRunFromRefsInput;
  /**
   * UUID v4 idempotency key for replay protection.
   * Same key + same payload = same run returned (HTTP 200).
   * Same key + different payload = HTTP 409 Conflict.
   * Generate with crypto.randomUUID() per submission attempt.
   */
  idempotencyKey: string;
}

/**
 * Union type for mutation variables.
 * Use type guards to determine which path is being used.
 */
export type CreateDiscoveryRunVariables =
  | CreateRunLegacyVariables
  | CreateRunFromRefsVariables;

/**
 * Type guard to check if variables use sourceRefs path.
 */
export function isSourceRefsVariables(
  variables: CreateDiscoveryRunVariables,
): variables is CreateRunFromRefsVariables {
  return isSourceRefsInput(variables.input);
}

// ─── Result Types ──────────────────────────────────────────────────

export interface CreateRunSuccess {
  success: true;
  response: CreateDiscoveryRunResponse;
  /** HTTP status: 200 for replay, 201 for new creation */
  status: number;
  /** Whether this was an idempotent replay */
  isReplay: boolean;
}

export interface CreateRunError {
  success: false;
  code: string;
  message: string;
  status?: number;
}

export type CreateDiscoveryRunOutcome = CreateRunSuccess | CreateRunError;

// ─── UUID Validation ───────────────────────────────────────────────

const UUID_V4_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate UUID v4 format.
 */
function isValidUuidV4(value: string): boolean {
  return UUID_V4_PATTERN.test(value);
}

// ─── Mutation ──────────────────────────────────────────────────────

/**
 * Create a new Discovery run.
 *
 * For sourceRefs path:
 * - Requires idempotencyKey in variables
 * - Returns existing run on replay (HTTP 200)
 * - Throws on conflict (HTTP 409) or expired refs (HTTP 410)
 *
 * @param projectPublicId - Project public ID
 */
export function useCreateDiscoveryRun(projectPublicId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      variables: CreateDiscoveryRunVariables,
    ): Promise<CreateDiscoveryRunOutcome> => {
      const { input } = variables;

      // Build headers
      const headers: Record<string, string> = {};

      // sourceRefs path requires Idempotency-Key
      if (isSourceRefsVariables(variables)) {
        const { idempotencyKey } = variables;

        // Validate idempotency key format
        if (!idempotencyKey) {
          return {
            success: false,
            code: 'MISSING_IDEMPOTENCY_KEY',
            message: 'Idempotency key is required for sourceRefs requests',
          };
        }

        if (!isValidUuidV4(idempotencyKey)) {
          return {
            success: false,
            code: 'INVALID_IDEMPOTENCY_KEY',
            message: 'Idempotency key must be a valid UUID v4',
          };
        }

        headers['Idempotency-Key'] = idempotencyKey;
      }

      try {
        const response = await api.post(
          `projects/${projectPublicId}/discovery/runs`,
          {
            json: input,
            headers: Object.keys(headers).length > 0 ? headers : undefined,
          },
        );

        const data = await response.json<CreateDiscoveryRunResponse>();
        const status = response.status;

        return {
          success: true,
          response: data,
          status,
          isReplay: status === 200 || data.meta.isReplay === true,
        };
      } catch (error) {
        return handleError(error);
      }
    },
    onSuccess: (outcome) => {
      if (outcome.success) {
        // Invalidate runs list to show the new pending run
        queryClient.invalidateQueries({
          queryKey: discoveryKeys.runs(projectPublicId),
        });
      }
    },
  });
}

// ─── Error Handling ────────────────────────────────────────────────

async function handleError(error: unknown): Promise<CreateRunError> {
  if (error instanceof HTTPError) {
    const status = error.response.status;

    try {
      const body = await error.response.json() as {
        error?: { code?: string; message?: string };
      };

      const code = body.error?.code || 'UNKNOWN_ERROR';
      const message = body.error?.message || `Request failed (${status})`;

      return {
        success: false,
        code,
        message,
        status,
      };
    } catch {
      // JSON parse failed
      return {
        success: false,
        code: 'UNKNOWN_ERROR',
        message: `Request failed (${status})`,
        status,
      };
    }
  }

  // Network or other error
  if (error instanceof Error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        success: false,
        code: 'NETWORK_ERROR',
        message: 'Network error. Please check your connection.',
      };
    }

    return {
      success: false,
      code: 'UNKNOWN_ERROR',
      message: error.message,
    };
  }

  return {
    success: false,
    code: 'UNKNOWN_ERROR',
    message: 'An unexpected error occurred',
  };
}
