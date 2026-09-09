/**
 * Input — USWDS form-group semantics with Qori styling.
 * Label-above, error association via aria-describedby (WCAG 3.3.1).
 */

import { forwardRef, type InputHTMLAttributes, useId } from 'react';
import styles from './Input.module.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, hint, error, id: externalId, className, ...rest }, ref) {
    const generatedId = useId();
    const id = externalId || generatedId;
    const hintId = hint ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

    return (
      <div className={`${styles.group} ${error ? styles.hasError : ''} ${className || ''}`}>
        <label htmlFor={id} className={styles.label}>
          {label}
          {rest.required && <span className={styles.required} aria-hidden="true"> *</span>}
        </label>
        {hint && (
          <span id={hintId} className={styles.hint}>
            {hint}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          className={styles.input}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          {...rest}
        />
        {error && (
          <span id={errorId} className={styles.error} role="alert">
            {error}
          </span>
        )}
      </div>
    );
  },
);
