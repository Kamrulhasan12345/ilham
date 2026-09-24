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
    <div className="flex flex-col gap-2">
      <p className="flex gap-4 text-sm text-muted-foreground">
        <span>
          <span
            className="mr-1 inline-block size-2.5 rounded-full bg-foreground"
            aria-hidden="true"
          />{' '}
          Ibn Hajar
        </span>
        <span>
          <span className="mr-1 inline-block size-2.5 rotate-45 bg-foreground" aria-hidden="true" />{' '}
          Al-Dhahabi
        </span>
      </p>
      <div role="img" aria-label={label} className="flex flex-col gap-1.5">
        {rows.map((row) => {
          const left = Math.min(position(row.ordinalA), position(row.ordinalB));
          const width = Math.abs(position(row.ordinalA) - position(row.ordinalB));
          return (
            <div key={row.key} className="flex items-center gap-3">
              <span dir="rtl" lang="ar" className="w-48 shrink-0 truncate text-right font-arabic">
                {row.name}
              </span>
              <span className="relative flex h-5 flex-1 items-center" aria-hidden="true">
                <span className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border" />
                <span
                  className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-muted-foreground"
                  style={{ insetInlineStart: `${left}%`, width: `${width}%` }}
                />
                <span
                  className="absolute size-2.5 -translate-x-1/2 rounded-full bg-foreground"
                  style={{ insetInlineStart: `${position(row.ordinalA)}%` }}
                />
                <span
                  className="absolute size-2.5 -translate-x-1/2 rotate-45 bg-foreground"
                  style={{ insetInlineStart: `${position(row.ordinalB)}%` }}
                />
              </span>
              <span className="w-12 shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
                [{row.gap}]
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex text-sm text-muted-foreground" aria-hidden="true">
        <span className="w-48 shrink-0" />
        <span className="flex flex-1 justify-between font-arabic">
          {GRADES.map((grade) => (
            <span key={grade.ordinal} title={grade.en}>
              {grade.ar}
            </span>
          ))}
        </span>
        <span className="w-12 shrink-0" />
      </div>
      <p className="text-sm text-muted-foreground">
        {GRADES.map((grade) => `${grade.ar} ${grade.en}`).join(' · ')}. The axis never stands in
        Arabic alone.
      </p>
    </div>
  );
}
