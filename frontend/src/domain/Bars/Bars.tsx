import styles from './Bars.module.css';

export interface BarRow {
  key: string | number;
  name: string;
  value: number;
}

/** Horizontal bars, sorted down. Size and shade both carry the value, so
    the chart reads in greyscale — never hue. Every chart carries a table
    below it; the caller renders that table. */
export function Bars({ rows, label }: { rows: BarRow[]; label: string }) {
  const max = rows.length > 0 ? Math.max(...rows.map((row) => row.value)) : 1;
  return (
    <div className={styles.bars} role="img" aria-label={label}>
      {rows.map((row) => (
        <div key={row.key} className={styles.bar}>
          <span className={`${styles.name} ar`} dir="rtl">
            {row.name}
          </span>
          <span className={styles.track} aria-hidden="true">
            <span className={styles.fill} style={{ inlineSize: `${(row.value / max) * 100}%` }} />
          </span>
          <span className={`m m--bare ${styles.value}`}>{`[${row.value}]`}</span>
        </div>
      ))}
    </div>
  );
}
