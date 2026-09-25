import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface HeatDay {
  date: string;
  count: number;
}

function localKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Fold timestamps into per-day counts, oldest first, keyed by the viewer's
    local date. The window opens on the Sunday `weeks - 1` weeks back and ends
    today, so every column of the grid is one Sun→Sat week. Quiet days are
    present with count 0. */
export function bucketSessionsByDay(createdAts: string[], weeks = 16): HeatDay[] {
  const counts = new Map<string, number>();
  for (const at of createdAts) {
    const day = localKey(new Date(at));
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - today.getDay() - (weeks - 1) * 7);
  const days: HeatDay[] = [];
  for (const d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const key = localKey(d);
    days.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return days;
}

// Spelled out in full: Tailwind scans source text, so `bg-heat-${n}` would
// generate nothing.
const SHADES = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LABELLED = new Set(['Mon', 'Wed', 'Fri']);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthOf = (key: string) => MONTHS[Number(key.slice(5, 7)) - 1];

function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDay(key: string): string {
  return parseKey(key).toLocaleDateString('en', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** Contribution grid in the GitHub manner: one column per week, weekday rows,
    month captions where the month turns, a Less-to-More key. Colours come from
    --color-heat-*, mixed off --primary, so a preset swap repaints it. */
export function Heatmap({ days, label }: { days: HeatDay[]; label: string }) {
  const total = days.reduce((n, d) => n + d.count, 0);
  // The rest of the current week renders as blank cells so every column is Sun→Sat.
  const cells = days.map((day) => ({ ...day, future: false }));
  const next = parseKey(days.at(-1)?.date ?? localKey(new Date()));
  while (cells.length % 7 !== 0) {
    next.setDate(next.getDate() + 1);
    cells.push({ date: localKey(next), count: 0, future: true });
  }
  const weekCount = cells.length / 7;

  const captions = Array.from({ length: weekCount }, (_, w) => ({
    week: cells[w * 7].date,
    text: '',
  }));
  let lastShown = -3;
  for (let w = 0; w < weekCount; w++) {
    const month = monthOf(cells[w * 7].date);
    if (w > 0 && monthOf(cells[(w - 1) * 7].date) === month) continue;
    // Two captions closer than three columns overlap; the later one wins.
    if (w - lastShown < 3) captions[lastShown].text = '';
    captions[w].text = month;
    lastShown = w;
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-2">
        <ScrollArea className="w-full">
          <div className="flex w-max gap-1 pb-2">
            <div
              className="grid grid-rows-7 gap-1 pt-5 pe-1 text-xs text-muted-foreground"
              aria-hidden="true"
            >
              {WEEKDAYS.map((day) => (
                <span key={day} className="h-3 leading-3">
                  {LABELLED.has(day) ? day : ''}
                </span>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex h-4 gap-1" aria-hidden="true">
                {captions.map((caption) => (
                  <span
                    key={caption.week}
                    className="w-3 overflow-visible text-xs leading-4 whitespace-nowrap text-muted-foreground"
                  >
                    {caption.text}
                  </span>
                ))}
              </div>
              <div className="grid grid-flow-col grid-rows-7 gap-1" role="img" aria-label={label}>
                {cells.map((day) =>
                  day.future ? (
                    <span key={day.date} className="size-3" />
                  ) : (
                    <Tooltip key={day.date}>
                      <TooltipTrigger asChild>
                        <span className={cn('size-3 rounded-xs', SHADES[Math.min(day.count, 4)])} />
                      </TooltipTrigger>
                      <TooltipContent>
                        {day.count} sitting{day.count === 1 ? '' : 's'} on {formatDay(day.date)}
                      </TooltipContent>
                    </Tooltip>
                  ),
                )}
              </div>
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
          <span>Less</span>
          {SHADES.map((shade) => (
            <span key={shade} className={cn('size-3 rounded-xs', shade)} aria-hidden="true" />
          ))}
          <span>More</span>
        </div>
        <p className="text-sm text-muted-foreground">
          {total} sitting{total === 1 ? '' : 's'} in the last {weekCount} weeks.
        </p>
      </div>
    </TooltipProvider>
  );
}
