/**
 * InsightStatusBadge — Status display for desk research insights.
 *
 * Per SPEC-2 D1-D7:
 * - proposed: needs review
 * - accepted: in synthesis scope
 * - accepted_with_pending: accepted with draft revision
 * - rejected: never accepted, latest rejected
 * - withdrawn: removed from synthesis
 */

import {
  Circle,
  CheckCircle,
  Clock,
  XCircle,
  Archive,
  Sparkles,
  Pencil,
} from 'lucide-react';
import styles from './insights.module.css';
import type { InsightStatus, RevisionOrigin } from '@qori/api-contracts';

// ─── Status Badge ────────────────────────────────────────────────────────────

const statusConfig: Record<
  InsightStatus,
  { icon: typeof Circle; label: string; className: string }
> = {
  proposed: { icon: Clock, label: 'Needs review', className: 'proposed' },
  accepted: { icon: CheckCircle, label: 'Accepted', className: 'accepted' },
  accepted_with_pending: {
    icon: CheckCircle,
    label: 'Accepted',
    className: 'accepted',
  },
  rejected: { icon: XCircle, label: 'Rejected', className: 'rejected' },
  withdrawn: { icon: Archive, label: 'Withdrawn', className: 'withdrawn' },
};

export interface InsightStatusBadgeProps {
  status: InsightStatus;
  className?: string;
}

export function InsightStatusBadge({ status, className }: InsightStatusBadgeProps) {
  const cfg = statusConfig[status] || {
    icon: Circle,
    label: status,
    className: 'proposed',
  };
  const Icon = cfg.icon;

  return (
    <span className={`${styles.statusBadge} ${styles[cfg.className]} ${className || ''}`}>
      <Icon size={14} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}

// ─── Origin Tag ──────────────────────────────────────────────────────────────

export interface OriginTagProps {
  origin: RevisionOrigin;
  className?: string;
}

/**
 * OriginTag — Shows who proposed the revision.
 * Per DR02: "Proposed by Qori" with sparkles, or pencil for researcher edits.
 */
export function OriginTag({ origin, className }: OriginTagProps) {
  const isAi = origin === 'ai';
  const Icon = isAi ? Sparkles : Pencil;
  const label = isAi ? 'Proposed by Qori' : 'Edited';

  return (
    <span
      className={`${styles.originTag} ${isAi ? styles.originAi : styles.originResearcher} ${className || ''}`}
    >
      <Icon size={12} aria-hidden="true" />
      {label}
    </span>
  );
}

// ─── In Use Badge ────────────────────────────────────────────────────────────

export interface InUseBadgeProps {
  className?: string;
}

/**
 * InUseBadge — Indicates this revision is accepted and eligible for synthesis.
 * Per DR03: "In use" = solid border + 2px success top rule + check badge.
 */
export function InUseBadge({ className }: InUseBadgeProps) {
  return (
    <span className={`${styles.inUseBadge} ${className || ''}`}>
      <CheckCircle size={12} aria-hidden="true" />
      In use
    </span>
  );
}
