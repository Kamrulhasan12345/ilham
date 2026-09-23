import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { Absent, Rail, RailRow } from '../../../domain/Rail';
import { State } from '../../../domain/State';
import { apiFetch } from '../../../lib/apiClient';
import { Pager } from '../../../ui/Pager';
import { Table } from '../../../ui/Table';
import { Tag } from '../../../ui/Tag';

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
      <State title="Loading the narrator" quiet>
        <p>Reading the profile.</p>
      </State>
    );
  }
  if (profile.isError || !profile.data) {
    return (
      <State title="This narrator could not be loaded">
        <p>Try again.</p>
      </State>
    );
  }

  const narrator = profile.data;

  // A placeholder narrator has every field NULL. The whole page is one
  // empty state — the absence is the finding.
  if (narrator.is_placeholder) {
    return (
      <div>
        <h1>Narrator</h1>
        <State title="The source records no name here">
          <p>
            This link in the chain is unnamed: no profile matched it, or the name fits more than one
            person. The chain shows the raw name and scores the link at the unnamed weight.
          </p>
        </State>
      </div>
    );
  }

  const learnedFrom = (adjacent.data ?? []).filter((row) => row.direction === 'learned_from');
  const taught = (adjacent.data ?? []).filter((row) => row.direction === 'taught');

  return (
    <article>
      <Rail
        side={
          <>
            <RailRow label="Kunya">{narrator.kunya ?? <Absent>not recorded</Absent>}</RailRow>
            <RailRow label="Lineage">{narrator.lineage ?? <Absent>not recorded</Absent>}</RailRow>
            <RailRow label="Relation">{narrator.relation ?? <Absent>not recorded</Absent>}</RailRow>
            <RailRow label="Generation">
              {narrator.generation !== null ? (
                <span className="m m--bare">{`[${narrator.generation}]`}</span>
              ) : (
                <Absent>not recorded</Absent>
              )}
            </RailRow>
            <RailRow label="School">{narrator.school ?? <Absent>not recorded</Absent>}</RailRow>
            <RailRow label="Death">
              {narrator.date_of_death ?? <Absent>not recorded</Absent>}
            </RailRow>
          </>
        }
      >
        <h1>
          <span className="ar" dir="rtl">
            {narrator.display_name}
          </span>
        </h1>
        {narrator.name_en ? <p className="label">{narrator.name_en}</p> : null}

        <h2 className="label">Grades</h2>
        <p>
          {narrator.rank_ibn_hajar_raw ? (
            <>
              Ibn Hajar:{' '}
              <span className="ar" dir="rtl">
                {narrator.rank_ibn_hajar_raw}
              </span>{' '}
              {narrator.rank_ibn_hajar_weight !== null ? (
                <span className="m m--bare">{`[${Number(narrator.rank_ibn_hajar_weight).toFixed(2)}]`}</span>
              ) : null}
            </>
          ) : (
            <>Ibn Hajar left no grade. </>
          )}
          {narrator.rank_dhahabi_raw ? (
            <>
              Al-Dhahabi:{' '}
              <span className="ar" dir="rtl">
                {narrator.rank_dhahabi_raw}
              </span>{' '}
              {narrator.rank_dhahabi_weight !== null ? (
                <span className="m m--bare">{`[${Number(narrator.rank_dhahabi_weight).toFixed(2)}]`}</span>
              ) : null}
            </>
          ) : (
            <>Al-Dhahabi left no grade.</>
          )}
        </p>
        <p className="label">The score uses the stricter of the two.</p>

        <h2 className="label">Chains</h2>
        {chains.isLoading ? (
          <p className="label">Reading the chains…</p>
        ) : chains.isError || !chains.data ? (
          <p className="label">The chains could not be loaded. Try again.</p>
        ) : chains.data.length === 0 ? (
          <p className="label">No chain positions name this narrator.</p>
        ) : (
          <>
            <ul>
              {chains.data.map((hadith) => (
                <li key={hadith.hadith_id}>
                  <Link to="/hadiths/$hadithId" params={{ hadithId: String(hadith.hadith_id) }}>
                    <span className="m">{hadith.hadith_num}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Pager
              offset={offset}
              limit={LIMIT}
              count={chains.data.length}
              onPrev={() => navigate({ search: { offset: Math.max(0, offset - LIMIT) } })}
              onNext={() => navigate({ search: { offset: offset + LIMIT } })}
            />
          </>
        )}

        <h2 className="label">Teachers and students</h2>
        {adjacent.isLoading ? (
          <p className="label">Reading the neighbours…</p>
        ) : adjacent.isError || !adjacent.data ? (
          <p className="label">The neighbours could not be loaded. Try again.</p>
        ) : (
          <Table caption="Who they learned from and who learned from them. An adjacency table, never a network graph.">
            <thead>
              <tr>
                <th scope="col">Direction</th>
                <th scope="col">Narrator</th>
              </tr>
            </thead>
            <tbody>
              {learnedFrom.map((row) => (
                <tr
                  key={`from-${row.narrator_id}-${row.display_name}-${row.transmission_word ?? ''}`}
                >
                  <td>
                    <Tag>Learned from</Tag>
                  </td>
                  <td>
                    {row.narrator_id !== null ? (
                      <Link
                        to="/narrators/$narratorId"
                        params={{ narratorId: String(row.narrator_id) }}
                      >
                        <span className="ar" dir="rtl">
                          {row.display_name}
                        </span>
                      </Link>
                    ) : (
                      <span className="ar" dir="rtl">
                        {row.display_name ?? 'unnamed'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {taught.map((row) => (
                <tr
                  key={`to-${row.narrator_id}-${row.display_name}-${row.transmission_word ?? ''}`}
                >
                  <td>
                    <Tag>Taught</Tag>
                  </td>
                  <td>
                    {row.narrator_id !== null ? (
                      <Link
                        to="/narrators/$narratorId"
                        params={{ narratorId: String(row.narrator_id) }}
                      >
                        <span className="ar" dir="rtl">
                          {row.display_name}
                        </span>
                      </Link>
                    ) : (
                      <span className="ar" dir="rtl">
                        {row.display_name ?? 'unnamed'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Rail>
    </article>
  );
}
