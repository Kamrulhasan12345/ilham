export type DueState = 'overdue' | 'due soon' | 'upcoming';

/** Bucket a YYYY-MM-DD due day against today. The API speaks ISO
    timestamps, so callers slice the day first — arithmetic on the raw
    timestamp silently lands on Invalid Date. Overdue compares calendar
    days, because ceil() rounds a same-day-negative fraction up to -0,
    which is not less than zero. */
export function dueStateFor(dueDay: string, now: Date = new Date()): DueState {
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (dueDay < todayKey) return 'overdue';
  const due = new Date(`${dueDay}T23:59:59`);
  const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86400000);
  if (daysLeft <= 7) return 'due soon';
  return 'upcoming';
}
