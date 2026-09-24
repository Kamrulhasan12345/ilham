import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { z } from 'zod';
import { apiFetch } from '../../../lib/apiClient';

const narratorSchema = z.object({
  narrator_id: z.number(),
  display_name: z.string(),
  name: z.string(),
  name_en: z.string().nullable(),
  kunya: z.string().nullable(),
  lineage: z.string().nullable(),
  relation: z.string().nullable(),
  tabaqa_raw: z.string().nullable(),
  generation: z.number().nullable(),
  school: z.string().nullable(),
  date_of_death: z.string().nullable(),
  is_placeholder: z.boolean(),
  rank_ibn_hajar_raw: z.string().nullable(),
  rank_ibn_hajar_code: z.string().nullable(),
  rank_ibn_hajar_label: z.string().nullable(),
  rank_ibn_hajar_weight: z.coerce.number().nullable(),
  rank_dhahabi_raw: z.string().nullable(),
  rank_dhahabi_code: z.string().nullable(),
  rank_dhahabi_label: z.string().nullable(),
  rank_dhahabi_weight: z.coerce.number().nullable(),
});

const narratorHadithSchema = z.array(
  z.object({ hadith_id: z.number(), hadith_num: z.string(), collection_id: z.number() }),
);

const adjacentSchema = z.array(
  z.object({
    direction: z.enum(['taught', 'learned_from']),
    narrator_id: z.number().nullable(),
    display_name: z.string().nullable(),
    transmission_word: z.string().nullable(),
  }),
);

const searchParamsSchema = z.object({ offset: z.number().catch(0) });
const LIMIT = 50;

export const Route = createFileRoute('/_authed/narrators/$narratorId')({
  validateSearch: searchParamsSchema,
  component: NarratorProfilePage,
});

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span>{children ?? <span className="text-muted-foreground">not recorded</span>}</span>
    </div>
  );
}

