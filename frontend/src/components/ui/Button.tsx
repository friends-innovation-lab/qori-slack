/**
 * Button — Primary (ink fill), secondary (outlined), danger (error fill).
 * One primary per surface. Named for its verb: Generate, Approve, Create.
 *
 * CC-4: Added size prop (§3.17) - 'md' (default, 40px) or 'sm' (32px).
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'md' | 'sm';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Size: 'md' (40px, default) or 'sm' (32px, for headers/rails) */
  size?: ButtonSize;
  icon?: ReactNode;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = 'primary', size = 'md', icon, loading, children, disabled, className, ...rest },
    ref,
  ) {
    const sizeClass = size === 'sm' ? styles.sm : '';

    return (
      <button
        ref={ref}
        className={`${styles.button} ${styles[variant]} ${sizeClass} ${loading ? styles.loading : ''} ${className || ''}`}
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
