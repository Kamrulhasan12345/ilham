import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { Crumbs } from '../../../domain/Crumbs';
import { DistributionStrip } from '../../../domain/DistributionStrip';
import { GenerationFilter } from '../../../domain/GenerationFilter';
import { IsnadChain, type IsnadLinkData } from '../../../domain/IsnadChain';
import { Absent, Rail, RailRow } from '../../../domain/Rail';
import { State } from '../../../domain/State';
import { StrengthPlot } from '../../../domain/StrengthPlot';
import { VerdictBand, type VerdictWord } from '../../../domain/VerdictBand';
import { gradeInfo, groupIsnadChains } from '../../../domain/grading';
import { ApiError, apiFetch } from '../../../lib/apiClient';
import { Button } from '../../../ui/Button';
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { Seg } from '../../../ui/Seg';
import { Table } from '../../../ui/Table';
import { toast } from '../../../ui/Toast';

const isnadLinkSchema = z.object({
  sanad_no: z.number(),
  position: z.number(),
  narrator_id: z.number().nullable(),
  raw_name: z.string(),
  display_name: z.string().nullable(),
  name_en: z.string().nullable(),
  kunya: z.string().nullable(),
  lineage: z.string().nullable(),
  school: z.string().nullable(),
  tabaqa_raw: z.string().nullable(),
  generation: z.number().nullable(),
  transmission_word: z.string().nullable(),
  is_compiler: z.boolean(),
  resolution: z.string(),
  is_placeholder: z.boolean(),
  rank_ibn_hajar_raw: z.string().nullable(),
  rank_ibn_hajar: z.string().nullable(),
  rank_ibn_hajar_via: z.string().nullable(),
  rank_ibn_hajar_weight: z.coerce.number().nullable(),
  rank_dhahabi_raw: z.string().nullable(),
  rank_dhahabi: z.string().nullable(),
  rank_dhahabi_via: z.string().nullable(),
  rank_dhahabi_weight: z.coerce.number().nullable(),
  weight: z.coerce.number().nullable().optional(),
});

const chainSchema = z.object({
  sanad_no: z.number(),
  strength: z.coerce.number().nullable(),
  links: z.array(isnadLinkSchema),
});