function NarratorProfilePage() {
  const { narratorId } = Route.useParams();
  const { offset } = Route.useSearch();
  const navigate = Route.useNavigate();

  const profile = useQuery({
    queryKey: ['narrators', narratorId],
    queryFn: () => apiFetch(`/narrators/${narratorId}`, narratorSchema),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const chains = useQuery({
    queryKey: ['narrators', narratorId, 'hadiths', { limit: LIMIT, offset }],
    queryFn: () =>
      apiFetch(
        `/narrators/${narratorId}/hadiths?limit=${LIMIT}&offset=${offset}`,
        narratorHadithSchema,
      ),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const adjacent = useQuery({
    queryKey: ['narrators', narratorId, 'adjacent'],
    queryFn: () => apiFetch(`/narrators/${narratorId}/adjacent`, adjacentSchema),
    staleTime: Number.POSITIVE_INFINITY,
  });

  if (profile.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (profile.isError || !profile.data) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>This narrator could not be loaded</EmptyTitle>
          <EmptyDescription>Try again.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const narrator = profile.data;

  // A placeholder narrator has every field NULL. The whole page is one
  // empty state — the absence is the finding.
  if (narrator.is_placeholder) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Narrator</h1>
        <Empty>
          <EmptyHeader>
            <EmptyTitle>The source records no name here</EmptyTitle>
            <EmptyDescription>
              This link in the chain is unnamed: no profile matched it, or the name fits more than
              one person. The chain shows the raw name and scores the link at the unnamed weight.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const learnedFrom = (adjacent.data ?? []).filter((row) => row.direction === 'learned_from');
  const taught = (adjacent.data ?? []).filter((row) => row.direction === 'taught');

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 dir="rtl" lang="ar" className="text-right font-arabic text-4xl">
          {narrator.display_name}
        </h1>
        {narrator.name_en ? (
          <p className="text-lg text-muted-foreground">{narrator.name_en}</p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Fact label="Kunya">{narrator.kunya}</Fact>
            <Fact label="Lineage">{narrator.lineage}</Fact>
            <Fact label="Relation">{narrator.relation}</Fact>
            <Fact label="Generation">
              {narrator.generation !== null ? (
                <span className="font-mono tabular-nums">{narrator.generation}</span>
              ) : null}
            </Fact>
            <Fact label="School">{narrator.school}</Fact>
            <Fact label="Death">{narrator.date_of_death}</Fact>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grades</CardTitle>
            <CardDescription>The score uses the stricter of the two.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-muted-foreground">Ibn Hajar</span>
              {narrator.rank_ibn_hajar_raw ? (
                <span>
                  <span dir="rtl" lang="ar" className="font-arabic text-xl">
                    {narrator.rank_ibn_hajar_raw}
                  </span>{' '}
                  {narrator.rank_ibn_hajar_weight !== null ? (
                    <Badge variant="secondary" className="font-mono tabular-nums">
                      {Number(narrator.rank_ibn_hajar_weight).toFixed(2)}
                    </Badge>
                  ) : null}
                </span>
              ) : (
                <span className="text-muted-foreground">Ibn Hajar left no grade.</span>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-muted-foreground">Al-Dhahabi</span>
              {narrator.rank_dhahabi_raw ? (
                <span>
                  <span dir="rtl" lang="ar" className="font-arabic text-xl">
                    {narrator.rank_dhahabi_raw}
                  </span>{' '}
                  {narrator.rank_dhahabi_weight !== null ? (
                    <Badge variant="secondary" className="font-mono tabular-nums">
                      {Number(narrator.rank_dhahabi_weight).toFixed(2)}
                    </Badge>
                  ) : null}
                </span>
              ) : (
                <span className="text-muted-foreground">Al-Dhahabi left no grade.</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Chains</h2>
        {chains.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : chains.isError || !chains.data ? (
          <p className="text-sm text-muted-foreground">
            The chains could not be loaded. Try again.
          </p>
        ) : chains.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No chain positions name this narrator.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {chains.data.map((hadith) => (
                <Button key={hadith.hadith_id} variant="outline" size="sm" asChild>
                  <Link to="/hadiths/$hadithId" params={{ hadithId: String(hadith.hadith_id) }}>
                    <span className="font-mono tabular-nums">{hadith.hadith_num}</span>
                  </Link>
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Showing {offset + 1}–{offset + chains.data.length}
              </span>
              <span className="flex-1" />
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => navigate({ search: { offset: Math.max(0, offset - LIMIT) } })}
              >
                <ChevronLeft data-icon="inline-start" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={chains.data.length < LIMIT}
                onClick={() => navigate({ search: { offset: offset + LIMIT } })}
              >
                Next
                <ChevronRight data-icon="inline-end" />
              </Button>
            </div>
          </>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Teachers and students</h2>
        {adjacent.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : adjacent.isError || !adjacent.data ? (
          <p className="text-sm text-muted-foreground">
            The neighbours could not be loaded. Try again.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Direction</TableHead>
                <TableHead>Narrator</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {learnedFrom.map((row) => (
                <TableRow
                  key={`from-${row.narrator_id}-${row.display_name}-${row.transmission_word ?? ''}`}
                >
                  <TableCell>
                    <Badge variant="secondary">Learned from</Badge>
                  </TableCell>
                  <TableCell>
                    {row.narrator_id !== null ? (
                      <Link
                        to="/narrators/$narratorId"
                        params={{ narratorId: String(row.narrator_id) }}
                        className="hover:underline"
                      >
                        <span dir="rtl" lang="ar" className="font-arabic">
                          {row.display_name}
                        </span>
                      </Link>
                    ) : (
                      <span dir="rtl" lang="ar" className="font-arabic">
                        {row.display_name ?? 'unnamed'}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {taught.map((row) => (
                <TableRow
                  key={`to-${row.narrator_id}-${row.display_name}-${row.transmission_word ?? ''}`}
                >
                  <TableCell>
                    <Badge variant="secondary">Taught</Badge>
                  </TableCell>
                  <TableCell>
                    {row.narrator_id !== null ? (
                      <Link
                        to="/narrators/$narratorId"
                        params={{ narratorId: String(row.narrator_id) }}
                        className="hover:underline"
                      >
                        <span dir="rtl" lang="ar" className="font-arabic">
                          {row.display_name}
                        </span>
                      </Link>
                    ) : (
                      <span dir="rtl" lang="ar" className="font-arabic">
                        {row.display_name ?? 'unnamed'}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
