/**
 * Readout Generation Validator — DR-6b-5b
 *
 * Strict post-generation validation for AI-generated readout content.
 * Treats model output as untrusted and validates against the persisted
 * evidence snapshot.
 *
 * Validation failures result in generation failure, NOT silent repair.
 *
 * Validation checks:
 * 1. JSON structure and required sections
 * 2. Finding IDs, citations, and content
 * 3. Citation identities against evidence snapshot
 * 4. Implication structure and finding links
 * 5. Limitation structure
 * 6. Payload size and unexpected fields
 */

import type { DraftContent } from '../database/models/desk_research_readout_draft';
import type { EvidenceSetEntry } from '../database/models/desk_research_readout_version';

// ─── Configuration ─────────────────────────────────────────────────

const MAX_PAYLOAD_SIZE_BYTES = 100 * 1024; // 100KB
const FINDING_ID_PATTERN = /^F\d+$/;
const IMPLICATION_ID_PATTERN = /^I\d+$/;
const LIMITATION_ID_PATTERN = /^L\d+$/;
const VALID_IMPLICATION_KINDS = ['question', 'gap', 'priority', 'hypothesis'] as const;

// ─── Types ─────────────────────────────────────────────────────────

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  details?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  content?: DraftContent;
}

interface RawCitation {
  displayId?: string;
}

interface RawFinding {
  id?: string;
  text?: string;
  citations?: RawCitation[];
}

interface RawLimitation {
  id?: string;
  text?: string;
}

interface RawImplication {
  id?: string;
  kind?: string;
  text?: string;
  basedOnFindings?: string[];
}

interface RawOutput {
  summary?: {
    text?: string;
    citations?: RawCitation[];
  };
  findings?: RawFinding[];
  limitations?: RawLimitation[];
  implications?: RawImplication[];
  [key: string]: unknown;
}

// ─── JSON Parsing ──────────────────────────────────────────────────

/**
 * Bounded JSON parsing with strict limits.
 *
 * Uses a simple extraction strategy: find the outermost { } pair.
 * Does NOT attempt aggressive repair of malformed JSON.
 */
export function parseGeneratedJson(raw: string): { parsed: RawOutput | null; error: string | null } {
  // Check payload size
  const byteSize = Buffer.byteLength(raw, 'utf8');
  if (byteSize > MAX_PAYLOAD_SIZE_BYTES) {
    return { parsed: null, error: `Payload size ${byteSize} bytes exceeds limit of ${MAX_PAYLOAD_SIZE_BYTES}` };
  }

  // Find JSON boundaries
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return { parsed: null, error: 'No valid JSON object found in output' };
  }

  const jsonString = raw.slice(firstBrace, lastBrace + 1);

  try {
    const parsed = JSON.parse(jsonString) as RawOutput;
    return { parsed, error: null };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { parsed: null, error: `JSON parse error: ${message}` };
  }
}

// ─── Validation ────────────────────────────────────────────────────

/**
 * Validate AI-generated output against evidence snapshot.
 *
 * Returns validated DraftContent if successful, or errors if validation fails.
 */
