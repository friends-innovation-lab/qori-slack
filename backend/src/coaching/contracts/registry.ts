/**
 * Coaching Contract Registry — Coach M2
 *
 * Central registry for versioned artifact Coaching Contracts.
 * Selects the appropriate contract based on artifact type and configured version.
 */

import type { CoachingContract } from './types';
import { BriefCoachingContractV1 } from './brief/v1/contract';
import { PlanCoachingContractV1 } from './plan/v1/contract';
import { COACH_BRIEF_CONTRACT_VERSION, COACH_PLAN_CONTRACT_VERSION } from '../config';

// ─── Contract Map ───────────────────────────────────────────────────────

/**
 * Map of artifact type → version → contract.
 */
const CONTRACT_REGISTRY: Map<string, Map<string, CoachingContract>> = new Map([
  ['brief', new Map([
    ['1.0.0', BriefCoachingContractV1],
  ])],
  ['plan', new Map([
    ['1.0.0', PlanCoachingContractV1],
  ])],
]);

/**
 * Configured active contract versions per artifact type.
 */
const ACTIVE_VERSIONS: Map<string, string> = new Map([
  ['brief', COACH_BRIEF_CONTRACT_VERSION],
  ['plan', COACH_PLAN_CONTRACT_VERSION],
]);

// ─── Registry Functions ─────────────────────────────────────────────────

/**
 * Get the active coaching contract for an artifact type.
 *
 * @param artifactType - The artifact type (brief, plan)
 * @returns The active contract, or null if not supported
 */
export function getActiveContract(artifactType: string): CoachingContract | null {
  const version = ACTIVE_VERSIONS.get(artifactType);
  if (!version) return null;

  return getContract(artifactType, version);
}

/**
 * Get a specific version of a coaching contract.
 *
 * @param artifactType - The artifact type
 * @param version - The contract version
 * @returns The contract, or null if not found
 */
export function getContract(artifactType: string, version: string): CoachingContract | null {
  const versionMap = CONTRACT_REGISTRY.get(artifactType);
  if (!versionMap) return null;

  return versionMap.get(version) ?? null;
}

/**
 * Get the active contract version for an artifact type.
 *
 * @param artifactType - The artifact type
 * @returns The active version string, or null if not supported
 */
export function getActiveContractVersion(artifactType: string): string | null {
  return ACTIVE_VERSIONS.get(artifactType) ?? null;
}

/**
 * Check if an artifact type is supported for coaching.
 *
 * @param artifactType - The artifact type
 * @returns True if the artifact type has a registered contract
 */
export function isCoachableArtifactType(artifactType: string): boolean {
  return CONTRACT_REGISTRY.has(artifactType);
}

/**
 * Get all supported artifact types.
 *
 * @returns Array of supported artifact type strings
 */
export function getSupportedArtifactTypes(): string[] {
  return Array.from(CONTRACT_REGISTRY.keys());
}

/**
 * Get all registered versions for an artifact type.
 *
 * @param artifactType - The artifact type
 * @returns Array of version strings, or empty array if not supported
 */
export function getAvailableVersions(artifactType: string): string[] {
  const versionMap = CONTRACT_REGISTRY.get(artifactType);
  if (!versionMap) return [];
  return Array.from(versionMap.keys());
}
