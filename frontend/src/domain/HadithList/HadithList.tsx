import { Link } from '@tanstack/react-router';
import styles from './HadithList.module.css';

export interface HadithListItem {
  hadith_id: number;
  hadith_num: string;
  text_plain: string;
  text_en: string | null;
  chain_strength: number | null;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** One row per hadith: the number in mono, the English translation first
    when one exists, the Arabic snippet second, and the chain strength as
    a short bar and a figure. A hadith with no chain shows "no chain" and
    no bar. A hadith with no translation shows Arabic only. */
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
            {hadith.text_en ? (
              <span className={styles.snippetEn}>{truncate(hadith.text_en, 120)}</span>
            ) : null}
            <span className="ar" dir="rtl">
              {truncate(hadith.text_plain, 120)}
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
