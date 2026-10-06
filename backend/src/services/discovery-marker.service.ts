/**
 * Discovery Marker Service — DISC-3B
 *
 * Atomic marker allocation for Discovery runs.
 * Markers are project-scoped and type-scoped (D1, D2, S1, V1, etc.).
 *
 * Concurrency protection:
 * - Uses discovery_marker_counters table with atomic UPDATE ... RETURNING
 * - Unique constraint on (project_id, discovery_type, marker_index) prevents duplicates
 *
 * Invariants:
 * - Marker identity belongs to the DiscoveryRun
 * - Artifact versions retain the same marker as their parent run
 * - Once assigned, marker_index is immutable
 */

import sequelize from '../database';
import type { Transaction } from 'sequelize';
import type { DiscoveryType } from '../database/models/discovery_run';

// ─── Constants ────────────────────────────────────────────────────────────────

export const MARKER_PREFIXES: Record<DiscoveryType, string> = {
  desk_research: 'D',
  stakeholder_synthesis: 'S',
  survey_synthesis: 'V',
};

// ─── Error Types ──────────────────────────────────────────────────────────────

export class MarkerAllocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MarkerAllocationError';
  }
}

// ─── Marker Allocation ────────────────────────────────────────────────────────

/**
 * Allocate the next marker index for a project/type combination.
 *
 * Uses atomic UPDATE ... RETURNING to prevent concurrent duplicate allocation.
 * Creates counter row if it doesn't exist (INSERT ON CONFLICT).
 *
 * @returns The allocated marker index (1-indexed)
 */
export async function allocateMarkerIndex(
  projectId: number,
  discoveryType: DiscoveryType,
  transaction?: Transaction,
): Promise<number> {
  // Use provided transaction or create a new one
  const t = transaction ?? (await sequelize.transaction());
  const shouldCommit = !transaction;

  try {
    // Ensure counter row exists (INSERT ON CONFLICT DO NOTHING)
    await sequelize.query(
      `INSERT INTO discovery_marker_counters (project_id, discovery_type, next_index, created_at, updated_at)
       VALUES (:projectId, :discoveryType, 1, NOW(), NOW())
       ON CONFLICT (project_id, discovery_type) DO NOTHING`,
      {
        replacements: { projectId, discoveryType },
        transaction: t,
      },
    );

    // Atomic allocation: UPDATE ... RETURNING
    // Note: Sequelize query() returns [results, metadata] for raw queries
    const [results] = (await sequelize.query(
      `UPDATE discovery_marker_counters
       SET next_index = next_index + 1,
           updated_at = NOW()
       WHERE project_id = :projectId AND discovery_type = :discoveryType
       RETURNING next_index - 1 AS allocated_index`,
      {
        replacements: { projectId, discoveryType },
        transaction: t,
        raw: true,
      },
    )) as [Array<{ allocated_index: number }>, unknown];

    if (!results || results.length === 0) {
      throw new MarkerAllocationError(
        `Failed to allocate marker for project ${projectId}, type ${discoveryType}`,
      );
    }

    const allocatedIndex = results[0].allocated_index;

    if (shouldCommit) {
      await t.commit();
    }

    return allocatedIndex;
  } catch (error) {
    if (shouldCommit) {
      await t.rollback();
    }
    throw error;
  }
}

/**
 * Format a marker for researcher display.
 *
 * @param discoveryType The discovery type (desk_research, stakeholder_synthesis, survey_synthesis)
 * @param markerIndex The marker index (1-indexed)
 * @returns Formatted marker (e.g., "D1", "S2", "V3")
 */
export function formatMarker(
  discoveryType: DiscoveryType,
  markerIndex: number | null,
): string | null {
  if (markerIndex === null) {
    return null;
  }

  const prefix = MARKER_PREFIXES[discoveryType];
  if (!prefix) {
    return null;
  }

  return `${prefix}${markerIndex}`;
}

/**
 * Get the marker prefix for a discovery type.
 */
export function getMarkerPrefix(discoveryType: DiscoveryType): string {
  return MARKER_PREFIXES[discoveryType] || '?';
}
