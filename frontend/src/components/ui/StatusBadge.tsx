/**
 * StatusBadge — Workflow state with icon + label.
 * Color never alone — always shape + glyph + text.
 *
 * DISC-3 B2: Added Discovery-specific statuses.
 */

import {
  Circle,
  CheckCircle,
  Clock,
  FileText,
  Archive,
  Sparkles,
  AlertTriangle,
  Check,
  LoaderCircle,
  History,
} from 'lucide-react';
import styles from './StatusBadge.module.css';

type BadgeStatus =
  | 'draft'
  | 'active'
  | 'pending_approval'
  | 'approved'
  | 'changes_requested'
  | 'published'
  | 'archived'
  | 'generating'
  | 'candidate'
  // DISC-3 B2: Discovery statuses
  | 'ready'
  | 'processing'
  | 'analyzing'
  | 'pending'
  | 'needs_review'
  | 'expiring'
  | 'failed'
  | 'stale'
  | 'superseded';

const config: Record<BadgeStatus, { icon: typeof Circle; label: string; className: string }> = {
  draft: { icon: FileText, label: 'Draft', className: 'neutral' },
  active: { icon: CheckCircle, label: 'Active', className: 'success' },
  pending_approval: { icon: Clock, label: 'Needs approval', className: 'warning' },
  approved: { icon: CheckCircle, label: 'Approved', className: 'success' },
  changes_requested: { icon: AlertTriangle, label: 'Changes requested', className: 'danger' },
  published: { icon: CheckCircle, label: 'Published', className: 'success' },
  archived: { icon: Archive, label: 'Archived', className: 'muted' },
  generating: { icon: Circle, label: 'Generating...', className: 'info' },
  candidate: { icon: Sparkles, label: 'Suggested', className: 'ai' },
  // DISC-3 B2: Discovery statuses
  ready: { icon: Check, label: 'Ready', className: 'success' },
  processing: { icon: LoaderCircle, label: 'Analyzing', className: 'info' },
  analyzing: { icon: LoaderCircle, label: 'Analyzing', className: 'info' },
  pending: { icon: Clock, label: 'Pending', className: 'info' },
  needs_review: { icon: Circle, label: 'Your review', className: 'brand' },
  expiring: { icon: Clock, label: 'Expiring', className: 'brand' },
  failed: { icon: AlertTriangle, label: 'Failed', className: 'danger' },
  stale: { icon: Circle, label: 'Out of date', className: 'brand' },
  superseded: { icon: History, label: 'Superseded', className: 'muted' },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = config[status as BadgeStatus] || {
    icon: Circle,
    label: status.replace(/_/g, ' '),
    className: 'neutral',
  };
  const Icon = cfg.icon;

  return (
    <span className={`${styles.badge} ${styles[cfg.className]} ${className || ''}`}>
      <Icon size={14} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}
