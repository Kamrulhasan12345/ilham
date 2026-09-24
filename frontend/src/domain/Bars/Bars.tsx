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
    <div className="flex flex-col gap-1.5" role="img" aria-label={label}>
      {rows.map((row) => (
        <div key={row.key} className="flex items-center gap-3">
          <span dir="rtl" lang="ar" className="w-48 shrink-0 truncate text-right font-arabic">
            {row.name}
          </span>
          <span className="flex h-5 flex-1 items-center rounded bg-muted" aria-hidden="true">
            <span
              className="h-full rounded bg-foreground"
              style={{ inlineSize: `${(row.value / max) * 100}%` }}
            />
          </span>
          <span className="w-16 shrink-0 font-mono text-sm tabular-nums text-muted-foreground">
            [{row.value}]
          </span>
        </div>
      ))}
    </div>
  );
}
