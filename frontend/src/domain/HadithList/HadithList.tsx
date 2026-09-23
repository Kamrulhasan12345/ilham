import { Link } from '@tanstack/react-router';
import styles from './HadithList.module.css';

export interface HadithListItem {
  hadith_id: number;
  hadith_num: string;
  text_plain: string;
  chain_strength: number | null;
}

/** One row per hadith: the number in mono, a one-line Arabic snippet,
    and the chain strength as a short bar and a figure. A hadith with no
    chain shows “no chain” and no bar. */
export function HadithList({ items }: { items: HadithListItem[] }) {
  return (
    <ul className={styles.list}>
      {items.map((hadith) => (
        <li key={hadith.hadith_id} className={styles.row}>
          <span className={`m ${styles.num}`}>{hadith.hadith_num}</span>
          <Link
            to="/hadiths/$hadithId"
            params={{ hadithId: String(hadith.hadith_id) }}
            className={styles.snippet}
          >
            <span className="ar" dir="rtl">
              {hadith.text_plain.length > 120
                ? `${hadith.text_plain.slice(0, 120)}…`
                : hadith.text_plain}
            </span>
          </Link>
          <span className={styles.score}>
            {hadith.chain_strength === null ? (
              'no chain'
            ) : (
              <>
                <span className={styles.bar} aria-hidden="true">
                  <span
                    className={styles.fill}
                    style={{ inlineSize: `${Math.round(hadith.chain_strength * 100)}%` }}
                  />
                </span>{' '}
                <span className="m m--bare">{`[${hadith.chain_strength.toFixed(2)}]`}</span>
              </>
            )}
          </span>
        </li>
      ))}
    </ul>
  );
}
