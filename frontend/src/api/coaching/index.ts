/**
 * Coaching API — Coach M3A/M3B/M3C
 *
 * Barrel export for all coaching API utilities.
 */

export { coachingKeys } from './keys';
export type { CoachHistoryFilters } from './keys';

export { listCoachRuns, createCoachRun, getCoachRun, retryCoachRun } from './client';
export type { ListCoachRunsParams, CreateCoachRunParams } from './client';

export {
  useCoachHistory,
  useCoachRun,
  useActiveCoachRun,
  isActiveRun,
  isTerminalRun,
} from './queries';
export type { UseCoachHistoryOptions, UseCoachRunOptions } from './queries';

export {
  useCreateCoachRun,
  useRetryCoachRun,
  isCoachRunAlreadyActiveError,
  isCoachRunNotRetryableError,
} from './mutations';
export type {
  UseCreateCoachRunOptions,
  CreateCoachRunMutationParams,
  UseRetryCoachRunOptions,
} from './mutations';
