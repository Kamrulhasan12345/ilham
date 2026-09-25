import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface StrengthBucket {
  bucket: number;
  count: number;
}

/** Where this hadith sits in the corpus: 14 buckets over every scored
    hadith. The table below is the source of truth; the strip is the summary. */
export function DistributionStrip({
  buckets,
  strength,
}: {
  buckets: StrengthBucket[];
  strength: number | null;
}) {
  const max = Math.max(...buckets.map((b) => b.count), 1);
  const here = strength === null ? -1 : Math.min(14, Math.floor(strength * 14) + 1);

  const nonEmpty = buckets.filter((b) => b.count > 0);

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Every scored hadith in the corpus, in 14 buckets.
        {strength !== null ? (
          <>
            {' '}
            This hadith sits in bucket {Math.min(14, Math.floor(strength * 14) + 1)}, marked in the
            accent.
          </>
        ) : null}
      </p>
      <div
        className="flex h-24 items-end gap-0.5 border-b pb-px"
        role="img"
        aria-label="Distribution of chain strengths across the corpus"
      >
        {buckets.map((b) => (
          <div
            key={b.bucket}
            className={cn(
              'min-h-0.5 flex-1 rounded-t-xs',
              b.bucket === here
                ? 'bg-primary'
                : b.count === 0
                  ? 'bg-border'
                  : 'bg-muted-foreground/60',
            )}
            style={{ blockSize: `${(b.count / max) * 100}%` }}
          />
        ))}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bucket</TableHead>
            <TableHead>Strength range</TableHead>
            <TableHead>Hadiths</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {buckets.map((b) => (
            <TableRow key={b.bucket}>
              <TableCell className="font-mono tabular-nums">{b.bucket}</TableCell>
              <TableCell className="font-mono tabular-nums">{`[${((b.bucket - 1) / 14).toFixed(2)}–${(b.bucket / 14).toFixed(2)}]`}</TableCell>
              <TableCell className="font-mono tabular-nums">{b.count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-sm text-muted-foreground">
        {nonEmpty.length} of the 14 buckets hold at least one hadith.
      </p>
    </div>
  );
}