export function validateGeneratedOutput(
  rawOutput: string,
  evidenceSet: EvidenceSetEntry[],
): ValidationResult {
  const errors: ValidationError[] = [];

  // Parse JSON
  const { parsed, error: parseError } = parseGeneratedJson(rawOutput);
  if (!parsed) {
    return {
      valid: false,
      errors: [{
        code: 'PARSE_ERROR',
        message: parseError || 'Failed to parse JSON',
      }],
    };
  }

  // Build evidence lookup
  const evidenceDisplayIds = new Set(evidenceSet.map(e => e.displayId));
  const evidenceLookup = new Map(evidenceSet.map(e => [e.displayId, e]));

  // Defensive check: reject duplicate displayIds in evidence snapshot
  // (Database constraints normally prevent this, but verify to avoid silent overwrites)
  if (evidenceDisplayIds.size !== evidenceSet.length) {
    const seenIds = new Set<string>();
    const duplicates: string[] = [];
    for (const entry of evidenceSet) {
      if (seenIds.has(entry.displayId)) {
        duplicates.push(entry.displayId);
      }
      seenIds.add(entry.displayId);
    }
    return {
      valid: false,
      errors: [{
        code: 'DUPLICATE_DISPLAY_ID',
        message: `Evidence snapshot contains duplicate displayId(s): ${duplicates.join(', ')}`,
        details: 'Each displayId must map to exactly one pinned revision tuple',
      }],
    };
  }

  // Check for unexpected top-level fields
  const allowedTopLevelFields = ['summary', 'findings', 'limitations', 'implications'];
  for (const key of Object.keys(parsed)) {
    if (!allowedTopLevelFields.includes(key)) {
      errors.push({
        code: 'UNEXPECTED_FIELD',
        message: `Unexpected top-level field: ${key}`,
        field: key,
      });
    }
  }

  // Validate summary
  if (!parsed.summary || typeof parsed.summary !== 'object') {
    errors.push({
      code: 'MISSING_SECTION',
      message: 'Missing required section: summary',
      field: 'summary',
    });
  } else {
    if (typeof parsed.summary.text !== 'string' || parsed.summary.text.trim().length === 0) {
      errors.push({
        code: 'INVALID_SUMMARY',
        message: 'Summary must have non-empty text',
        field: 'summary.text',
      });
    }
    if (parsed.summary.citations) {
      validateCitations(parsed.summary.citations, 'summary', evidenceDisplayIds, errors);
    }
  }

  // Validate findings
  if (!Array.isArray(parsed.findings) || parsed.findings.length === 0) {
    errors.push({
      code: 'MISSING_SECTION',
      message: 'Findings array is required and must not be empty',
      field: 'findings',
    });
  } else {
    validateFindings(parsed.findings, evidenceDisplayIds, errors);
  }

  // Validate limitations
  if (!Array.isArray(parsed.limitations)) {
    errors.push({
      code: 'MISSING_SECTION',
      message: 'Limitations array is required',
      field: 'limitations',
    });
  } else {
    validateLimitations(parsed.limitations, errors);
  }

  // Validate implications
  const findingIds = new Set(
    (parsed.findings || [])
      .filter((f): f is RawFinding => !!f && typeof f.id === 'string')
      .map(f => f.id as string)
  );

  if (!Array.isArray(parsed.implications) || parsed.implications.length === 0) {
    errors.push({
      code: 'MISSING_SECTION',
      message: 'Implications array is required and must not be empty',
      field: 'implications',
    });
  } else {
    validateImplications(parsed.implications, findingIds, errors);
  }

  // If any errors, return failure
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Transform to DraftContent format
  const content = transformToDraftContent(parsed, evidenceLookup);

  return { valid: true, errors: [], content };
}

function validateCitations(
  citations: RawCitation[],
  context: string,
  evidenceDisplayIds: Set<string>,
  errors: ValidationError[],
): void {
  for (let i = 0; i < citations.length; i++) {
    const citation = citations[i];
    if (!citation || typeof citation.displayId !== 'string') {
      errors.push({
        code: 'INVALID_CITATION',
        message: `Invalid citation at ${context}[${i}]: missing displayId`,
        field: `${context}.citations[${i}]`,
      });
      continue;
    }

    if (!evidenceDisplayIds.has(citation.displayId)) {
      errors.push({
        code: 'FABRICATED_CITATION',
        message: `Citation "${citation.displayId}" at ${context}[${i}] not in evidence snapshot`,
        field: `${context}.citations[${i}]`,
        details: `Valid IDs: ${[...evidenceDisplayIds].join(', ')}`,
      });
    }
  }
}

