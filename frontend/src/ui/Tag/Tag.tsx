import type { ReactNode } from 'react';
import styles from './Tag.module.css';

export interface TagProps {
  children: ReactNode;
  accent?: boolean;
  className?: string;
}

/** A stated fact, never pressable: square, with a 2px inline-start rule.
    The waiting banner and verification states render through this. */
export function Tag({ children, accent, className }: TagProps) {
  return (
    <span
      className={[styles.tag, accent ? styles.accent : null, className].filter(Boolean).join(' ')}
    >
      {children}
    </span>
  );
}
