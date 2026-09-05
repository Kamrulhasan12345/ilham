export type RankCode = 'matruk' | 'daif' | 'layyin' | 'maqbul' | 'saduq' | 'thiqa';

// The six canonical English glosses, matching docs/design/demo.html's own
// `.glegend` legend ("The six classical grades, weakest to strongest").
export const RANK_GLOSS: Record<RankCode, string> = {
  matruk: 'abandoned',
  daif: 'weak',
  layyin: 'soft',
  maqbul: 'acceptable',
  saduq: 'truthful',
  thiqa: 'trustworthy',
};

// Mirrors corpus.rank_levels.weight exactly (verified against the live table).
// Used only for the StrengthPlot's fixed axis; a specific link's real weight
// always comes from the API response, never recomputed here.
export const RANK_WEIGHT: Record<RankCode, number> = {
  matruk: 0.1,
  daif: 0.25,
  layyin: 0.4,
  maqbul: 0.6,
  saduq: 0.8,
  thiqa: 0.95,
};

const UNGRADED_WEIGHT = 0.5;
const UNNAMED_WEIGHT = 0.15;

export interface GradeInfo {
  sentence: string;
  weight: number | null;
}

export interface GradedLink {
  is_compiler: boolean;
  is_placeholder: boolean;
  resolution: string;
  rank_ibn_hajar: string | null;
  rank_ibn_hajar_weight: number | null;
}

/**
 * The three grade states as sentences, per docs/design/DESIGN.md §4. Ibn Hajar's
 * grade drives the sentence and the weight — the caller renders al-Dhahabi's
 * verdict as a separate, secondary line (see IsnadChain).
 */
export function gradeInfo(link: GradedLink): GradeInfo {
  if (link.is_compiler) {
    return { sentence: 'the collector — not scored', weight: null };
  }
  if (link.is_placeholder || link.resolution === 'X' || link.resolution === 'C') {
    return { sentence: 'the source records no name here', weight: UNNAMED_WEIGHT };
  }
  if (link.rank_ibn_hajar) {
    const gloss = RANK_GLOSS[link.rank_ibn_hajar as RankCode];
    return {
      sentence: gloss,
      weight: link.rank_ibn_hajar_weight ?? RANK_WEIGHT[link.rank_ibn_hajar as RankCode],
    };
  }
  return {
    sentence: 'identified, but no scholar graded him — neutral, not a fault',
    weight: UNGRADED_WEIGHT,
  };
}

export interface FlatIsnadLink {
  sanad_no: number;
  position: number;
  [key: string]: unknown;
}

export interface Chain<T> {
  sanadNo: number;
  links: T[];
}

/**
 * Groups a flat, position-ordered isnad array into one entry per sanad, with
 * each sanad's links reversed so the collector (highest position) prints first
 * and the Companion (position 1) prints last. docs/frontend-prd.md §7.7.
 */
export function groupIsnadChains<T extends FlatIsnadLink>(links: T[]): Chain<T>[] {
  const bySanad = new Map<number, T[]>();
  for (const link of links) {
    const group = bySanad.get(link.sanad_no);
    if (group) group.push(link);
    else bySanad.set(link.sanad_no, [link]);
  }
  return [...bySanad.entries()]
    .sort(([a], [b]) => a - b)
    .map(([sanadNo, group]) => ({
      sanadNo,
      links: [...group].sort((a, b) => b.position - a.position),
    }));
}
