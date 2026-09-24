import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupInput } from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, Search as SearchIcon } from 'lucide-react';
import { z } from 'zod';
import { HadithList } from '../../domain/HadithList';
import { apiFetch } from '../../lib/apiClient';

const hadithRowSchema = z.object({
  hadith_id: z.number(),
  hadith_num: z.string(),
  text_plain: z.string(),
  text_en: z.string().nullable(),
  sanad_count: z.number(),
  chain_strength: z.coerce.number().nullable(),
});
const hadithListSchema = z.array(hadithRowSchema);

const searchParamsSchema = z.object({ q: z.string().catch(''), offset: z.number().catch(0) });
const LIMIT = 50;

export const Route = createFileRoute('/_authed/search')({
  validateSearch: searchParamsSchema,
  component: SearchPage,
});

function SearchPage() {
  const { q, offset } = Route.useSearch();
  const navigate = Route.useNavigate();

  const results = useQuery({
    queryKey: ['hadiths', { q, limit: LIMIT, offset }],
    queryFn: () =>
      apiFetch(
        `/hadiths?q=${encodeURIComponent(q)}&limit=${LIMIT}&offset=${offset}`,
        hadithListSchema,
      ),
    enabled: q.trim().length > 0,
    staleTime: Number.POSITIVE_INFINITY,
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <SearchIcon className="size-6" />
          Search the hadiths
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
                <FieldLabel htmlFor="hadith-search">Search the Arabic text</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="hadith-search"
                    name="q"
                    type="search"
                    defaultValue={q}
                    dir="rtl"
                  />
                </InputGroup>
                <FieldDescription>
                  Search removes the diacritic marks and the tatweel, and unifies the alif, ta
                  marbuta, and ya forms. A vocalised word still matches its unvocalised record.
                </FieldDescription>
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
              Search reads hadith text only. To find a person instead, search the narrators.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : results.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : results.isError || !results.data ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>The search could not run</EmptyTitle>
            <EmptyDescription>Try again.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : results.data.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Nothing matches</EmptyTitle>
            <EmptyDescription>
              Either no hadith carries these words, or the vocalisation differs. Try fewer words, or
              search the narrators for the same string.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <HadithList
            items={results.data.map((hadith) => ({
              hadith_id: hadith.hadith_id,
              hadith_num: hadith.hadith_num,
              text_plain: hadith.text_plain,
              text_en: hadith.text_en,
              chain_strength: hadith.chain_strength === null ? null : Number(hadith.chain_strength),
            }))}
          />
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
        </>
      )}
      {q.trim().length > 0 && results.data && results.data.length === 0 && !results.isLoading ? (
        <p className="text-sm">
          <Link to="/narrators" search={{ q, offset: 0 }} className="underline">
            Search the narrators for “{q}”
          </Link>
        </p>
      ) : null}
    </div>
  );
}
