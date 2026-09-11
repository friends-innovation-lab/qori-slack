/**
 * StatusBadge — Workflow state with icon + label.
 * Color never alone — always shape + glyph + text.
 */

import { Circle, CheckCircle, Clock, FileText, Archive, Sparkles, AlertTriangle } from 'lucide-react';
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
  | 'candidate';

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
