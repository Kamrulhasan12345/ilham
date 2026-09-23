import type { ReactNode, ThHTMLAttributes } from 'react';
import styles from './Table.module.css';

export interface TableProps {
  caption: string;
  children: ReactNode;
  className?: string;
}

/** Every chart carries a table below it; the table is the source of
    truth. Wide tables scroll inside their own box — never the page. */
export function Table({ caption, children, className }: TableProps) {
  return (
    <div className={styles.wrap}>
      <table className={[styles.table, className].filter(Boolean).join(' ')}>
        <caption className={styles.caption}>{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function SortHeader({
  children,
  sorted,
  onSort,
}: {
  children: ReactNode;
  sorted: 'ascending' | 'descending' | null;
  onSort: () => void;
}) {
  return (
    <th aria-sort={sorted ?? undefined}>
      <button type="button" className={styles.sort} onClick={onSort}>
        {children} {sorted === 'ascending' ? '↑' : sorted === 'descending' ? '↓' : ''}
      </button>
    </th>
  );
}

export type { ThHTMLAttributes };