function validateFindings(
  findings: RawFinding[],
  evidenceDisplayIds: Set<string>,
  errors: ValidationError[],
): void {
  const seenIds = new Set<string>();

  for (let i = 0; i < findings.length; i++) {
    const finding = findings[i];
    const fieldPrefix = `findings[${i}]`;

    // Validate ID
    if (typeof finding.id !== 'string' || !FINDING_ID_PATTERN.test(finding.id)) {
      errors.push({
        code: 'INVALID_FINDING_ID',
        message: `Finding ID must match pattern F1, F2, etc.`,
        field: `${fieldPrefix}.id`,
        details: `Got: ${finding.id}`,
      });
    } else if (seenIds.has(finding.id)) {
      errors.push({
        code: 'DUPLICATE_FINDING_ID',
        message: `Duplicate finding ID: ${finding.id}`,
        field: `${fieldPrefix}.id`,
      });
    } else {
      seenIds.add(finding.id);
    }

    // Validate text
    if (typeof finding.text !== 'string' || finding.text.trim().length === 0) {
      errors.push({
        code: 'INVALID_FINDING_TEXT',
        message: `Finding must have non-empty text`,
        field: `${fieldPrefix}.text`,
      });
    }

    // Validate citations (required, at least one)
    if (!Array.isArray(finding.citations) || finding.citations.length === 0) {
      errors.push({
        code: 'FINDING_WITHOUT_CITATIONS',
        message: `Finding "${finding.id}" must have at least one citation`,
        field: `${fieldPrefix}.citations`,
      });
    } else {
      validateCitations(finding.citations, `findings[${i}]`, evidenceDisplayIds, errors);
    }
  }
}

function validateLimitations(
  limitations: RawLimitation[],
  errors: ValidationError[],
): void {
  const seenIds = new Set<string>();

  for (let i = 0; i < limitations.length; i++) {
    const limitation = limitations[i];
    const fieldPrefix = `limitations[${i}]`;

    // Validate ID
    if (typeof limitation.id !== 'string' || !LIMITATION_ID_PATTERN.test(limitation.id)) {
      errors.push({
        code: 'INVALID_LIMITATION_ID',
        message: `Limitation ID must match pattern L1, L2, etc.`,
        field: `${fieldPrefix}.id`,
        details: `Got: ${limitation.id}`,
      });
    } else if (seenIds.has(limitation.id)) {
      errors.push({
        code: 'DUPLICATE_LIMITATION_ID',
        message: `Duplicate limitation ID: ${limitation.id}`,
        field: `${fieldPrefix}.id`,
      });
    } else {
      seenIds.add(limitation.id);
    }

    // Validate text
    if (typeof limitation.text !== 'string' || limitation.text.trim().length === 0) {
      errors.push({
        code: 'INVALID_LIMITATION_TEXT',
        message: `Limitation must have non-empty text`,
        field: `${fieldPrefix}.text`,
      });
    }
  }
}

function validateImplications(
  implications: RawImplication[],
  findingIds: Set<string>,
  errors: ValidationError[],
): void {
  const seenIds = new Set<string>();

  for (let i = 0; i < implications.length; i++) {
    const impl = implications[i];
    const fieldPrefix = `implications[${i}]`;

    // Validate ID
    if (typeof impl.id !== 'string' || !IMPLICATION_ID_PATTERN.test(impl.id)) {
      errors.push({
        code: 'INVALID_IMPLICATION_ID',
        message: `Implication ID must match pattern I1, I2, etc.`,
        field: `${fieldPrefix}.id`,
        details: `Got: ${impl.id}`,
      });
    } else if (seenIds.has(impl.id)) {
      errors.push({
        code: 'DUPLICATE_IMPLICATION_ID',
        message: `Duplicate implication ID: ${impl.id}`,
        field: `${fieldPrefix}.id`,
      });
    } else {
      seenIds.add(impl.id);
    }

    // Validate kind
    if (!VALID_IMPLICATION_KINDS.includes(impl.kind as typeof VALID_IMPLICATION_KINDS[number])) {
      errors.push({
        code: 'INVALID_IMPLICATION_KIND',
        message: `Implication kind must be one of: ${VALID_IMPLICATION_KINDS.join(', ')}`,
        field: `${fieldPrefix}.kind`,
        details: `Got: ${impl.kind}`,
      });
    }

    // Validate text
    if (typeof impl.text !== 'string' || impl.text.trim().length === 0) {
      errors.push({
        code: 'INVALID_IMPLICATION_TEXT',
        message: `Implication must have non-empty text`,
        field: `${fieldPrefix}.text`,
      });
    }

    // Validate basedOnFindings (required, at least one)
    if (!Array.isArray(impl.basedOnFindings) || impl.basedOnFindings.length === 0) {
      errors.push({
        code: 'IMPLICATION_WITHOUT_FINDINGS',
        message: `Implication "${impl.id}" must link to at least one finding`,
        field: `${fieldPrefix}.basedOnFindings`,
      });
    } else {
      for (const findingId of impl.basedOnFindings) {
        if (!findingIds.has(findingId)) {
          errors.push({
            code: 'INVALID_FINDING_LINK',
            message: `Implication "${impl.id}" references non-existent finding "${findingId}"`,
            field: `${fieldPrefix}.basedOnFindings`,
          });
        }
      }
    }
  }
}

