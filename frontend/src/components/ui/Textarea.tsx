/**
 * Textarea — Multiline input with USWDS form-group semantics.
 */

import { forwardRef, type TextareaHTMLAttributes, useId } from 'react';
import styles from './Input.module.css';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, hint, error, id: externalId, className, ...rest }, ref) {
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
        {hint && <span id={hintId} className={styles.hint}>{hint}</span>}
        <textarea
          ref={ref}
          id={id}
          className={styles.input}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          rows={4}
          style={{ height: 'auto', minHeight: '96px', padding: 'var(--space-2) var(--space-3)' }}
          {...rest}
        />
        {error && <span id={errorId} className={styles.error} role="alert">{error}</span>}
      </div>
    );
  },
);
