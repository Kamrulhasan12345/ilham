import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { PageHeader } from '../../../app/PageHeader';
import { AddToSet } from '../../../domain/AddToSet/AddToSet';
import { DistributionStrip } from '../../../domain/DistributionStrip';
import { GenerationFilter } from '../../../domain/GenerationFilter';
import { IsnadChain, type IsnadLinkData } from '../../../domain/IsnadChain';
import { Absent, RailRow } from '../../../domain/Rail';
import { StrengthPlot } from '../../../domain/StrengthPlot';
import { VerdictBand, type VerdictWord } from '../../../domain/VerdictBand';
import { gradeInfo, groupIsnadChains } from '../../../domain/grading';
import { ApiError, apiFetch } from '../../../lib/apiClient';

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
  kitab: z.object({
    kitab_id: z.number(),
    kitab_num: z.number(),
    title_en: z.string(),
    title_ar: z.string(),
  }),
  // NULL for a hadith the book files under the kitab itself.
  bab: z
    .object({
      bab_id: z.number(),
      seq: z.number(),
      bab_num: z.string().nullable(),
      title_en: z.string().nullable(),
      title_ar: z.string(),
    })
    .nullable(),
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
    weakest ? 'The lowest grade sets the score. ' : ''
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
  const [gradingOpen, setGradingOpen] = useState<string | undefined>(undefined);
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

  const distribution = useQuery({
    queryKey: ['hadiths', 'strength-distribution'],
    queryFn: () =>
      apiFetch(
        '/hadiths/strength-distribution',
        z.array(z.object({ bucket: z.number(), count: z.number() })),
      ),
    staleTime: Number.POSITIVE_INFINITY,
    enabled: gradingOpen === 'grading',
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>This hadith could not be loaded</EmptyTitle>
          <EmptyDescription>
            Try again. The record may have moved, or the connection may have dropped.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const { hadith, collection, kitab, bab, translation, chainStrengthBasis } = data;
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

  const verdict = strengthWord(activeStrength ?? chainStrength);
  const verdictStrength = activeStrength ?? chainStrength;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumbs={[
          { label: 'Collections', href: '/collections' },
          {
            label: collection.title_en ?? collection.title_ar,
            href: `/collections/${collection.slug}`,
          },
          {
            label: kitab.title_en,
            href: `/collections/${collection.slug}/${kitab.kitab_num}`,
          },
          ...(bab
            ? [
                {
                  label: bab.bab_num ? `Chapter ${bab.bab_num}` : 'Chapter',
                  href: `/collections/${collection.slug}/${kitab.kitab_num}/${bab.seq}`,
                },
              ]
            : []),
          { label: `Hadith ${hadith.hadith_num}` },
        ]}
        title={<span className="tabular-nums">Hadith {hadith.hadith_num}</span>}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={verdict === 'strong' ? 'default' : 'secondary'}>
              {verdict === 'none' ? 'unscored' : `${verdict} ${verdictStrength?.toFixed(2)}`}
            </Badge>
            <Badge variant="outline">{hadith.sanad_count} sanads</Badge>
            <Badge variant="outline">{scoredLinks.length} narrators + collector</Badge>
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Arabic text</h2>
              </CardTitle>
              <CardAction>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  size="sm"
                  value={vocalised ? 'vowelled' : 'plain'}
                  onValueChange={(next) => next && setVocalisedStored(next === 'vowelled')}
                  aria-label="Arabic rendering"
                >
                  <ToggleGroupItem value="vowelled" aria-label="Vowelled">
                    Vowelled
                  </ToggleGroupItem>
                  <ToggleGroupItem value="plain" aria-label="Plain">
                    Plain
                  </ToggleGroupItem>
                </ToggleGroup>
              </CardAction>
            </CardHeader>
            <CardContent>
              <p dir="rtl" lang="ar" className="font-arabic text-3xl leading-[2.2] md:text-4xl">
                {vocalised ? hadith.text_diac : hadith.text_plain}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <h2>English translation</h2>
              </CardTitle>
              {translation ? <CardDescription>{translation.source}</CardDescription> : null}
              {translation?.match_via ? (
                <CardAction>
                  <Badge variant="outline">matched {translation.match_via}</Badge>
                </CardAction>
              ) : null}
            </CardHeader>
            <CardContent>
              {translation ? (
                <p className="text-lg leading-relaxed">{translation.text_full}</p>
              ) : (
                <p className="text-muted-foreground">
                  No English translation exists for this hadith yet.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Chain of transmission</h2>
              </CardTitle>
              <CardDescription>From the collector back to the Companion</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <VerdictBand word={verdict} strength={verdictStrength}>
                {chainBodyText(chainLinks)}
                {!chainStrengthBasis.words_aligned && hadith.sanad_count > 1 ? (
                  <>
                    {' '}
                    The loader aligns transmission words for single-chain hadiths only, so this
                    score carries no anʿana penalty and is not comparable across hadiths.
                  </>
                ) : null}
              </VerdictBand>
              {chains.length > 1 ? (
                <ToggleGroup
                  type="single"
                  variant="outline"
                  className="flex-wrap"
                  value={String(activeSanad)}
                  onValueChange={(next) => next && setSelectedSanad(Number(next))}
                  aria-label="Chains"
                >
                  {chains.map((chain) => (
                    <ToggleGroupItem key={chain.sanadNo} value={String(chain.sanadNo)}>
                      Sanad {chain.sanadNo}
                      {chain.strength !== null ? ` (${chain.strength.toFixed(2)})` : ''}
                      {strongest && chain.sanadNo === strongest.sanadNo ? ', strongest' : ''}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
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
              <IsnadChain
                links={visibleLinks}
                strongestSanadNo={strongest?.sanadNo}
                linkHref={(id) => `/narrators/${id}`}
              />
            </CardContent>
          </Card>

          <Card className="py-0">
            <CardContent>
              <Accordion
                type="single"
                collapsible
                value={gradingOpen}
                onValueChange={setGradingOpen}
              >
                <AccordionItem value="grading" className="border-b-0">
                  <AccordionTrigger>Show grading detail</AccordionTrigger>
                  <AccordionContent>
                    <div className="flex flex-col gap-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Narrator</TableHead>
                            <TableHead>Generation</TableHead>
                            <TableHead>Ibn Hajar</TableHead>
                            <TableHead>Al-Dhahabi</TableHead>
                            <TableHead>Weight</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {scoredLinks.map((link) => {
                            const info = gradeInfo(link);
                            return (
                              <TableRow key={`${link.sanad_no}-${link.position}`}>
                                <TableCell>
                                  <span dir="rtl" lang="ar" className="font-arabic">
                                    {link.display_name ?? link.raw_name}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {link.generation !== null && link.generation !== undefined ? (
                                    <span className="tabular-nums">{link.generation}</span>
                                  ) : (
                                    <Absent>not recorded</Absent>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <GradeCell
                                    raw={link.rank_ibn_hajar_raw}
                                    via={link.rank_ibn_hajar_via}
                                  />
                                </TableCell>
                                <TableCell>
                                  <GradeCell
                                    raw={link.rank_dhahabi_raw}
                                    via={link.rank_dhahabi_via}
                                  />
                                </TableCell>
                                <TableCell>
                                  {info.weight !== null ? (
                                    <span className="tabular-nums">{info.weight.toFixed(2)}</span>
                                  ) : (
                                    <Absent>unscored</Absent>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      <StrengthPlot
                        weights={plotWeights}
                        baseWeights={plotBase}
                        strength={activeStrength}
                      />
                      {distribution.data ? (
                        <DistributionStrip buckets={distribution.data} strength={chainStrength} />
                      ) : distribution.isLoading ? (
                        <p className="text-sm text-muted-foreground">
                          Drawing the corpus distribution…
                        </p>
                      ) : null}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>

        <aside className="flex h-fit flex-col gap-6 lg:sticky lg:top-20">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Details</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <RailRow label="Source">
                {collection.title_en ?? collection.title_ar}{' '}
                <span className="font-arabic" dir="rtl" lang="ar">
                  {collection.title_ar}
                </span>
              </RailRow>
              <RailRow label="Book">
                <span className="text-muted-foreground tabular-nums">{`[${kitab.kitab_num}]`}</span>{' '}
                {kitab.title_en}
              </RailRow>
              <RailRow label="Chapter">
                {bab ? (
                  <>
                    {bab.bab_num ? (
                      <span className="text-muted-foreground tabular-nums">{`[${bab.bab_num}]`}</span>
                    ) : null}{' '}
                    {bab.title_en ?? (
                      <span className="font-arabic" dir="rtl" lang="ar">
                        {bab.title_ar}
                      </span>
                    )}
                  </>
                ) : (
                  <Absent>filed under the book, before its first chapter</Absent>
                )}
              </RailRow>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <RailRow label="Sanads">
                  <span className="text-lg font-semibold tabular-nums">{hadith.sanad_count}</span>
                </RailRow>
                <RailRow label="Chain length">
                  <span className="text-lg font-semibold tabular-nums">{scoredLinks.length}</span>
                </RailRow>
              </div>
            </CardContent>
          </Card>
          <StudyActions hadithId={hadith.hadith_id} />
        </aside>
      </div>
    </div>
  );
}

function GradeCell({ raw, via }: { raw?: string | null; via?: string | null }) {
  if (!raw) return <Absent>no verdict</Absent>;
  return (
    <>
      <span dir="rtl" lang="ar" className="font-arabic">
        {raw}
      </span>{' '}
      {via ? <span className="text-sm text-muted-foreground">[{via}]</span> : null}
    </>
  );
}

function StudyActions({ hadithId }: { hadithId: number }) {
  const [noteBody, setNoteBody] = useState('');
  const [busy, setBusy] = useState(false);

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
      toast.success('Note saved.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save the note. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Study</h2>
        </CardTitle>
        <CardDescription>Save this hadith or write a note on it</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={writeNote}>
          <FieldGroup>
            <AddToSet target={{ hadith_id: hadithId }} label="Add to a study set" />
            <Field>
              <FieldLabel htmlFor="study-note">Write a note on this hadith</FieldLabel>
              <Textarea
                id="study-note"
                rows={3}
                value={noteBody}
                onChange={(event) => setNoteBody(event.target.value)}
              />
            </Field>
            <Field>
              <Button type="submit" disabled={busy || !noteBody.trim()}>
                Save note
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
