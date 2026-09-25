import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Item, ItemContent, ItemGroup, ItemMedia, ItemTitle } from '@/components/ui/item';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { UserRound } from 'lucide-react';
import { z } from 'zod';
import { Pager } from '../../../app/Pager';
import { GeoPattern } from '../../../app/Showcase';
import { Crumbs } from '../../../domain/Crumbs';
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
      <div className="flex flex-col gap-6">
        <Crumbs trail={[{ label: 'Narrators', href: '/narrators' }, { label: 'Unnamed' }]} />
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">Narrator</h1>
        <Empty className="border">
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
    <div className="flex flex-col gap-6">
      <Crumbs
        trail={[
          { label: 'Narrators', href: '/narrators' },
          { label: narrator.name_en ?? narrator.display_name },
        ]}
      />

      <Card className="gap-0 p-0">
        <div className="relative h-24 overflow-hidden rounded-t-xl bg-primary">
          <GeoPattern className="text-primary-foreground/15" />
        </div>
        <CardContent className="flex flex-col gap-4 pb-6 md:flex-row md:items-end">
          <span className="-mt-10 flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-card bg-muted text-primary">
            <UserRound className="size-9" />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1
              dir="rtl"
              lang="ar"
              className="text-left font-arabic text-3xl leading-relaxed md:text-4xl"
            >
              {narrator.display_name}
            </h1>
            {narrator.name_en ? (
              <p className="text-lg text-muted-foreground">{narrator.name_en}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {narrator.generation !== null ? (
              <Badge variant="secondary">Generation {narrator.generation}</Badge>
            ) : null}
            {narrator.school ? <Badge variant="outline">{narrator.school}</Badge> : null}
            {narrator.date_of_death ? (
              <Badge variant="outline">Died {narrator.date_of_death}</Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Grades</h2>
              </CardTitle>
              <CardDescription>The score uses the stricter of the two.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <GradeRow
                scholar="Ibn Hajar"
                raw={narrator.rank_ibn_hajar_raw}
                weight={narrator.rank_ibn_hajar_weight}
              />
              <Separator />
              <GradeRow
                scholar="Al-Dhahabi"
                raw={narrator.rank_dhahabi_raw}
                weight={narrator.rank_dhahabi_weight}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Profile</h2>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Fact label="Kunya">{narrator.kunya}</Fact>
              <Fact label="Lineage">{narrator.lineage}</Fact>
              <Fact label="Relation">{narrator.relation}</Fact>
              <Fact label="Generation">
                {narrator.generation !== null ? (
                  <span className="tabular-nums">{narrator.generation}</span>
                ) : null}
              </Fact>
              <Fact label="School">{narrator.school}</Fact>
              <Fact label="Death">{narrator.date_of_death}</Fact>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Teachers and students</h2>
              </CardTitle>
              <CardDescription>
                Who this narrator heard from, and who heard from them
              </CardDescription>
            </CardHeader>
            <CardContent>
              {adjacent.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : adjacent.isError || !adjacent.data ? (
                <p className="text-sm text-muted-foreground">
                  The neighbours could not be loaded. Try again.
                </p>
              ) : (
                <div className="grid gap-6 md:grid-cols-2">
                  <NeighbourList title="Learned from" rows={learnedFrom} />
                  <NeighbourList title="Taught" rows={taught} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Hadiths</h2>
              </CardTitle>
              <CardDescription>Hadiths whose chains name this narrator</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {chains.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : chains.isError || !chains.data ? (
                <p className="text-sm text-muted-foreground">
                  The chains could not be loaded. Try again.
                </p>
              ) : chains.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No chain positions name this narrator.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    {chains.data.map((hadith) => (
                      <Button key={hadith.hadith_id} variant="outline" size="sm" asChild>
                        <Link
                          to="/hadiths/$hadithId"
                          params={{ hadithId: String(hadith.hadith_id) }}
                        >
                          <span className="tabular-nums">{hadith.hadith_num}</span>
                        </Link>
                      </Button>
                    ))}
                  </div>
                  <Pager
                    offset={offset}
                    count={chains.data.length}
                    limit={LIMIT}
                    onOffset={(next) => navigate({ search: { offset: next } })}
                  />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function GradeRow({
  scholar,
  raw,
  weight,
}: {
  scholar: string;
  raw: string | null;
  weight: number | null;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-muted-foreground">{scholar}</span>
      {raw ? (
        <>
          <span dir="rtl" lang="ar" className="text-start font-arabic text-xl">
            {raw}
          </span>
          {weight !== null ? (
            <span className="flex items-center gap-2">
              <Progress value={Number(weight) * 100} aria-label={`${scholar} weight`} />
              <span className="text-sm text-muted-foreground tabular-nums">
                {Number(weight).toFixed(2)}
              </span>
            </span>
          ) : null}
        </>
      ) : (
        <span className="text-muted-foreground">{scholar} left no grade.</span>
      )}
    </div>
  );
}

function NeighbourList({
  title,
  rows,
}: {
  title: string;
  rows: z.infer<typeof adjacentSchema>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">
        {title} <span className="tabular-nums">({rows.length})</span>
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">None recorded.</p>
      ) : (
        <ItemGroup className="gap-1">
          {rows.map((row) => {
            const key = `${title}-${row.narrator_id}-${row.display_name}-${row.transmission_word ?? ''}`;
            return row.narrator_id !== null ? (
              <Item key={key} size="sm" asChild>
                <Link to="/narrators/$narratorId" params={{ narratorId: String(row.narrator_id) }}>
                  <NeighbourName name={row.display_name} />
                </Link>
              </Item>
            ) : (
              <Item key={key} size="sm">
                <NeighbourName name={row.display_name} />
              </Item>
            );
          })}
        </ItemGroup>
      )}
    </div>
  );
}

function NeighbourName({ name }: { name: string | null }) {
  return (
    <>
      <ItemMedia variant="icon" className="size-8 rounded-full bg-muted">
        <UserRound />
      </ItemMedia>
      <ItemContent>
        <ItemTitle dir="rtl" lang="ar" className="font-arabic text-base font-normal">
          {name ?? 'unnamed'}
        </ItemTitle>
      </ItemContent>
    </>
  );
}
