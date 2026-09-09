/**
 * Alert — usa-alert styled. Variants: info, success, warning, error.
 * Icon + text, never toast-only for warnings/errors.
 */

import type { ReactNode } from 'react';
import { Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import styles from './Alert.module.css';

type AlertVariant = 'info' | 'success' | 'warning' | 'error';

const icons: Record<AlertVariant, typeof Info> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: XCircle,
};

interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Alert({ variant = 'info', title, children, className }: AlertProps) {
  const Icon = icons[variant];

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
