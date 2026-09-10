import { type Chain, type FlatIsnadLink, gradeInfo, groupIsnadChains } from '../grading';
import styles from './IsnadChain.module.css';

export interface IsnadLinkData extends FlatIsnadLink {
  narrator_id: number | null;
  raw_name: string;
  display_name: string | null;
  name_en: string | null;
  transmission_word: string | null;
  is_compiler: boolean;
  resolution: string;
  is_placeholder: boolean;
  rank_ibn_hajar: string | null;
  rank_ibn_hajar_weight: number | null;
  rank_dhahabi: string | null;
  rank_dhahabi_weight: number | null;
}

export interface IsnadChainProps {
  links: IsnadLinkData[];
  strongestSanadNo?: number;
}

// docs/design/DESIGN.md §4's "never a bare number" rule: every machine value
// is bracketed. The brackets are literal characters here — not CSS generated
// content (`.m::before`/`::after` in reset.css) — so the distinction survives
// a screen reader and a plain-text copy, and `.m .m--bare` here only borrows
// the mono styling without doubling the bracket.
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
  if (link.is_compiler) return `${styles.mark} ${styles.markCollector}`;
  if (link.is_placeholder) return `${styles.mark} ${styles.markPlaceholder}`;
  if (link.resolution === 'A' || link.resolution === 'B')
    return `${styles.mark} ${styles.markPerson}`;
  if (link.resolution === 'C') return `${styles.mark} ${styles.markAmbiguous}`;
  return `${styles.mark} ${styles.markUnresolved}`;
}

function LinkRow({ link, setsScore }: { link: IsnadLinkData; setsScore: boolean }) {
  const { sentence, weight } = gradeInfo(link);
  const secondSentence =
    !link.is_compiler && link.rank_dhahabi_weight != null
      ? `al-Dhahabī's grade also stands at [${link.rank_dhahabi_weight.toFixed(2)}]`
      : null;
  const gloss = link.transmission_word ? TRANSMISSION_GLOSS[link.transmission_word] : null;

  return (
    <li className={styles.link}>
      <div className={styles.markCell}>
        <span className={markClassName(link)} aria-hidden="true" />
      </div>
      <div className={styles.body}>
        <p className={`${styles.name} ar`} dir="rtl">
          {link.is_compiler ? (
            link.raw_name
          ) : setsScore ? (
            <span className={styles.nameSetsScore}>{link.display_name ?? link.raw_name}</span>
          ) : (
            (link.display_name ?? link.raw_name)
          )}
        </p>
        {link.name_en ? <p className={styles.translit}>{link.name_en}</p> : null}
        <p className={weight === null ? `${styles.grade} ${styles.gradeAbsent}` : styles.grade}>
          {sentence}
          {weight !== null ? <span className="m m--bare">{`[${weight.toFixed(2)}]`}</span> : null}
          {secondSentence ? (
            <>
              <span className={styles.sep} aria-hidden="true">
                {' '}
                /{' '}
              </span>
              <i>{secondSentence}</i>
            </>
          ) : null}
        </p>
        <span className={styles.vals}>
          {link.is_compiler ? (
            <span className="m m--bare">[compiler]</span>
          ) : (
            <>
              {weight !== null ? (
                <span className="m m--bare">{`[wt ${weight.toFixed(2)}]`}</span>
              ) : null}
              {link.transmission_word ? (
                <span className="m m--bare">{`[${link.transmission_word}]`}</span>
              ) : null}
              {gloss ? <span className={styles.gloss}>{`"${gloss}"`}</span> : null}
            </>
          )}
          {setsScore ? <span className={styles.setsScore}>sets the score</span> : null}
        </span>
      </div>
    </li>
  );
}

export function IsnadChain({ links, strongestSanadNo }: IsnadChainProps) {
  if (links.length === 0) {
    return <p className={styles.empty}>This hadith carries no chain.</p>;
  }

  const chains = groupIsnadChains(links);
  const showSanadLabels = chains.length > 1;

  return (
    <>
      {chains.map((chain) => (
        <div key={chain.sanadNo}>
          {showSanadLabels ? <p className={styles.sanadLabel}>Sanad {chain.sanadNo}</p> : null}
          <ol className={styles.chain}>
            {chain.links.map((link) => (
              <LinkRow
                key={`${chain.sanadNo}-${link.position}`}
                link={link}
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