const hadithDetailSchema = z.object({
  hadith: z.object({
    hadith_id: z.number(),
    hadith_num: z.string(),
    text_plain: z.string(),
    text_diac: z.string(),
    sanad_count: z.number(),
  }),
  collection: z.object({
    slug: z.string(),
    title_ar: z.string(),
    title_en: z.string().nullable(),
  }),
  chapter: z.object({ chapter_id: z.number(), seq: z.number(), title_ar: z.string() }).nullable(),
  translation: z
    .object({
      lang: z.string(),
      text_full: z.string(),
      source: z.string(),
      match_via: z.string().nullable(),
    })
    .nullable(),
  isnadChain: z.array(isnadLinkSchema),
  chains: z.array(chainSchema),
  chainStrength: z.coerce.number().nullable(),
  chainStrengthBasis: z.object({ words_aligned: z.boolean(), sanad_count: z.number() }),
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
function strengthWord(strength: number | null): VerdictWord {
  if (strength === null) return 'none';
  if (strength >= 0.8) return 'strong';
  if (strength >= 0.5) return 'mixed';
  return 'weak';
}

/** Two factual sentences about who stands in this chain. */
function chainBodyText(links: IsnadLinkData[]): string {
  const scored = links.filter((link) => !link.is_compiler);
  if (scored.length === 0) return 'The source records no narrators for this chain.';
  const identified = scored.filter((link) => link.resolution === 'A' || link.resolution === 'B');
  const graded = scored.filter((link) => link.rank_ibn_hajar);
  const first = `Every one of the ${scored.length} narrators has been identified.`;
  if (identified.length !== scored.length) {
    return `${identified.length} of the ${scored.length} narrators could be matched to a profile. The number scores the chain of narrators, not whether the hadith is true.`;
  }
  if (graded.length === 0) {
    return `${first} No scholar graded any of them, so every link stands at the neutral weight. The number scores the chain of narrators, not whether the hadith is true.`;
  }
  const weakest = graded
    .map((link) => gradeInfo(link))
    .filter((g) => g.weight !== null)
    .sort((a, b) => (a.weight as number) - (b.weight as number))[0];
  return `${first} Ibn Hajar graded ${graded.length} of them. ${
    weakest ? `The lowest grade sets the score. ` : ''
  }The number scores the chain of narrators, not whether the hadith is true.`;
}

function readStored(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : raw === '1';
  } catch {
    return fallback;
  }
}

function HadithDetailPage() {
  const { hadithId } = Route.useParams();
  const { data, isLoading, isError } = useHadithDetail(hadithId);
  const [vocalised, setVocalised] = useState(() => readStored('ilham:vocalised', true));
  const [gradingOpen, setGradingOpen] = useState(() => readStored('ilham:grading-detail', false));
  const [selectedSanad, setSelectedSanad] = useState<number | null>(null);
  const [genCut, setGenCut] = useState<number | null>(null);

  const setVocalisedStored = (next: boolean) => {
    setVocalised(next);
    try {
      window.localStorage.setItem('ilham:vocalised', next ? '1' : '0');
    } catch {
      /* a private window keeps the default */
    }
  };
  const setGradingStored = (next: boolean) => {
    setGradingOpen(next);
    try {
      window.localStorage.setItem('ilham:grading-detail', next ? '1' : '0');
    } catch {
      /* a private window keeps the default */
    }
  };

  const distribution = useQuery({
    queryKey: ['hadiths', 'strength-distribution'],
    queryFn: () =>
      apiFetch(
        '/hadiths/strength-distribution',
        z.array(z.object({ bucket: z.number(), count: z.number() })),
      ),
    staleTime: Number.POSITIVE_INFINITY,
    enabled: gradingOpen,
  });

  if (isLoading) {
    return (
      <State title="Loading the hadith" quiet>
        <p>The corpus record is on its way.</p>
      </State>
    );
  }
  if (isError || !data) {
    return (
      <State title="This hadith could not be loaded">
        <p>Try again. The record may have moved, or the connection may have dropped.</p>
      </State>
    );
  }

  const { hadith, collection, chapter, translation, chainStrengthBasis } = data;
  // Postgres numeric columns arrive over the wire as strings; the schema's
  // z.coerce.number() converts this in the live app, but tests that mock
  // apiFetch bypass schema parsing entirely, so coerce defensively here too.
  const chainStrength = data.chainStrength === null ? null : Number(data.chainStrength);
  const links = data.isnadChain as IsnadLinkData[];
  interface ActiveChain {
    sanadNo: number;
    strength: number | null;
    links: IsnadLinkData[];
  }
  const servedChains: ActiveChain[] = data.chains.map((chain) => ({
    sanadNo: chain.sanad_no,
    strength: chain.strength === null ? null : Number(chain.strength),
    links: (chain.links as IsnadLinkData[]).map((link) => ({
      ...link,
      weight: link.weight === null || link.weight === undefined ? link.weight : Number(link.weight),
    })),
  }));
  const chains: ActiveChain[] =
    servedChains.length > 0
      ? servedChains
      : groupIsnadChains(links).map((chain) => ({ ...chain, strength: null }));
  const strongest = chains
    .filter((chain) => chain.strength !== null)
    .sort((a, b) => (b.strength as number) - (a.strength as number))[0];
  const activeSanad = selectedSanad ?? strongest?.sanadNo ?? chains[0]?.sanadNo ?? null;
  const activeChain = chains.find((chain) => chain.sanadNo === activeSanad) ?? chains[0];
  const activeStrength = activeChain?.strength ?? null;

  const chainLinks = activeChain?.links ?? [];
  const scoredLinks = chainLinks.filter((link) => !link.is_compiler);
  const generations = scoredLinks
    .map((link) => link.generation)
    .filter((g): g is number => g !== null);
  const maxGeneration = generations.length > 0 ? Math.max(...generations) : 0;
  const cut = maxGeneration === 0 ? 0 : Math.min(genCut ?? maxGeneration, maxGeneration);
  const visibleLinks = chainLinks.filter(
    (link) => link.generation === null || link.generation === undefined || link.generation <= cut,
  );
  const alwaysShown = chainLinks.filter(
    (link) => (link.generation === null || link.generation === undefined) && !link.is_compiler,
  ).length;

  const plotWeights = scoredLinks
    .map((link) => gradeInfo(link).weight)
    .filter((w): w is number => w !== null);
  const plotBase = scoredLinks
    .map((link) => gradeInfo(link).baseWeight)
    .filter((w): w is number => w !== null);

  return (
    <article>
      <Crumbs
        trail={[
          { label: 'Collections', href: '/collections' },
          {
            label: collection.title_en ?? collection.title_ar,
            href: `/collections/${collection.slug}`,
            arabic: collection.title_en ? collection.title_ar : undefined,
          },
          ...(chapter
            ? [
                {
                  label: `Chapter ${chapter.seq}`,
                  href: `/collections/${collection.slug}/${chapter.seq}`,
                  arabic: chapter.title_ar,
                },
              ]
            : []),
          { label: `Hadith ${hadith.hadith_num}` },
        ]}
      />

      <Rail
        side={
          <>
            <RailRow label="Source">
              {collection.title_en ?? collection.title_ar}{' '}
              <span className="ar" dir="rtl">
                {collection.title_ar}
              </span>
            </RailRow>
            <RailRow label="Identifier">
              <span className="m">{hadith.hadith_num}</span>
            </RailRow>
            <RailRow label="Chapter">
              {chapter ? (
                <>
                  <span className="m m--bare">{`[${chapter.seq}]`}</span>{' '}
                  <span className="ar" dir="rtl">
                    {chapter.title_ar}
                  </span>
                </>
              ) : (
                <Absent>not filed</Absent>
              )}
            </RailRow>
            <RailRow label="Sanads recorded">
              <span className="m m--bare">{`[${hadith.sanad_count}]`}</span>
            </RailRow>
            <RailRow label="Chain length">
              <span className="m m--bare">{`[${scoredLinks.length}]`}</span> and the collector
            </RailRow>
            <RailRow label="Translation">
              {translation ? translation.source : <Absent>none attached</Absent>}
            </RailRow>
          </>
        }
      >
        <h1>
          Hadith <span className="m">{hadith.hadith_num}</span>
        </h1>

        <Seg
          label="Arabic rendering"
          options={[
            { value: 'vowelled', label: 'Vowelled' },
            { value: 'plain', label: 'Plain' },
          ]}
          value={vocalised ? 'vowelled' : 'plain'}
          onChange={(next) => setVocalisedStored(next === 'vowelled')}
        />

        <p className="ar" dir="rtl" style={{ fontSize: 'var(--fs-ar-matn)' }}>
          {vocalised ? hadith.text_diac : hadith.text_plain}
        </p>

        {translation ? (
          <div>
            <p>{translation.text_full}</p>
            <p className="label">
              {translation.source}
              {translation.match_via ? ` · matched ${translation.match_via}` : null}
            </p>
          </div>
        ) : (
          <p className="label">No English translation exists for this hadith yet.</p>
        )}

        <VerdictBand
          word={strengthWord(activeStrength ?? chainStrength)}
          strength={activeStrength ?? chainStrength}
        >
          {chainBodyText(chainLinks)}
          {!chainStrengthBasis.words_aligned && hadith.sanad_count > 1 ? (
            <>
              {' '}
              The loader aligns transmission words for single-chain hadiths only, so this score
              carries no anʿana penalty and is not comparable across hadiths.
            </>
          ) : null}
        </VerdictBand>

        {chains.length > 1 ? (
          <section aria-label="Choose a chain">
            <h2 className="label">Chains</h2>
            <Seg
              label="Chains"
              options={chains.map((chain) => ({
                value: String(chain.sanadNo),
                label: `Sanad ${chain.sanadNo}${chain.strength !== null ? ` · ${chain.strength.toFixed(2)}` : ''}${
                  strongest && chain.sanadNo === strongest.sanadNo ? ' · strongest' : ''
                }`,
              }))}
              value={String(activeSanad)}
              onChange={(next) => setSelectedSanad(Number(next))}
            />
          </section>
        ) : null}

        {maxGeneration > 0 ? (
          <GenerationFilter
            maxGeneration={maxGeneration}
            value={cut}
            onChange={setGenCut}
            visibleCount={visibleLinks.filter((link) => !link.is_compiler).length}
            totalCount={scoredLinks.length}
            alwaysShown={alwaysShown}
          />
        ) : null}

        <h2 className="label">Chain of transmission</h2>
        <IsnadChain
          links={visibleLinks}
          strongestSanadNo={strongest?.sanadNo}
          linkHref={(id) => `/narrators/${id}`}
        />

        <details
          open={gradingOpen}
          onToggle={(event) => setGradingStored((event.target as HTMLDetailsElement).open)}
        >
          <summary>Show grading detail</summary>
          <Table caption="Every scored link: its generation, both raw verdicts, the provenance tiers, and the weight.">
            <thead>
              <tr>
                <th scope="col">Narrator</th>
                <th scope="col">Generation</th>
                <th scope="col">Ibn Hajar</th>
                <th scope="col">Al-Dhahabi</th>
                <th scope="col">Weight</th>
              </tr>
            </thead>
            <tbody>
              {scoredLinks.map((link) => {
                const info = gradeInfo(link);
                return (
                  <tr key={`${link.sanad_no}-${link.position}`}>
                    <td>
                      <span className="ar" dir="rtl">
                        {link.display_name ?? link.raw_name}
                      </span>
                    </td>
                    <td>
                      {link.generation !== null && link.generation !== undefined ? (
                        <span className="m m--bare">{`[${link.generation}]`}</span>
                      ) : (
                        <Absent>not recorded</Absent>
                      )}
                    </td>
                    <td>
                      {link.rank_ibn_hajar_raw ? (
                        <>
                          <span className="ar" dir="rtl">
                            {link.rank_ibn_hajar_raw}
                          </span>{' '}
                          {link.rank_ibn_hajar_via ? (
                            <span className="m m--bare">{`[${link.rank_ibn_hajar_via}]`}</span>
                          ) : null}
                        </>
                      ) : (
                        <Absent>no verdict</Absent>
                      )}
                    </td>
                    <td>
                      {link.rank_dhahabi_raw ? (
                        <>
                          <span className="ar" dir="rtl">
                            {link.rank_dhahabi_raw}
                          </span>{' '}
                          {link.rank_dhahabi_via ? (
                            <span className="m m--bare">{`[${link.rank_dhahabi_via}]`}</span>
                          ) : null}
                        </>
                      ) : (
                        <Absent>no verdict</Absent>
                      )}
                    </td>
                    <td>
                      {info.weight !== null ? (
                        <span className="m m--bare">{`[${info.weight.toFixed(2)}]`}</span>
                      ) : (
                        <Absent>unscored</Absent>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <StrengthPlot weights={plotWeights} baseWeights={plotBase} strength={activeStrength} />
          {distribution.data ? (
            <DistributionStrip buckets={distribution.data} strength={chainStrength} />
          ) : distribution.isLoading ? (
            <p className="label">Drawing the corpus distribution…</p>
          ) : null}
        </details>

        <StudyActions hadithId={hadith.hadith_id} />
      </Rail>
    </article>
  );
}

const studySetsSchema = z.array(z.object({ study_set_id: z.number(), name: z.string() }));

function StudyActions({ hadithId }: { hadithId: number }) {
  const sets = useQuery({
    queryKey: ['sets'],
    queryFn: () => apiFetch('/sets', studySetsSchema),
  });
  const [noteBody, setNoteBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function addToSet(setId: number) {
    setBusy(true);
    try {
      await apiFetch(`/sets/${setId}/items`, z.unknown(), {
        method: 'POST',
        body: { hadith_id: hadithId },
      });
      toast('Saved to the set.');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save to the set. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function writeNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!noteBody.trim()) return;
    setBusy(true);
    try {
      await apiFetch('/notes', z.unknown(), {
        method: 'POST',
        body: { hadith_id: hadithId, body: noteBody.trim() },
      });
      setNoteBody('');
      toast('Note saved.');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not save the note. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Study actions">
      <h2 className="label">Study</h2>
      {sets.data && sets.data.length > 0 ? (
        <Seg
          label="Add to a study set"
          options={sets.data.map((set) => ({ value: String(set.study_set_id), label: set.name }))}
          value=""
          onChange={(next) => addToSet(Number(next))}
        />
      ) : (
        <p className="label">
          No study sets yet —{' '}
          {busy ? 'saving…' : 'create one from the study sets page, then add this hadith.'}
        </p>
      )}
      <form onSubmit={writeNote}>
        <Field label="Write a note on this hadith">
          {({ controlId, describedBy }) => (
            <Input
              id={controlId}
              aria-describedby={describedBy}
              multiline
              rows={3}
              value={noteBody}
              onChange={(event) => setNoteBody(event.target.value)}
            />
          )}
        </Field>
        <Button type="submit" variant="primary" disabled={busy || !noteBody.trim()}>
          Save note
        </Button>
      </form>
    </section>
  );
}