// ─── Transform ─────────────────────────────────────────────────────

/**
 * Transform validated raw output to DraftContent format.
 *
 * Enriches citations with full construct/revision metadata from evidence snapshot.
 */
function transformToDraftContent(
  raw: RawOutput,
  evidenceLookup: Map<string, EvidenceSetEntry>,
): DraftContent {
  const enrichCitation = (c: RawCitation) => {
    const evidence = evidenceLookup.get(c.displayId!);
    if (!evidence) {
      // Should not happen after validation, but defensive
      throw new Error(`Evidence not found for citation: ${c.displayId}`);
    }
    return {
      constructPublicId: evidence.constructPublicId,
      revisionPublicId: evidence.revisionPublicId,
      revisionNumber: evidence.revisionNumber,
      displayId: evidence.displayId,
    };
  };

  return {
    summary: raw.summary ? {
      text: raw.summary.text!,
      citations: (raw.summary.citations || []).map(enrichCitation),
    } : undefined,

    findings: (raw.findings || []).map((f) => ({
      id: f.id!,
      text: f.text!,
      citations: f.citations!.map(enrichCitation),
    })),

    limitations: (raw.limitations || []).map((l) => ({
      id: l.id!,
      text: l.text!,
    })),

    implications: (raw.implications || []).map((impl) => ({
      id: impl.id!,
      kind: impl.kind as 'question' | 'gap' | 'priority' | 'hypothesis',
      text: impl.text!,
      basedOnFindings: impl.basedOnFindings!,
      // No basedOnCitations from generation — implications are based on findings only
    })),
  };
}

// ─── Error Code Constants ──────────────────────────────────────────

export const ErrorCodes = {
  PARSE_ERROR: 'PARSE_ERROR',
  DUPLICATE_DISPLAY_ID: 'DUPLICATE_DISPLAY_ID',
  MISSING_SECTION: 'MISSING_SECTION',
  UNEXPECTED_FIELD: 'UNEXPECTED_FIELD',
  INVALID_SUMMARY: 'INVALID_SUMMARY',
  INVALID_CITATION: 'INVALID_CITATION',
  FABRICATED_CITATION: 'FABRICATED_CITATION',
  INVALID_FINDING_ID: 'INVALID_FINDING_ID',
  DUPLICATE_FINDING_ID: 'DUPLICATE_FINDING_ID',
  INVALID_FINDING_TEXT: 'INVALID_FINDING_TEXT',
  FINDING_WITHOUT_CITATIONS: 'FINDING_WITHOUT_CITATIONS',
  INVALID_LIMITATION_ID: 'INVALID_LIMITATION_ID',
  DUPLICATE_LIMITATION_ID: 'DUPLICATE_LIMITATION_ID',
  INVALID_LIMITATION_TEXT: 'INVALID_LIMITATION_TEXT',
  INVALID_IMPLICATION_ID: 'INVALID_IMPLICATION_ID',
  DUPLICATE_IMPLICATION_ID: 'DUPLICATE_IMPLICATION_ID',
  INVALID_IMPLICATION_KIND: 'INVALID_IMPLICATION_KIND',
  INVALID_IMPLICATION_TEXT: 'INVALID_IMPLICATION_TEXT',
  IMPLICATION_WITHOUT_FINDINGS: 'IMPLICATION_WITHOUT_FINDINGS',
  INVALID_FINDING_LINK: 'INVALID_FINDING_LINK',
} as const;
