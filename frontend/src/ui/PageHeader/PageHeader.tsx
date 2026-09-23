import type { ReactNode } from 'react';
import styles from './PageHeader.module.css';

export interface PageHeaderProps {
  title: string;
  trailing?: ReactNode;
}

/** Every page's <h1>, with an optional trailing count or action so a page
    stops inventing its own header row. */
export function PageHeader({ title, trailing }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      {trailing ? <div className={styles.trailing}>{trailing}</div> : null}
    </div>
  );
}
