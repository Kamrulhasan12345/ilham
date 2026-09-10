import { Button } from '../Button';
import styles from './Pager.module.css';

export interface PagerProps {
  offset: number;
  limit: number;
  count: number;
  onPrev: () => void;
  onNext: () => void;
}

export function Pager({ offset, limit, count, onPrev, onNext }: PagerProps) {
  const from = offset + 1;
  const to = offset + count;
  const isFirstPage = offset === 0;
  const isLastPage = count < limit;

  return (
    <div className={styles.pager}>
      <Button size="small" onClick={onPrev} disabled={isFirstPage} aria-label="Previous page">
        Previous
      </Button>
      <Button size="small" onClick={onNext} disabled={isLastPage} aria-label="Next page">
        Next
      </Button>
      <span className={styles.range}>
        Showing {from}–{to}
      </span>
      <span className={styles.note}>The total is not counted.</span>
    </div>
  );
}
