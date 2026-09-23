import { type ReactNode, useId } from 'react';
import styles from './Field.module.css';

export interface FieldProps {
  label: string;
  children: (ids: { controlId: string; describedBy: string | undefined }) => ReactNode;
  hint?: string;
  error?: string | null;
  className?: string;
}

/** A labelled control with its hint and its error. The error sits under
    the field, tied with aria-describedby, and leads with the word Error.
    Every field has a visible label; a placeholder is never one. */
export function Field({ label, children, hint, error, className }: FieldProps) {
  const controlId = useId();
  const hintId = useId();
  const errorId = useId();
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label className={styles.label} htmlFor={controlId}>
        {label}
      </label>
      {children({ controlId, describedBy: describedBy || undefined })}
      {hint ? (
        <p className={styles.hint} id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className={styles.error} id={errorId} role="alert">
          <b>Error</b> {error}
        </p>
      ) : null}
    </div>
  );
}
