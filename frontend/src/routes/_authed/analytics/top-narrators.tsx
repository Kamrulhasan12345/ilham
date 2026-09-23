import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { Bars } from '../../../domain/Bars';
import { State } from '../../../domain/State';
import { apiFetchEnvelope } from '../../../lib/apiClient';
import { Table } from '../../../ui/Table';

const topNarratorSchema = z.object({
  narrator_id: z.number(),
  display_name: z.string(),
  positions: z.coerce.number(),
});
const summarySchema = z.object({
  total_positions: z.coerce.number(),
  top_count: z.coerce.number(),
  top_share: z.coerce.number(),
});

export const Route = createFileRoute('/_authed/analytics/top-narrators')({
  component: TopNarratorsPage,
});

const LIMIT = 15;

function TopNarratorsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics', 'top-narrators'],
    queryFn: () =>
      apiFetchEnvelope(
        `/analytics/top-narrators?limit=${LIMIT}`,
        z.array(topNarratorSchema),
        summarySchema,
      ),
    staleTime: Number.POSITIVE_INFINITY,
  });

  if (isLoading) {
    return (
      <State title="Counting positions" quiet>
        <p>Reading every chain position in the corpus.</p>
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

  const rows = data.data;
  const summary = data.summary;

  return (
    <div>
      <h1>Who carries the corpus?</h1>
      <p className="label">
        The {LIMIT} narrators behind the most chain positions. A silent top-N reads as “this is
        everyone” — it is not.
        {summary !== null ? (
          <>
            {' '}
            {summary.top_count} narrators hold {(summary.top_share * 100).toFixed(1)}% of all{' '}
            {summary.total_positions} positions.
          </>
        ) : null}
      </p>
      <Bars
        rows={rows.map((row) => ({
          key: row.narrator_id,
          name: row.display_name,
          value: row.positions,
        }))}
        label={`Horizontal bars of the top ${LIMIT} narrators by chain positions`}
      />
      <Table
        caption={`The top ${LIMIT} narrators by chain positions, with counts. The chart above is the summary; this table is the source of truth.`}
      >
        <thead>
          <tr>
            <th scope="col">Narrator</th>
            <th scope="col">Positions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.narrator_id}>
              <td>
                <Link to="/narrators/$narratorId" params={{ narratorId: String(row.narrator_id) }}>
                  <span className="ar" dir="rtl">
                    {row.display_name}
                  </span>
                </Link>
              </td>
              <td className="m m--bare">{`[${row.positions}]`}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
