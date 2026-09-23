import type { ReactNode } from 'react';
import styles from './Rail.module.css';

/** The signature element: a 210px rail at the same x on every screen,
    holding whatever English the current object needs. It never changes
    width and never wraps around the Arabic. Below 62rem it becomes a
    strip above the content, keeping its content and its order. */
export function Rail({ side, children }: { side: ReactNode; children: ReactNode }) {
  return (
    <div className={styles.doc}>
      <aside className={`${styles.rail} ${styles.tint}`}>{side}</aside>
      <div>{children}</div>
    </div>
  );
}

export interface RailRowProps {
  label: string;
  children: ReactNode;
  /** Arabic values take the Arabic grade size, right aligned. */
  arabic?: boolean;
}

/** One metadata row: a label and a value. A field with no value says so
    in words through `absent` — no colour reports absence, and an empty
    label is never printed. */
export function RailRow({ label, children, arabic }: RailRowProps) {
  return (
    <div className={styles.row}>
      <span className={styles.key}>{label}</span>
      <span className={arabic ? `${styles.value} ${styles.valueAr}` : styles.value}>
        {children}
      </span>
    </div>
  );
}

/** The absent value: words, never a blank and never a colour. */
export function Absent({ children }: { children: ReactNode }) {
  return <span className={styles.absent}>{children}</span>;
}
