import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Chip.module.css';

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  pressed: boolean;
}

/** A filter: fully round, because round means clickable. Never carries
    status — pressed is an ink border, not a colour. */
export function Chip({ children, pressed, className, type = 'button', ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={pressed}
      className={[styles.chip, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}
