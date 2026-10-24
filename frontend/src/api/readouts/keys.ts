/**
 * Readouts Query Keys — DR-6b-4a
 *
 * TanStack Query key factory for Desk Research Readouts.
 * Keys are scoped by project and study per DR-6b-3 resource model.
 *
 * Key structure includes both projectPublicId and studyPublicId to ensure
 * cache isolation across the nested resource hierarchy.
 */

import type { PaginationParams } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// NORMALIZED FILTERS
// ═══════════════════════════════════════════════════════════════════════════

interface NormalizedPagination {
  limit: number;
  offset: number;
}

/**
 * Normalize pagination params for consistent cache keys.
 * Defaults match backend defaults.
 */
function normalizePagination(params?: PaginationParams): NormalizedPagination {
  return {
    limit: params?.limit ?? 50,
    offset: params?.offset ?? 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// KEY FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Query key factory for Readouts.
 *
 * Structure:
 * - ['readouts'] — root for all readouts data
 * - ['readouts', 'project', projectPublicId, 'study', studyPublicId] — scope base
 * - [...scope, 'list', pagination] — paginated list
 * - [...scope, 'detail', readoutPublicId] — single readout
 * - [...detail, 'eligibility'] — approval eligibility
 * - [...detail, 'approvals'] — approval history
 * - [...detail, 'versions'] — generation history
 * - [...detail, 'evidence-eligibility', pagination] — eligible evidence
 *
 * Both project and study IDs are included in every scoped key to ensure
 * proper cache isolation when navigating between studies.
 */
export const readoutsKeys = {
  /** Root key for all readouts queries */
  all: ['readouts'] as const,

  /** Scope base for a project and study */
  scope: (projectPublicId: string, studyPublicId: string) =>
    ['readouts', 'project', projectPublicId, 'study', studyPublicId] as const,

  /** Paginated list for a study */
  list: (
    projectPublicId: string,
    studyPublicId: string,
    params?: PaginationParams,
  ) =>
    [
      ...readoutsKeys.scope(projectPublicId, studyPublicId),
      'list',
      normalizePagination(params),
    ] as const,

  /** Single readout detail */
  detail: (
    projectPublicId: string,
    studyPublicId: string,
    readoutPublicId: string,
  ) =>
    [
      ...readoutsKeys.scope(projectPublicId, studyPublicId),
      'detail',
      readoutPublicId,
    ] as const,

  /** Approval eligibility check */
  eligibility: (
    projectPublicId: string,
    studyPublicId: string,
    readoutPublicId: string,
  ) =>
    [
      ...readoutsKeys.detail(projectPublicId, studyPublicId, readoutPublicId),
      'eligibility',
    ] as const,

  /** Approval history */
  approvals: (
    projectPublicId: string,
    studyPublicId: string,
    readoutPublicId: string,
  ) =>
    [
      ...readoutsKeys.detail(projectPublicId, studyPublicId, readoutPublicId),
      'approvals',
    ] as const,

  /** Generation version history */
  versions: (
    projectPublicId: string,
    studyPublicId: string,
    readoutPublicId: string,
  ) =>
    [
      ...readoutsKeys.detail(projectPublicId, studyPublicId, readoutPublicId),
      'versions',
    ] as const,

  /**
   * Eligible evidence for citation.
   * Note: Evidence is project-scoped on backend but accessed via readout endpoint.
   */
  eligibleEvidence: (
    projectPublicId: string,
    studyPublicId: string,
    readoutPublicId: string,
    params?: PaginationParams,
  ) =>
    [
      ...readoutsKeys.detail(projectPublicId, studyPublicId, readoutPublicId),
      'evidence-eligibility',
      normalizePagination(params),
    ] as const,

  /**
   * Generation status for a specific generation request.
   * Used for polling async generation jobs.
   * DR-6b-5d-A
   */
  generationStatus: (
    projectPublicId: string,
    studyPublicId: string,
    readoutPublicId: string,
    generationRequestId: string,
  ) =>
    [
      ...readoutsKeys.detail(projectPublicId, studyPublicId, readoutPublicId),
      'generation-status',
      generationRequestId,
    ] as const,

  /**
   * Version content for a specific generation version.
   * Read-only endpoint for accessing historical generated content.
   * DR-6b-5e-B
   *
   * Key includes versionId (numeric) for cross-readout cache isolation.
   * Historical version content is immutable once completed.
   */
  versionContent: (
    projectPublicId: string,
    studyPublicId: string,
    readoutPublicId: string,
    versionId: number,
  ) =>
    [
      ...readoutsKeys.detail(projectPublicId, studyPublicId, readoutPublicId),
      'version-content',
      versionId,
    ] as const,
};
