/**
 * Create Researcher Controlled Run Mutation — DISC-WEB-2
 *
 * Creates a researcher-controlled Discovery run via POST /controlled-runs.
 * This endpoint creates both a researcher session (fixed server-side budget)
 * and a controlled Discovery run in a single atomic transaction.
 *
 * Key differences from regular useCreateDiscoveryRun:
 * - Targets /controlled-runs endpoint (not /runs)
 * - Always requires sourceRefs (no legacy sources[] path)
 * - Returns session info with budget details
 * - Uses researcher-specific error codes
 *
 * Idempotency key is REQUIRED for replay protection.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { HTTPError } from 'ky';
import { api } from '@/api/client';
import { discoveryKeys } from '@/api/queries/useDiscovery';
import type { DiscoveryRunSummary } from '@qori/api-contracts';

// ─── Response Types ────────────────────────────────────────────────

/**
 * Budget information from the created researcher session.
 */
export interface ResearcherSessionBudget {
  maxRequests: number;
  maxInputTokens: number;
  maxOutputTokens: number;
}

/**
 * Session info returned with the run.
 */
export interface ResearcherSessionInfo {
  publicId: string;
  budget: ResearcherSessionBudget;
}

/**
 * Extended run summary with session info.
 */
export interface ResearcherControlledRunResponse {
  data: DiscoveryRunSummary & {
    session: ResearcherSessionInfo;
  };
  meta: {
    message: string;
    isReplay: boolean;
    isControlled: boolean;
    sessionType: 'researcher';
    pollUrl: string;
    recommendedPollInterval: string;
  };
}

// ─── Error Codes ───────────────────────────────────────────────────

/** Feature flag is disabled (DISC_WEB2_RESEARCHER_ENABLED) */
export const ERROR_RESEARCHER_EXECUTION_DISABLED = 'RESEARCHER_EXECUTION_DISABLED';

/** Actor already has an active researcher session */
export const ERROR_RESEARCHER_SESSION_ACTIVE = 'RESEARCHER_SESSION_ACTIVE';

/** Idempotency key reused with different payload */
export const ERROR_IDEMPOTENCY_CONFLICT = 'IDEMPOTENCY_CONFLICT';

/** Source refs expired, consumed, or invalid */
export const ERROR_SOURCE_REF_UNAVAILABLE = 'SOURCE_REF_UNAVAILABLE';

/** Authorization denied (actor not project member) */
export const ERROR_AUTHORIZATION_DENIED = 'AUTHORIZATION_DENIED';

// ─── Mutation Variables ────────────────────────────────────────────

/**
 * Input for creating a researcher-controlled run.
 */
export interface CreateResearcherControlledRunInput {
  discoveryType: 'desk_research' | 'stakeholder_synthesis';
  topic: string;
  sourceIntent?: string | null;
  sourceRefs: string[];
}

/**
 * Variables for the mutation.
 */
export interface CreateResearcherControlledRunVariables {
  input: CreateResearcherControlledRunInput;
  /**
   * UUID v4 idempotency key for replay protection.
   * Same key + same payload = same run returned (HTTP 200).
   * Same key + different payload = HTTP 409 Conflict.
   * Generate with crypto.randomUUID() per submission attempt.
   */
  idempotencyKey: string;
}

// ─── Result Types ──────────────────────────────────────────────────

export interface CreateResearcherControlledRunSuccess {
  success: true;
  response: ResearcherControlledRunResponse;
  /** HTTP status: 200 for replay, 201 for new creation */
  status: number;
  /** Whether this was an idempotent replay */
  isReplay: boolean;
}

export interface CreateResearcherControlledRunError {
  success: false;
  code: string;
  message: string;
  status?: number;
}

export type CreateResearcherControlledRunOutcome =
  | CreateResearcherControlledRunSuccess
  | CreateResearcherControlledRunError;

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
 * Create a researcher-controlled Discovery run.
 *
 * This mutation:
 * - Creates a researcher session with fixed server-side budget
 * - Creates a controlled Discovery run bound to the session
 * - Returns session info with budget details
 *
 * The run will be processed by the researcher background worker.
 *
 * @param projectPublicId - Project public ID
 */
export function useCreateResearcherControlledRun(projectPublicId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      variables: CreateResearcherControlledRunVariables,
    ): Promise<CreateResearcherControlledRunOutcome> => {
      const { input, idempotencyKey } = variables;

      // Validate idempotency key
      if (!idempotencyKey) {
        return {
          success: false,
          code: 'MISSING_IDEMPOTENCY_KEY',
          message: 'Idempotency key is required for researcher-controlled runs',
        };
      }

      if (!isValidUuidV4(idempotencyKey)) {
        return {
          success: false,
          code: 'INVALID_IDEMPOTENCY_KEY',
          message: 'Idempotency key must be a valid UUID v4',
        };
      }

      try {
        const response = await api.post(
          `projects/${projectPublicId}/discovery/controlled-runs`,
          {
            json: input,
            headers: {
              'Idempotency-Key': idempotencyKey,
            },
          },
        );

        const data = await response.json<ResearcherControlledRunResponse>();
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

async function handleError(error: unknown): Promise<CreateResearcherControlledRunError> {
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
