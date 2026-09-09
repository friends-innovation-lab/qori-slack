/**
 * Button — Primary (ink fill), secondary (outlined), danger (error fill).
 * One primary per surface. Named for its verb: Generate, Approve, Create.
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = 'primary', icon, loading, children, disabled, className, ...rest },
    ref,
  ) {
    return (
      <button
        ref={ref}
        className={`${styles.button} ${styles[variant]} ${loading ? styles.loading : ''} ${className || ''}`}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...rest}
      >
        {icon && <span className={styles.icon} aria-hidden="true">{icon}</span>}
        {children}
      </button>
    );
  },
);
