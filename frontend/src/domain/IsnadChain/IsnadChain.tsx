import { Badge } from '@/components/ui/badge';
import { Link } from '@tanstack/react-router';
import { type Chain, type FlatIsnadLink, gradeInfo, groupIsnadChains } from '../grading';

export interface IsnadLinkData extends FlatIsnadLink {
  narrator_id: number | null;
  raw_name: string;
  display_name: string | null;
  name_en: string | null;
  kunya?: string | null;
  lineage?: string | null;
  school?: string | null;
  tabaqa_raw?: string | null;
  generation: number | null;
  transmission_word: string | null;
  is_compiler: boolean;
  resolution: string;
  is_placeholder: boolean;
  rank_ibn_hajar_raw?: string | null;
  rank_ibn_hajar: string | null;
  rank_ibn_hajar_via?: string | null;
  rank_ibn_hajar_weight: number | null;
  rank_dhahabi_raw?: string | null;
  rank_dhahabi: string | null;
  rank_dhahabi_via?: string | null;
  rank_dhahabi_weight: number | null;
  weight?: number | null;
}

export interface IsnadChainProps {
  links: IsnadLinkData[];
  strongestSanadNo?: number;
  /** Render each resolved name as a link through this function. */
  linkHref?: (narratorId: number) => string;
}

// docs/design/DESIGN.md §4's "never a bare number" rule: every machine value
// is bracketed. The brackets are literal characters here — not CSS generated
// content — so the distinction survives a screen reader and a plain-text copy.
const TRANSMISSION_GLOSS: Record<string, string> = {
  حدثنا: 'he narrated to us',
  حدثني: 'he narrated to me',
  أخبرنا: 'he informed us',
  أخبرني: 'he informed us',
  سمعت: 'I heard',
  سمع: 'he heard',
  قال: 'he said',
  'أنه سمع': 'he heard',
};

/**
 * The one link that sets the chain's overall score: the weakest weight among
 * its non-compiler links (the collector is never scored). On a tie,
 * docs/design/DESIGN.md §4 "The strength plot" says to mark nothing.
 */
function weakestLinkPosition(chain: Chain<IsnadLinkData>): number | null {
  const candidates = chain.links
    .filter((link) => !link.is_compiler)
    .map((link) => ({ position: link.position, weight: gradeInfo(link).weight }))
    .filter((c): c is { position: number; weight: number } => c.weight !== null);
  if (candidates.length === 0) return null;
  const min = Math.min(...candidates.map((c) => c.weight));
  const atMin = candidates.filter((c) => c.weight === min);
  return atMin.length === 1 ? atMin[0].position : null;
}

function markClassName(link: IsnadLinkData): string {
  if (link.is_compiler) return 'border-primary bg-primary';
  if (link.is_placeholder) return 'border-dashed border-muted-foreground bg-transparent';
  if (link.resolution === 'A' || link.resolution === 'B') return 'border-primary bg-background';
  if (link.resolution === 'C') return 'border-muted-foreground bg-muted';
  return 'border-destructive bg-transparent';
}

function LinkRow({
  link,
  setsScore,
  linkHref,
}: {
  link: IsnadLinkData;
  setsScore: boolean;
  linkHref?: (narratorId: number) => string;
}) {
  const { sentence, weight } = gradeInfo(link);
  const secondSentence =
    !link.is_compiler && link.rank_dhahabi_weight != null
      ? `al-Dhahabī's grade also stands at [${link.rank_dhahabi_weight.toFixed(2)}]`
      : null;
  const gloss = link.transmission_word ? TRANSMISSION_GLOSS[link.transmission_word] : null;
  // A resolved name links to its narrator. A raw string that did not
  // resolve is not a link — it stays on screen, quieter, per the specimen.
  const resolved = !link.is_compiler && !link.is_placeholder && link.narrator_id !== null;
  const nameText = link.display_name ?? link.raw_name;

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      <div className="flex flex-col items-center">
        <span
          className={`mt-1.5 size-3 shrink-0 rounded-full border-2 ${markClassName(link)}`}
          aria-hidden="true"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p dir="rtl" lang="ar" className="text-right font-arabic text-xl leading-snug">
          {link.is_compiler ? (
            link.raw_name
          ) : (
            <span
              className={
                setsScore ? 'font-semibold' : resolved ? undefined : 'text-muted-foreground'
              }
            >
              {resolved && linkHref ? (
                <Link to={linkHref(link.narrator_id as number)} className="hover:underline">
                  {nameText}
                </Link>
              ) : (
                nameText
              )}
            </span>
          )}
        </p>
        {link.name_en ? <p className="text-sm text-muted-foreground">{link.name_en}</p> : null}
        <p className="text-sm text-muted-foreground">
          {sentence}
          {weight !== null ? (
            <span className="font-mono tabular-nums">{`[${weight.toFixed(2)}]`}</span>
          ) : null}
          {secondSentence ? (
            <>
              <span aria-hidden="true"> / </span>
              <i>{secondSentence}</i>
            </>
          ) : null}
        </p>
        <span className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {link.is_compiler ? (
            <span className="font-mono">[compiler]</span>
          ) : (
            <>
              {weight !== null ? (
                <span className="font-mono tabular-nums">{`[wt ${weight.toFixed(2)}]`}</span>
              ) : null}
              {link.transmission_word ? (
                <span className="font-mono">{`[${link.transmission_word}]`}</span>
              ) : null}
              {gloss ? <span>{`"${gloss}"`}</span> : null}
            </>
          )}
          {setsScore ? <Badge variant="secondary">sets the score</Badge> : null}
        </span>
      </div>
    </li>
  );
}

export function IsnadChain({ links, strongestSanadNo, linkHref }: IsnadChainProps) {
  if (links.length === 0) {
    return <p className="text-muted-foreground">This hadith carries no chain.</p>;
  }

  const chains = groupIsnadChains(links);
  const showSanadLabels = chains.length > 1;

  return (
    <>
      {chains.map((chain) => (
        <div key={chain.sanadNo} className="flex flex-col gap-2">
          {showSanadLabels ? <p className="text-sm font-semibold">Sanad {chain.sanadNo}</p> : null}
          <ol>
            {chain.links.map((link) => (
              <LinkRow
                key={`${chain.sanadNo}-${link.position}`}
                link={link}
                linkHref={linkHref}
                setsScore={
                  chain.sanadNo === strongestSanadNo && weakestLinkPosition(chain) === link.position
                }
              />
            ))}
          </ol>
        </div>
      ))}
    </>
  );
}
