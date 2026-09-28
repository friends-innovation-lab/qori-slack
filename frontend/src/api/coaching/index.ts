/**
 * Coaching API — Coach M3A
 *
 * Barrel export for all coaching API utilities.
 */

export { coachingKeys } from './keys';
export type { CoachHistoryFilters } from './keys';

export { listCoachRuns, createCoachRun, getCoachRun } from './client';
export type { ListCoachRunsParams, CreateCoachRunParams } from './client';

export {
  useCoachHistory,
  useCoachRun,
  useActiveCoachRun,
  isActiveRun,
  isTerminalRun,
} from './queries';
export type { UseCoachHistoryOptions, UseCoachRunOptions } from './queries';

export { useCreateCoachRun, isCoachRunAlreadyActiveError } from './mutations';
export type { UseCreateCoachRunOptions } from './mutations';
