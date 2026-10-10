/**
 * Insights Components — DR-4c
 *
 * Public exports for Desk Research Insights UI components.
 * Per SPEC-2 design authority.
 */

// ─── Display Components ──────────────────────────────────────────────────────

export { InsightStatusBadge, OriginTag, InUseBadge } from './InsightStatusBadge';
export type { InsightStatusBadgeProps, OriginTagProps, InUseBadgeProps } from './InsightStatusBadge';

export { InsightRow, getInsightGroup, groupInsights } from './InsightRow';
export type { InsightGroup } from './InsightRow';

export { EvidenceReferenceCard } from './EvidenceReferenceCard';

export { RevisionHistoryItem, RevisionHistory } from './RevisionHistory';

export { InsightDetailPanel } from './InsightDetailPanel';

// ─── Editor & Dialog Components ──────────────────────────────────────────────

export { InsightEditor } from './InsightEditor';
export type { AvailableSource, EditorReference } from './InsightEditor';

export { WithdrawDialog } from './WithdrawDialog';

export { ConflictDialog } from './ConflictDialog';
export type { ConflictType, ConflictVersion, ConflictResolution } from './ConflictDialog';
