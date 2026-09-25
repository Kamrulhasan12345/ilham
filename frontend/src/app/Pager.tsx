import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** Offset paging for lists the API serves in fixed pages. There is no total
    count, so "Next" turns off when a page comes back short. */
export function Pager({
  offset,
  count,
  limit,
  onOffset,
}: {
  offset: number;
  count: number;
  limit: number;
  onOffset: (offset: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground tabular-nums">
        {`Showing ${offset + 1}–${offset + count}`}
      </span>
      <span className="flex-1" />
      <Button
        variant="outline"
        size="sm"
        disabled={offset === 0}
        onClick={() => onOffset(Math.max(0, offset - limit))}
      >
        <ChevronLeft data-icon="inline-start" />
        Previous
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={count < limit}
        onClick={() => onOffset(offset + limit)}
      >
        Next
        <ChevronRight data-icon="inline-end" />
      </Button>
    </div>
  );
}
