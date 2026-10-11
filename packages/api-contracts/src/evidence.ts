/**
 * Evidence Source API Contracts — DR-4e
 *
 * Types for evidence source listing and identity.
 * EvidenceSource represents an evidence-bearing input (uploaded document,
 * stakeholder interview, etc.) with canonical identity for insight attribution.
 */

// ─── Source Type ────────────────────────────────────────────────────

export type EvidenceSourceType =
  | 'uploaded_document'
  | 'survey_dataset'
  | 'stakeholder_interview'
  | 'session_transcript'
  | 'session_notes'
  | 'process_document'
  | 'external_reference';

// ─── Evidence Source Summary ────────────────────────────────────────

/**
 * Minimal evidence source identity for insight attribution.
 * Contains only the fields needed for InsightEditor source selection.
 */
export interface EvidenceSourceSummary {
  /** Numeric database ID — required for insight evidence references */
  id: number;

  /** Stable public identifier (UUID) */
  publicId: string;

  /** Human-readable source label */
  label: string;

  /** Source type classification */
  sourceType: EvidenceSourceType;

  /** When the source was created */
  createdAt: string;
}

// ─── API Response ───────────────────────────────────────────────────

export interface EvidenceSourcesResponse {
  data: EvidenceSourceSummary[];
}
