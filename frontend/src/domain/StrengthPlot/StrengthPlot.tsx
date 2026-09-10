import { RANK_GLOSS, RANK_WEIGHT, UNGRADED_WEIGHT, UNNAMED_WEIGHT } from '../grading';
import styles from './StrengthPlot.module.css';

export interface StrengthPlotProps {
  /** The real weight of every scored (non-compiler) link in the chain. */
  weights: number[];
}

const ROWS: { weight: number; ar: string | null; en: string | null }[] = [
  { weight: RANK_WEIGHT.thiqa, ar: 'ثقة', en: null },
  { weight: RANK_WEIGHT.saduq, ar: 'صدوق', en: null },
  { weight: RANK_WEIGHT.maqbul, ar: 'مقبول', en: null },
  { weight: UNGRADED_WEIGHT, ar: null, en: 'known, but never graded' },
  { weight: RANK_WEIGHT.layyin, ar: 'لين', en: null },
  { weight: RANK_WEIGHT.daif, ar: 'ضعيف', en: null },
  { weight: UNNAMED_WEIGHT, ar: null, en: 'we could not identify them' },
  { weight: RANK_WEIGHT.matruk, ar: 'متروك', en: null },
];

export function StrengthPlot({ weights }: StrengthPlotProps) {
  const minWeight = weights.length > 0 ? Math.min(...weights) : null;
  const minCount = minWeight === null ? 0 : weights.filter((w) => w === minWeight).length;
  const uniqueMinimum = minCount === 1;

  return (
    <div>
      <p className={styles.legend}>
        <span>The six classical grades, weakest to strongest</span>
        <span>
          <b dir="rtl">متروك</b> {RANK_GLOSS.matruk}
        </span>
        <span>
          <b dir="rtl">ضعيف</b> {RANK_GLOSS.daif}
        </span>
        <span>
          <b dir="rtl">لين</b> {RANK_GLOSS.layyin}
        </span>
        <span>
          <b dir="rtl">مقبول</b> {RANK_GLOSS.maqbul}
        </span>
        <span>
          <b dir="rtl">صدوق</b> {RANK_GLOSS.saduq}
        </span>
        <span>
          <b dir="rtl">ثقة</b> {RANK_GLOSS.thiqa}
        </span>
      </p>

      <div className={styles.plot}>
        {ROWS.map((row) => {
          const count = weights.filter((w) => w === row.weight).length;
          const isMinRow = uniqueMinimum && row.weight === minWeight;
          return (
            <div
              key={row.weight}
              className={isMinRow ? `${styles.row} ${styles.rowSets}` : styles.row}
            >
              <span className={styles.weight} data-testid="plot-row-weight">
                {row.weight.toFixed(2)}
              </span>
              {row.ar ? (
                <span className={styles.rowLabelAr} dir="rtl">
                  {row.ar}
                </span>
              ) : (
                <span className={styles.rowLabelEn}>{row.en}</span>
              )}
              <div className={styles.cells}>
                {Array.from({ length: count }, (_, i) => (
                  <span key={`${row.weight}-${i}`} className={styles.dot} data-testid="plot-dot" />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {uniqueMinimum ? (
        <p className={styles.tieNote}>
          The lowest weight, {minWeight!.toFixed(2)}, sets the score.
        </p>
      ) : minCount > 1 ? (
        <p className={styles.tieNote}>
          {minCount} links tie at the lowest weight, {minWeight!.toFixed(2)} — nothing is marked.
        </p>
      ) : null}
    </div>
  );
}
