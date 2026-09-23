import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import styles from './Input.module.css';

type Shared = {
  invalid?: boolean;
  multiline?: boolean;
  className?: string;
};

export type InputProps = Shared &
  (
    | (InputHTMLAttributes<HTMLInputElement> & { multiline?: false })
    | (TextareaHTMLAttributes<HTMLTextAreaElement> & { multiline: true })
  );

/** Square, 44px, an edge border. Invalid doubles the border; the Field
    says the word "Error" beside it. Never red: one accent, and it means
    position. */
export function Input(props: InputProps) {
  const { invalid, multiline, className, ...rest } = props;
  const classes = [styles.input, className].filter(Boolean).join(' ');
  if (multiline) {
    const areaProps = rest as TextareaHTMLAttributes<HTMLTextAreaElement>;
    return <textarea aria-invalid={invalid || undefined} className={classes} {...areaProps} />;
  }
  const inputProps = rest as InputHTMLAttributes<HTMLInputElement>;
  return <input aria-invalid={invalid || undefined} className={classes} {...inputProps} />;
}
