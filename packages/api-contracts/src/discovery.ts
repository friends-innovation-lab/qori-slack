/**
 * Qori Discovery API Contracts — DISC-3
 *
 * Types for Discovery runs, artifacts, variables, and knowledge gaps.
 * Mirrors backend/src/types/discovery.ts.
 */

// ─── Discovery Type ────────────────────────────────────────────────

export type DiscoveryTypeKey = 'desk_research' | 'stakeholder_synthesis' | 'survey_synthesis';

// ─── Run Status ────────────────────────────────────────────────────

export type DiscoveryRunStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

// ─── Run Summary ───────────────────────────────────────────────────

export interface DiscoveryRunSummary {
  /** Public UUID */
  publicId: string;

  /** Discovery type */
  discoveryType: DiscoveryTypeKey;

  /** Research topic */
  topic: string;

  /** Topic slug */
  topicSlug: string;

  /** Source intent / description */
  sourceIntent: string | null;

  /** Current status */
  status: DiscoveryRunStatus;

  /** Survey stage (if applicable) */
  stage: string | null;

  /** Number of associated sources */
  sourceCount: number;

  /** Attempt count */
  attemptCount: number;

  /** Timestamps */
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;

  /** Created by identity */
  createdBy: string;

  /** Current artifact public ID (if completed) */
  currentArtifactPublicId: string | null;

  /** Failure info (if failed) */
  failureCode: string | null;
  failureMessage: string | null;

  /** DISC-3B: Stable marker (e.g., "D1", "S2") - null for legacy runs */
  marker: string | null;
}

// ─── Run Detail ────────────────────────────────────────────────────

export interface DiscoveryRunSource {
  publicId: string;
  label: string;
  sourceType: string;
  order: number;
}

export interface DiscoveryRunDetail extends DiscoveryRunSummary {
  /** Associated sources */
  sources: DiscoveryRunSource[];

  /** Current artifact summary (if exists) */
  currentArtifact: DiscoveryArtifactSummary | null;
}

// ─── Artifact Summary ──────────────────────────────────────────────

export interface DiscoveryArtifactSummary {
  /** Public UUID */
  publicId: string;

  /** Run public ID */
  runPublicId: string;

  /** Artifact type */
  artifactType: string;

  /** Title */
  title: string;

  /** Topic slug */
  topicSlug: string;

  /** Version number */
  version: number;

  /** Status */
  status: 'generating' | 'current' | 'superseded' | 'failed';

  /** Template info */
  templateName: string;
  templateVersion: string | null;

  /** Timestamps */
  createdAt: string;

  /** GitHub projection (if available) */
  githubPath: string | null;
  projectedAt: string | null;

  /** DISC-3B: Stable marker (e.g., "D1", "S2") - null for legacy artifacts */
  marker: string | null;
}

// ─── Artifact Detail ───────────────────────────────────────────────

export interface DiscoveryArtifactDetail extends DiscoveryArtifactSummary {
  /** Canonical content (Markdown) */
  canonicalContent: string | null;

  /** Derivation fingerprint */
  derivationFingerprint: string | null;

  /** GitHub SHA */
  githubSha: string | null;

  /** Projection error (if failed) */
  projectionError: string | null;

  /** Supersession info */
  supersededById: string | null;
  supersededAt: string | null;

  /** Source lineage summary */
  sourceCount: number;
}

// ─── DISC-3B: Artifact Variables ────────────────────────────────────

export interface DiscoveryVariableItem {
  /** Variable key (internal schema key) */
  key: string;

  /** Researcher-facing label */
  label: string;

  /** Variable value (scalar, array, or structured) */
  value: unknown;

  /** Variable type (if known) */
  variableType: string | null;

  /** Stable item ID (e.g., "TB-001", "barrier-003") if present */
  itemId: string | null;

  /** Whether this is a pool variable (aggregated across participants) */
  isPool: boolean;

  /** Confidence level (if captured) */
  confidence: string | null;
}

export interface DiscoveryArtifactVariables {
  /** Artifact public ID */
  artifactPublicId: string;

  /** Artifact marker (e.g., "D1") */
  marker: string | null;

  /** Artifact type */
  artifactType: string;

  /** Discovery type label */
  typeLabel: string;

  /** Variables grouped by key */
  variables: DiscoveryVariableItem[];

  /** Total variable count */
  variableCount: number;

  /** Extraction date */
  extractedAt: string | null;
}

// ─── DISC-3B: Knowledge Gaps ────────────────────────────────────────

export interface DiscoveryKnowledgeGap {
  /** Gap content / description */
  gap: string;

  /** Stable item ID if canonical data has one */
  itemId: string | null;

  /** Source artifact public ID */
  sourceArtifactPublicId: string;

  /** Source artifact marker */
  sourceMarker: string | null;

  /** Discovery type of source */
  discoveryType: DiscoveryTypeKey;

  /** Source variable key (e.g., "knowledge_gaps") */
  sourceVariableKey: string;

  /** Extracted at */
  extractedAt: string | null;
}

export interface DiscoveryKnowledgeGapsResponse {
  /** Project ID */
  projectId: number;

  /** Total count of gaps */
  count: number;

  /** Knowledge gaps with provenance */
  gaps: DiscoveryKnowledgeGap[];
}

// ─── API List Response ─────────────────────────────────────────────

export interface DiscoveryRunsResponse {
  data: DiscoveryRunSummary[];
}

export interface DiscoveryArtifactsResponse {
  data: DiscoveryArtifactSummary[];
}

// ─── Create Run Input ──────────────────────────────────────────────

export interface CreateDiscoveryRunInput {
  /** Discovery type */
  discoveryType: 'desk_research' | 'stakeholder_synthesis';

  /** Research topic */
  topic: string;

  /** Optional description / source intent */
  sourceIntent?: string | null;

  /** Prepared source documents */
  sources: PreparedDiscoverySource[];
}

export interface PreparedDiscoverySource {
  /** Original filename */
  filename: string;

  /** Extracted text content (ready for AI processing) */
  extractedText: string;

  /** SHA-256 hash of content (first 32 chars) */
  contentHash: string;

  /** MIME type of original file */
  mimeType: string;

  /** Size of original file in bytes */
  sizeBytes: number;

  /** Source-specific metadata */
  metadata?: {
    /** Original source surface */
    source: 'slack' | 'rest' | 'test';
  };
}

// ─── Discovery Counts (for lifecycle nav) ──────────────────────────

export interface DiscoveryCountsResponse {
  desk: number;
  stakeholder: number;
  survey: number;
  needsReview: {
    desk: boolean;
    stakeholder: boolean;
    survey: boolean;
  };
}
