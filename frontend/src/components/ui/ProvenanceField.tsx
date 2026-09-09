/**
 * ProvenanceField — Prefilled-with-provenance form field.
 * Shows source label ("From the approved brief — change if needed") + input.
 * Variants: prefilled (editable), derived (read-only).
 */

import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, useId } from 'react';
import styles from './ProvenanceField.module.css';
import inputStyles from './Input.module.css';

interface ProvenanceFieldProps {
  label: string;
  provenanceLabel: string;
  provenanceSource?: string;
  variant?: 'prefilled' | 'derived';
  error?: string;
  multiline?: boolean;
}

type InputFieldProps = ProvenanceFieldProps & InputHTMLAttributes<HTMLInputElement>;
type TextareaFieldProps = ProvenanceFieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>;

export const ProvenanceField = forwardRef<
  HTMLInputElement | HTMLTextAreaElement,
  InputFieldProps | TextareaFieldProps
>(function ProvenanceField(props, ref) {
  const {
    label,
    provenanceLabel,
    provenanceSource,
    variant = 'prefilled',
    error,
    multiline,
    ...inputProps
  } = props;

  const generatedId = useId();
  const id = (inputProps as { id?: string }).id || generatedId;
  const provenanceId = `${id}-provenance`;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [provenanceId, errorId].filter(Boolean).join(' ') || undefined;

  const isDerived = variant === 'derived';

  return (
    <div className={`${inputStyles.group} ${error ? inputStyles.hasError : ''}`}>
      <label htmlFor={isDerived ? undefined : id} className={inputStyles.label}>
        {label}
      </label>

      <span id={provenanceId} className={styles.provenance}>
        {provenanceLabel}
        {provenanceSource && (
          <>
            {' — '}
            <span className={styles.source}>{provenanceSource}</span>
          </>
        )}
      </span>

      {isDerived ? (
        <div className={styles.derivedValue}>
          {(inputProps as InputFieldProps).defaultValue || (inputProps as InputFieldProps).value || '—'}
        </div>
      ) : multiline ? (
        <textarea
          ref={ref as React.Ref<HTMLTextAreaElement>}
          id={id}
          className={inputStyles.input}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          rows={3}
          style={{ height: 'auto', minHeight: '72px', padding: 'var(--space-2) var(--space-3)' }}
          {...(inputProps as TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          ref={ref as React.Ref<HTMLInputElement>}
          id={id}
          className={inputStyles.input}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          {...(inputProps as InputHTMLAttributes<HTMLInputElement>)}
        />
      )}

      {error && <span id={errorId} className={inputStyles.error} role="alert">{error}</span>}
    </div>
  );
});
