import type { ReactNode } from 'react';
import styles from './State.module.css';

/** Every loading, error, and empty state in the product. A top rule —
    ink for a stop, quiet for a wait — then a title and plain words. */
export function State({
  title,
  children,
  quiet,
}: {
  title: string;
  children: ReactNode;
  quiet?: boolean;
}) {
  return (
    <div className={quiet ? `${styles.state} ${styles.quiet}` : styles.state}>
      <h3>{title}</h3>
      <div className={styles.body}>{children}</div>
    </div>
  );
}
