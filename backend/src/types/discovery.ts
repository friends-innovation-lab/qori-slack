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

  /** DISC-3B: Stable marker (e.g., "D1", "S2") - null for legacy runs */
  marker: string | null;
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

  /** DR-2: Insight extraction outcome */
  insightExtractionSuccess?: boolean;
  insightsCreated?: number;
  insightsSkipped?: number;
}

// ─── DISC-3B: Artifact Variables ────────────────────────────────────
// Extracted cascade variables for an artifact.

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
// Aggregated knowledge gaps across all current project artifacts.

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

// ─── Variable Label Mapping ─────────────────────────────────────────
// Server-side mapping from schema keys to researcher-facing labels.

export const VARIABLE_LABELS: Record<string, string> = {
  // Desk research
  discovered_barriers: 'Discovered Barriers',
  knowledge_gaps: 'Knowledge Gaps',
  key_themes: 'Key Themes',
  methodology_recommendations: 'Methodology Recommendations',
  participant_recommendations: 'Participant Recommendations',
  ecosystem_map: 'Ecosystem Map',

  // Stakeholder synthesis
  stakeholder_constraints: 'Stakeholder Constraints',
  political_landscape: 'Political Landscape',
  stakeholder_priorities: 'Stakeholder Priorities',
  validated_themes: 'Validated Themes',
  unexpected_patterns: 'Unexpected Patterns',

  // Survey synthesis
  survey_findings: 'Survey Findings',
  response_patterns: 'Response Patterns',
  demographic_insights: 'Demographic Insights',

  // Shared
  target_barriers: 'Target Barriers',
  research_questions: 'Research Questions',
};
