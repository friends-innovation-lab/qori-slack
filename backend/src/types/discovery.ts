/**
 * Discovery Types — DISC-2
 *
 * Shared type definitions for Discovery execution.
 * Surface-neutral contracts for Slack and REST adapters.
 */

// ─── Discovery Type ────────────────────────────────────────────────

export type DiscoveryTypeKey = 'desk_research' | 'stakeholder_synthesis' | 'survey_synthesis';

// ─── PreparedDiscoverySource ───────────────────────────────────────
// Surface-neutral prepared source contract.
// Both Slack and REST adapters produce this shape.

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
    /** Slack file ID (if from Slack) */
    slackFileId?: string;
    /** Upload session ID (if from REST) */
    uploadSessionId?: string;
    /** Original source surface */
    source: 'slack' | 'rest' | 'test';
  };
}

// ─── Create Run Input ──────────────────────────────────────────────
// Input for creating a new Discovery run.
// Surface-neutral — both Slack and REST use this.

export interface CreateDiscoveryRunInput {
  /** Project ID (internal) */
  projectId: number;

  /** Project slug (for file paths) */
  projectSlug: string;

  /** Discovery type */
  discoveryType: DiscoveryTypeKey;

  /** Research topic */
  topic: string;

  /** Optional description / source intent */
  sourceIntent?: string | null;

  /** Prepared source documents */
  sources: PreparedDiscoverySource[];

  /** Identity of creator */
  createdByIdentity: string;

  /** Actor ID if known */
  actorId?: number | null;
}

// ─── Run Summary ───────────────────────────────────────────────────
// API response shape for run listing/detail.

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
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

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
}

// ─── Run Detail ────────────────────────────────────────────────────
// Extended run info including sources and artifact summary.

export interface DiscoveryRunDetail extends DiscoveryRunSummary {
  /** Associated sources */
  sources: Array<{
    publicId: string;
    label: string;
    sourceType: string;
    order: number;
  }>;

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

// ─── Execution Result ──────────────────────────────────────────────
// Result of executing a Discovery run.

export interface DiscoveryExecutionResult {
  /** Run public ID */
  runPublicId: string;

  /** Artifact public ID */
  artifactPublicId: string;

  /** Topic slug used */
  topicSlug: string;

  /** Type label */
  typeLabel: string;

  /** GitHub URL */
  githubUrl: string;

  /** Extraction outcome */
  extractionSuccess: boolean;
  extractionVariableCount: number;
}
