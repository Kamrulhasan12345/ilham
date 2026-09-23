import styles from './ChainPair.module.css';

export interface PairChain {
  hadithId: number;
  hadithNum: string;
  names: string[];
}

/** Two chains side by side. Neither is reordered to make them line up —
    the transmission order is the data. A shared narrator carries the
    word, not colour alone. */
export function ChainPair({
  left,
  right,
  shared,
}: {
  left: PairChain;
  right: PairChain;
  shared: Set<string>;
}) {
  return (
    <div className={styles.pair}>
      {[left, right].map((chain) => (
        <div key={chain.hadithId}>
          <p className={styles.head}>
            Hadith <span className="m">{chain.hadithNum}</span>
          </p>
          <ol className={styles.list}>
            {chain.names.map((name) => (
              <li
                key={`${chain.hadithId}-${name}`}
                className={shared.has(name) ? styles.shared : undefined}
              >
                <span className="ar" dir="rtl">
                  {name}
                </span>{' '}
                {shared.has(name) ? <span className={styles.word}>shared</span> : null}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
