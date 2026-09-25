import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldLabel } from '@/components/ui/field';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { ChevronRight, UserRound } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { PageHeader } from '../../../app/PageHeader';
import { Pager } from '../../../app/Pager';
import { SearchForm } from '../../../app/SearchForm';
import { apiFetch } from '../../../lib/apiClient';

const narratorRowSchema = z.object({
  narrator_id: z.number(),
  display_name: z.string(),
  name_en: z.string().nullable(),
  generation: z.number().nullable(),
  is_placeholder: z.boolean(),
});
const narratorListSchema = z.array(narratorRowSchema);

const searchParamsSchema = z.object({ q: z.string().catch(''), offset: z.number().catch(0) });
const LIMIT = 50;

export const Route = createFileRoute('/_authed/narrators/')({
  validateSearch: searchParamsSchema,
  component: NarratorListPage,
});

function NarratorListPage() {
  const { q, offset } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [includePlaceholders, setIncludePlaceholders] = useState(false);

  const results = useQuery({
    queryKey: ['narrators', { q, limit: LIMIT, offset }],
    queryFn: () =>
      apiFetch(
        `/narrators?q=${encodeURIComponent(q)}&limit=${LIMIT}&offset=${offset}`,
        narratorListSchema,
      ),
    enabled: q.trim().length > 0,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const visible = (results.data ?? []).filter(
    (narrator) => includePlaceholders || !narrator.is_placeholder,
  );

  const message = (title: string, description: React.ReactNode) => (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Narrators"
        description="Find a narrator by name, then read their grades and their place in the chains."
      />
      <SearchForm
        id="narrator-search"
        label="Search narrator names"
        defaultValue={q}
        placeholder="اسم الراوي…"
        onSearch={(next) => navigate({ search: { q: next, offset: 0 } })}
      />

      {q.trim().length === 0 ? (
        message('Type to search', 'Twenty thousand narrators stand behind this box. Name one.')
      ) : results.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : results.isError || !results.data ? (
        message('The search could not run', 'Try again.')
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Results</h2>
            </CardTitle>
            <CardDescription>Arabic name, English name where known, and generation</CardDescription>
            <CardAction>
              <Field orientation="horizontal">
                <Switch
                  id="include-placeholders"
                  checked={includePlaceholders}
                  onCheckedChange={setIncludePlaceholders}
                />
                <FieldLabel htmlFor="include-placeholders">Include unnamed records</FieldLabel>
              </Field>
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {visible.length === 0 ? (
              message(
                'Nothing matches',
                'No narrator carries this name. Unnamed records carry no name at all, so include them, or try fewer words.',
              )
            ) : (
              <ItemGroup className="gap-1">
                {visible.map((narrator) => (
                  <Item key={narrator.narrator_id} size="sm" asChild>
                    <Link
                      to="/narrators/$narratorId"
                      params={{ narratorId: String(narrator.narrator_id) }}
                    >
                      <ItemMedia
                        variant="icon"
                        className="size-10 rounded-full bg-primary/10 text-primary"
                      >
                        <UserRound />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle dir="rtl" lang="ar" className="font-arabic text-lg font-normal">
                          {narrator.display_name}
                        </ItemTitle>
                        {narrator.name_en ? (
                          <ItemDescription>{narrator.name_en}</ItemDescription>
                        ) : null}
                      </ItemContent>
                      <ItemActions>
                        {narrator.generation !== null ? (
                          <Badge variant="secondary">Generation {narrator.generation}</Badge>
                        ) : null}
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </ItemActions>
                    </Link>
                  </Item>
                ))}
              </ItemGroup>
            )}
            <Pager
              offset={offset}
              count={results.data.length}
              limit={LIMIT}
              onOffset={(next) => navigate({ search: { q, offset: next } })}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
