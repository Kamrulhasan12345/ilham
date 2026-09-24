import { Badge } from '@/components/ui/badge';
import { RANK_GLOSS, RANK_WEIGHT, UNGRADED_WEIGHT, UNNAMED_WEIGHT } from '../grading';

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
    <div className="flex flex-col gap-3">
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>The six classical grades, weakest to strongest</span>
        <span>
          <span dir="rtl" lang="ar" className="font-arabic">
            متروك
          </span>{' '}
          {RANK_GLOSS.matruk}
        </span>
        <span>
          <span dir="rtl" lang="ar" className="font-arabic">
            ضعيف
          </span>{' '}
          {RANK_GLOSS.daif}
        </span>
        <span>
          <span dir="rtl" lang="ar" className="font-arabic">
            لين
          </span>{' '}
          {RANK_GLOSS.layyin}
        </span>
        <span>
          <span dir="rtl" lang="ar" className="font-arabic">
            مقبول
          </span>{' '}
          {RANK_GLOSS.maqbul}
        </span>
        <span>
          <span dir="rtl" lang="ar" className="font-arabic">
            صدوق
          </span>{' '}
          {RANK_GLOSS.saduq}
        </span>
        <span>
          <span dir="rtl" lang="ar" className="font-arabic">
            ثقة
          </span>{' '}
          {RANK_GLOSS.thiqa}
        </span>
      </p>

      <div className="flex flex-col gap-1">
        {ROWS.map((row) => {
          const count = weights.filter((w) => w === row.weight).length;
          const isMinRow = uniqueMinimum && row.weight === minWeight;
          return (
            <div key={row.weight} className="flex items-center gap-3">
              <span
                className="w-12 shrink-0 font-mono text-sm tabular-nums text-muted-foreground"
                data-testid="plot-row-weight"
              >
                {row.weight.toFixed(2)}
              </span>
              {row.ar ? (
                <span dir="rtl" lang="ar" className="w-24 shrink-0 text-right font-arabic">
                  {row.ar}
                </span>
              ) : (
                <span className="w-24 shrink-0 text-sm text-muted-foreground">{row.en}</span>
              )}
              <div className="flex flex-1 items-center gap-1">
                {Array.from({ length: count }, (_, i) => (
                  <span
                    key={`${row.weight}-${i}`}
                    className={`size-2.5 shrink-0 rounded-full ${isMinRow ? 'bg-primary ring-2 ring-primary/30' : 'bg-muted-foreground/60'}`}
                    data-testid="plot-dot"
                  />
                ))}
              </div>
              {isMinRow ? <Badge variant="secondary">sets the score</Badge> : null}
            </div>
          );
        })}
      </div>

      {uniqueMinimum ? (
        <p className="text-sm text-muted-foreground">
          The lowest weight, {minWeight!.toFixed(2)}, sets the score.
        </p>
      ) : minCount > 1 ? (
        <p className="text-sm text-muted-foreground">
          {minCount} links tie at the lowest weight, {minWeight!.toFixed(2)} — nothing is marked.
        </p>
      ) : null}
      {/* docs/design/specimen.html's plot__foot: the arithmetic is printed
          because requirement 9 asks each member to defend each routine. */}
      {minWeight !== null && anana !== null && strength !== null ? (
        <p className="font-mono text-sm tabular-nums text-muted-foreground">
          [lowest weight {minWeight.toFixed(2)}]<span aria-hidden="true"> − </span>
          [anʿana {anana.toFixed(2)}]<span aria-hidden="true"> = </span>[{strength.toFixed(2)}]
        </p>
      ) : null}
    </div>
  );
}
