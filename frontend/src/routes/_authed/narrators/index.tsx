import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupInput } from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
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

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Users className="size-6" />
          Find a narrator
        </h1>
      </div>
      <Card>
        <CardContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const value = new FormData(event.currentTarget).get('q');
              navigate({ search: { q: typeof value === 'string' ? value : '', offset: 0 } });
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="narrator-search">Search narrator names</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="narrator-search"
                    name="q"
                    type="search"
                    defaultValue={q}
                    dir="rtl"
                  />
                </InputGroup>
              </Field>
              <Field orientation="horizontal">
                <Button type="submit">Search</Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      {q.trim().length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Type to search</EmptyTitle>
            <EmptyDescription>
              Twenty thousand narrators stand behind this box. Name one.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : results.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : results.isError || !results.data ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>The search could not run</EmptyTitle>
            <EmptyDescription>Try again.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          <Field orientation="horizontal">
            <Switch
              id="include-placeholders"
              checked={includePlaceholders}
              onCheckedChange={setIncludePlaceholders}
            />
            <FieldLabel htmlFor="include-placeholders">Include unnamed records</FieldLabel>
          </Field>
          {visible.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Nothing matches</EmptyTitle>
                <EmptyDescription>
                  No narrator carries this name. Unnamed records carry no name at all — include
                  them, or try fewer words.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col gap-2">
              {visible.map((narrator) => (
                <Card key={narrator.narrator_id}>
                  <CardContent>
                    <Link
                      to="/narrators/$narratorId"
                      params={{ narratorId: String(narrator.narrator_id) }}
                      className="hover:underline"
                    >
                      <span dir="rtl" lang="ar" className="font-arabic text-xl">
                        {narrator.display_name}
                      </span>
                      {narrator.name_en ? (
                        <span className="text-muted-foreground"> — {narrator.name_en}</span>
                      ) : null}
                    </Link>{' '}
                    {narrator.generation !== null ? (
                      <span className="font-mono text-sm tabular-nums text-muted-foreground">
                        generation {narrator.generation}
                      </span>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Showing {offset + 1}–{offset + results.data.length}
            </span>
            <span className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => navigate({ search: { q, offset: Math.max(0, offset - LIMIT) } })}
            >
              <ChevronLeft data-icon="inline-start" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={results.data.length < LIMIT}
              onClick={() => navigate({ search: { q, offset: offset + LIMIT } })}
            >
              Next
              <ChevronRight data-icon="inline-end" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
