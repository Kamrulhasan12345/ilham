import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { IsnadChain, type IsnadLinkData } from '../../../domain/IsnadChain';
import { StrengthPlot } from '../../../domain/StrengthPlot';
import { gradeInfo } from '../../../domain/grading';
import { apiFetch } from '../../../lib/apiClient';

const isnadLinkSchema = z.object({
  sanad_no: z.number(),
  position: z.number(),
  narrator_id: z.number().nullable(),
  raw_name: z.string(),
  display_name: z.string().nullable(),
  name_en: z.string().nullable(),
  transmission_word: z.string().nullable(),
  is_compiler: z.boolean(),
  resolution: z.string(),
  is_placeholder: z.boolean(),
  rank_ibn_hajar: z.string().nullable(),
  rank_ibn_hajar_weight: z.coerce.number().nullable(),
  rank_dhahabi: z.string().nullable(),
  rank_dhahabi_weight: z.coerce.number().nullable(),
});

const hadithDetailSchema = z.object({
  hadith: z.object({
    hadith_id: z.number(),
    hadith_num: z.string(),
    text_plain: z.string(),
    text_diac: z.string(),
    sanad_count: z.number(),
  }),
  translation: z.object({ lang: z.string(), text_full: z.string(), source: z.string() }).nullable(),
  isnadChain: z.array(isnadLinkSchema),
  chainStrength: z.coerce.number().nullable(),
});

export const Route = createFileRoute('/_authed/hadiths/$hadithId')({
  component: HadithDetailPage,
});

function useHadithDetail(hadithId: string) {
  return useQuery({
    queryKey: ['hadiths', hadithId],
    queryFn: () => apiFetch(`/hadiths/${hadithId}`, hadithDetailSchema),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

// docs/frontend-prd.md §7.7 item 4: "a word first, the number second, never a
// bare number". Thresholds mirror corpus.rank_levels' own weight bands
// (thiqa 0.95, saduq 0.8) so "strong" lines up with the strongest named
// grades and "mixed" with the middle band; anything below that is a
// genuinely weak link.
function strengthWord(strength: number | null): string {
  if (strength === null) return 'This hadith carries no recorded chain.';
  if (strength >= 0.8) return 'This chain is strong.';
  if (strength >= 0.5) return 'This chain is mixed.';
  return 'A weak link was found in this chain.';
}

function HadithDetailPage() {
  const { hadithId } = Route.useParams();
  const { data, isLoading, isError } = useHadithDetail(hadithId);
  const [vocalised, setVocalised] = useState(true);

  if (isLoading) return <p>Loading the hadith…</p>;
  if (isError || !data) return <p>This hadith could not be loaded. Try again.</p>;

  const { hadith, translation, isnadChain } = data;
  // Postgres numeric columns arrive over the wire as strings; the schema's
  // z.coerce.number() converts this in the live app, but tests that mock
  // apiFetch bypass schema parsing entirely, so coerce defensively here too.
  const chainStrength = data.chainStrength === null ? null : Number(data.chainStrength);
  const links = isnadChain as IsnadLinkData[];
  const scoredWeights = links
    .filter((link) => !link.is_compiler)
    .map((link) => gradeInfo(link).weight)
    .filter((w): w is number => w !== null);

  return (
    <article>
      <p>
        <span className="m">{hadith.hadith_num}</span>
      </p>

      {/* biome-ignore lint/a11y/useSemanticElements: matches ThemeSwitch's own toggle-group pattern */}
      <div role="group" aria-label="Arabic rendering">
        <button type="button" aria-pressed={vocalised} onClick={() => setVocalised(true)}>
          Vowelled
        </button>
        <button type="button" aria-pressed={!vocalised} onClick={() => setVocalised(false)}>
          Plain
        </button>
      </div>

      <p className="ar" dir="rtl" style={{ fontSize: 'var(--fs-ar-matn)' }}>
        {vocalised ? hadith.text_diac : hadith.text_plain}
      </p>

      {translation ? (
        <div>
          <p>{translation.text_full}</p>
          <p className="label">{translation.source}</p>
        </div>
      ) : (
        <p className="label" style={{ fontStyle: 'italic' }}>
          No English translation exists for this hadith yet.
        </p>
      )}

      <p>
        {strengthWord(chainStrength)}
        {chainStrength !== null ? (
          <span className="m">{`[${chainStrength.toFixed(2)}]`}</span>
        ) : null}
      </p>
      <p className="label">
        Ilham reports grades that classical scholars wrote centuries ago. It does not judge whether
        a hadith is authentic. A number here is never Ilham&rsquo;s own opinion.
      </p>

      <h2 className="label">Chain of transmission</h2>
      <IsnadChain links={links} />

      <details>
        <summary>Show grading detail</summary>
        <StrengthPlot weights={scoredWeights} />
      </details>
    </article>
  );
}
