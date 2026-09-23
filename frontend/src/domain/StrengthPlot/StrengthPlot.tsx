import { RANK_GLOSS, RANK_WEIGHT, UNGRADED_WEIGHT, UNNAMED_WEIGHT } from '../grading';
import styles from './StrengthPlot.module.css';

export interface StrengthPlotProps {
  /** The adjusted weight of every scored (non-compiler) link in the chain. */
  weights: number[];
  /** The unadjusted rank weight of the same links, in the same order. */
  baseWeights: number[];
  /** The served score of this chain. */
  strength: number | null;
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

export function StrengthPlot({ weights, baseWeights, strength }: StrengthPlotProps) {
  const minWeight = weights.length > 0 ? Math.min(...weights) : null;
  const minCount = minWeight === null ? 0 : weights.filter((w) => w === minWeight).length;
  const uniqueMinimum = minCount === 1;
  const minBase = baseWeights.length > 0 ? Math.min(...baseWeights) : null;
  // The anʿana figure is the gap between the unadjusted minimum and the
  // adjusted one, so 0.00 on a chain with no عن link. Both minima come from
  // served numbers, never recomputed ranks.
  const anana = minWeight !== null && minBase !== null ? minBase - minWeight : null;

  return (
    <div>
      <p className={styles.legend}>
        <span>The six classical grades, weakest to strongest</span>
        <span>
          <span className={styles.legendAr} dir="rtl">
            متروك
          </span>{' '}
          {RANK_GLOSS.matruk}
        </span>
        <span>
          <span className={styles.legendAr} dir="rtl">
            ضعيف
          </span>{' '}
          {RANK_GLOSS.daif}
        </span>
        <span>
          <span className={styles.legendAr} dir="rtl">
            لين
          </span>{' '}
          {RANK_GLOSS.layyin}
        </span>
        <span>
          <span className={styles.legendAr} dir="rtl">
            مقبول
          </span>{' '}
          {RANK_GLOSS.maqbul}
        </span>
        <span>
          <span className={styles.legendAr} dir="rtl">
            صدوق
          </span>{' '}
          {RANK_GLOSS.saduq}
        </span>
        <span>
          <span className={styles.legendAr} dir="rtl">
            ثقة
          </span>{' '}
          {RANK_GLOSS.thiqa}
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
      {/* docs/design/specimen.html's plot__foot: the arithmetic is printed
          because requirement 9 asks each member to defend each routine. */}
      {minWeight !== null && anana !== null && strength !== null ? (
        <p className={styles.foot}>
          <span className="m m--bare">[{`lowest weight ${minWeight.toFixed(2)}`}]</span>
          <span aria-hidden="true"> − </span>
          <span className="m m--bare">[{`anʿana ${anana.toFixed(2)}`}]</span>
          <span aria-hidden="true"> = </span>
          <span className="m m--bare">[{strength.toFixed(2)}]</span>
        </p>
      ) : null}
    </div>
  );
}
