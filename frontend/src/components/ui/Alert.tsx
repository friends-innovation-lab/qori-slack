/**
 * Alert — usa-alert styled. Variants: info, success, warning, error.
 * Icon + text, never toast-only for warnings/errors.
 *
 * CC-4: Added appearance="rule" for workspace notices (§3.6).
 */

import type { ReactNode } from 'react';
import { Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import styles from './Alert.module.css';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';
type AlertAppearance = 'banner' | 'rule';

const icons: Record<AlertVariant, typeof Info> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
};

interface AlertProps {
  variant?: AlertVariant;
  /** Display appearance: 'banner' (default) or 'rule' (workspace notices) */
  appearance?: AlertAppearance;
  title?: string;
  children: ReactNode;
  /** Action element (e.g., Button) - only for rule appearance */
  action?: ReactNode;
  className?: string;
}

export function Alert({
  variant = 'info',
  appearance = 'banner',
  title,
  children,
  action,
  className,
}: AlertProps) {
  const Icon = icons[variant];

  // Rule appearance: dot + bold title + text, bottom hairline
  if (appearance === 'rule') {
    return (
      <div
        className={`${styles.notice} ${styles[`notice${variant.charAt(0).toUpperCase() + variant.slice(1)}`]} ${className || ''}`}
        role={variant === 'error' ? 'alert' : 'status'}
      >
        <span className={styles.noticeDot} aria-hidden="true" />
        <span className={styles.noticeBody}>
          {title && <strong className={styles.noticeTitle}>{title}</strong>}
          <span className={styles.noticeText}>{children}</span>
        </span>
        {action && <span className={styles.noticeAction}>{action}</span>}
      </div>
    );
  }

  // Banner appearance (default)
  return (
    <div
      className={`${styles.alert} ${styles[variant]} ${className || ''}`}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <Icon size={20} className={styles.icon} aria-hidden="true" />
      <div className={styles.body}>
        {title && <strong className={styles.title}>{title}</strong>}
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
