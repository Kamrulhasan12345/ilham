import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { HadithList } from '../../domain/HadithList';
import { State } from '../../domain/State';
import { apiFetch } from '../../lib/apiClient';
import { Button } from '../../ui/Button';
import { Field } from '../../ui/Field';
import { Input } from '../../ui/Input';
import { Pager } from '../../ui/Pager';

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
    <div>
      <h1>Search the hadiths</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get('q');
          navigate({ search: { q: typeof value === 'string' ? value : '', offset: 0 } });
        }}
      >
        <Field
          label="Search the Arabic text"
          hint="Search removes the diacritic marks and the tatweel, and unifies the alif, ta marbuta, and ya forms. A vocalised word still matches its unvocalised record."
        >
          {({ controlId, describedBy }) => (
            <Input
              id={controlId}
              aria-describedby={describedBy}
              name="q"
              type="search"
              defaultValue={q}
              dir="rtl"
            />
          )}
        </Field>
        <Button type="submit" variant="primary">
          Search
        </Button>
      </form>

      {q.trim().length === 0 ? (
        <State title="Type to search" quiet>
          <p>Search reads hadith text only. To find a person instead, search the narrators.</p>
        </State>
      ) : results.isLoading ? (
        <State title="Searching" quiet>
          <p>Reading the corpus for your words.</p>
        </State>
      ) : results.isError || !results.data ? (
        <State title="The search could not run">
          <p>Try again.</p>
        </State>
      ) : results.data.length === 0 ? (
        <State title="Nothing matches">
          <p>
            Either no hadith carries these words, or the vocalisation differs. Try fewer words, or
            search the narrators for the same string.
          </p>
          <p>
            <Link to="/narrators" search={{ q, offset: 0 }}>
              Search the narrators for “{q}”
            </Link>
          </p>
        </State>
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
          <Pager
            offset={offset}
            limit={LIMIT}
            count={results.data.length}
            onPrev={() => navigate({ search: { q, offset: Math.max(0, offset - LIMIT) } })}
            onNext={() => navigate({ search: { q, offset: offset + LIMIT } })}
          />
        </>
      )}
    </div>
  );
}
