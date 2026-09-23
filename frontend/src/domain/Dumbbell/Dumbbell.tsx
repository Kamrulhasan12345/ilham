import styles from './Dumbbell.module.css';

export interface DumbbellRow {
  key: string | number;
  name: string;
  ordinalA: number;
  ordinalB: number;
  gap: number;
}

const GRADES: { ordinal: number; ar: string; en: string }[] = [
  { ordinal: 1, ar: 'متروك', en: 'abandoned' },
  { ordinal: 2, ar: 'ضعيف', en: 'weak' },
  { ordinal: 3, ar: 'لين', en: 'soft' },
  { ordinal: 4, ar: 'مقبول', en: 'acceptable' },
  { ordinal: 5, ar: 'صدوق', en: 'truthful' },
  { ordinal: 6, ar: 'ثقة', en: 'trustworthy' },
];

function position(ordinal: number): number {
  return ((ordinal - 1) / 5) * 100;
}

/** A dumbbell on the six-step ordinal axis. The gap is the ranked
    quantity, so the gap is what the chart draws. A circle marks Ibn
    Hajar and a diamond marks al-Dhahabi, so the chart never depends on
    colour. The axis carries both the Arabic words and their glosses. */
export function Dumbbell({ rows, label }: { rows: DumbbellRow[]; label: string }) {
  return (
    <div>
      <p className={styles.key}>
        <span>
          <span className={styles.dot} aria-hidden="true" /> Ibn Hajar
        </span>
        <span>
          <span className={`${styles.dot} ${styles.diamond}`} aria-hidden="true" /> Al-Dhahabi
        </span>
      </p>
      <div role="img" aria-label={label}>
        {rows.map((row) => {
          const left = Math.min(position(row.ordinalA), position(row.ordinalB));
          const width = Math.abs(position(row.ordinalA) - position(row.ordinalB));
          return (
            <div key={row.key} className={styles.row}>
              <span className={`${styles.name} ar`} dir="rtl">
                {row.name}
              </span>
              <span className={styles.track} aria-hidden="true">
                <span className={styles.axis} />
                <span
                  className={styles.link}
                  style={{ insetInlineStart: `${left}%`, width: `${width}%` }}
                />
                <span
                  className={`${styles.point} ${styles.pointA}`}
                  style={{ insetInlineStart: `${position(row.ordinalA)}%` }}
                />
                <span
                  className={`${styles.point} ${styles.pointB}`}
                  style={{ insetInlineStart: `${position(row.ordinalB)}%` }}
                />
              </span>
              <span className={`m m--bare ${styles.gap}`}>{`[${row.gap}]`}</span>
            </div>
          );
        })}
      </div>
      <div className={styles.scale} aria-hidden="true">
        <span />
        <span>
          {GRADES.map((grade) => (
            <span key={grade.ordinal} title={grade.en}>
              {grade.ar}
            </span>
          ))}
        </span>
        <span />
      </div>
      <p className={styles.gloss}>
        {GRADES.map((grade) => `${grade.ar} ${grade.en}`).join(' · ')}. The axis never stands in
        Arabic alone.
      </p>
    </div>
  );
}
