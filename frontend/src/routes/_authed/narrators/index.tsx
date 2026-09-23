import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { State } from '../../../domain/State';
import { apiFetch } from '../../../lib/apiClient';
import { Chip } from '../../../ui/Chip';
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { Pager } from '../../../ui/Pager';

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
    <div>
      <h1>Find a narrator</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get('q');
          navigate({ search: { q: typeof value === 'string' ? value : '', offset: 0 } });
        }}
      >
        <Field label="Search narrator names">
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
      </form>

      {q.trim().length === 0 ? (
        <State title="Type to search" quiet>
          <p>Twenty thousand narrators stand behind this box. Name one.</p>
        </State>
      ) : results.isLoading ? (
        <State title="Searching" quiet>
          <p>Reading the narrator records.</p>
        </State>
      ) : results.isError || !results.data ? (
        <State title="The search could not run">
          <p>Try again.</p>
        </State>
      ) : (
        <>
          <p>
            <Chip
              pressed={includePlaceholders}
              onClick={() => setIncludePlaceholders(!includePlaceholders)}
            >
              Include unnamed records
            </Chip>
          </p>
          {visible.length === 0 ? (
            <State title="Nothing matches">
              <p>
                No narrator carries this name. Unnamed records carry no name at all — include them,
                or try fewer words.
              </p>
            </State>
          ) : (
            <ul>
              {visible.map((narrator) => (
                <li key={narrator.narrator_id}>
                  <Link
                    to="/narrators/$narratorId"
                    params={{ narratorId: String(narrator.narrator_id) }}
                  >
                    <span className="ar" dir="rtl">
                      {narrator.display_name}
                    </span>
                    {narrator.name_en ? <span> — {narrator.name_en}</span> : null}
                  </Link>{' '}
                  {narrator.generation !== null ? (
                    <span className="m m--bare">{`[generation ${narrator.generation}]`}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
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
