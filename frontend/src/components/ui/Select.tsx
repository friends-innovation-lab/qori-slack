/**
 * Select — USWDS-compatible dropdown with Qori styling.
 */

import { forwardRef, type SelectHTMLAttributes, useId } from 'react';
import styles from './Input.module.css';
import selectStyles from './Select.module.css';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label: string;
  hint?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ label, hint, error, options, placeholder, id: externalId, className, ...rest }, ref) {
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
        <select
          ref={ref}
          id={id}
          className={`${styles.input} ${selectStyles.select}`}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          {...rest}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {error && <span id={errorId} className={styles.error} role="alert">{error}</span>}
      </div>
    );
  },
);
