import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { State } from '../../../domain/State';
import { apiFetchEnvelope } from '../../../lib/apiClient';
import { Table } from '../../../ui/Table';

const weakestSchema = z.array(
  z.object({
    hadith_id: z.number(),
    hadith_num: z.string(),
    chain_strength: z.coerce.number().nullable(),
    collection_title: z.string(),
    chapter_title: z.string().nullable(),
  }),
);
const summarySchema = z.object({ unscored: z.coerce.number() });

export const Route = createFileRoute('/_authed/analytics/weakest-chains')({
  component: WeakestChainsPage,
});

const LIMIT = 50;

function WeakestChainsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics', 'weakest-chains'],
    queryFn: () =>
      apiFetchEnvelope(`/analytics/weakest-chains?limit=${LIMIT}`, weakestSchema, summarySchema),
    staleTime: Number.POSITIVE_INFINITY,
  });

  if (isLoading) {
    return (
      <State title="Scoring every chain" quiet>
        <p>An ordered query recomputes every row. It takes a moment.</p>
      </State>
    );
  }
  if (isError || !data) {
    return (
      <State title="The ranking could not be loaded">
        <p>Try again.</p>
      </State>
    );
  }

  return (
    <div>
      <h1>Which chains score lowest?</h1>
      <p className="label">
        Sorted up by chain strength, capped at {LIMIT} — the cap is printed because an ordered query
        recomputes for every row.
        {data.summary !== null ? (
          <> {data.summary.unscored} more hadiths carry no chain and cannot be scored.</>
        ) : null}
      </p>
      <Table
        caption={`The ${LIMIT} lowest-scoring chains. A word first, the number second — never a bare number.`}
      >
        <thead>
          <tr>
            <th scope="col">Hadith</th>
            <th scope="col">Collection</th>
            <th scope="col">Strength</th>
          </tr>
        </thead>
        <tbody>
          {data.data.map((row) => (
            <tr key={row.hadith_id}>
              <td>
                <Link to="/hadiths/$hadithId" params={{ hadithId: String(row.hadith_id) }}>
                  <span className="m">{row.hadith_num}</span>
                </Link>
              </td>
              <td>
                <span className="ar" dir="rtl">
                  {row.collection_title}
                </span>
                {row.chapter_title ? (
                  <>
                    {' '}
                    <span className="ar" dir="rtl">
                      {row.chapter_title}
                    </span>
                  </>
                ) : null}
              </td>
              <td>
                {row.chain_strength === null ? (
                  'no chain'
                ) : (
                  <>
                    {row.chain_strength >= 0.8
                      ? 'strong'
                      : row.chain_strength >= 0.5
                        ? 'mixed'
                        : 'weak'}{' '}
                    <span className="m m--bare">{`[${Number(row.chain_strength).toFixed(2)}]`}</span>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
