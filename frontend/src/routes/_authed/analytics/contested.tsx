import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { Dumbbell } from '../../../domain/Dumbbell';
import { State } from '../../../domain/State';
import { apiFetch } from '../../../lib/apiClient';
import { Table } from '../../../ui/Table';

const contestedSchema = z.array(
  z.object({
    narrator_id: z.number(),
    display_name: z.string(),
    rank_ibn_hajar: z.string(),
    ordinal_ibn_hajar: z.coerce.number(),
    label_ibn_hajar: z.string(),
    rank_dhahabi: z.string(),
    ordinal_dhahabi: z.coerce.number(),
    label_dhahabi: z.string(),
  }),
);

export const Route = createFileRoute('/_authed/analytics/contested')({
  component: ContestedPage,
});

const LIMIT = 50;

function ContestedPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['analytics', 'contested'],
    queryFn: () => apiFetch(`/analytics/contested-narrators?limit=${LIMIT}`, contestedSchema),
    staleTime: Number.POSITIVE_INFINITY,
  });

  if (isLoading) {
    return (
      <State title="Comparing the scholars" quiet>
        <p>Reading both grade columns.</p>
      </State>
    );
  }
  if (isError || !data) {
    return (
      <State title="The comparison could not be loaded">
        <p>Try again.</p>
      </State>
    );
  }

  const rows = [...data].sort(
    (a, b) =>
      Math.abs(b.ordinal_ibn_hajar - b.ordinal_dhahabi) -
      Math.abs(a.ordinal_ibn_hajar - a.ordinal_dhahabi),
  );

  return (
    <div>
      <h1>Where do the two scholars disagree?</h1>
      <p className="label">
        Sorted by the gap, which runs 1 to 5. The first {LIMIT} contested narrators — a cap, printed
        because a silent top-N reads as everyone.
      </p>
      <Dumbbell
        rows={rows.map((row) => ({
          key: row.narrator_id,
          name: row.display_name,
          ordinalA: row.ordinal_ibn_hajar,
          ordinalB: row.ordinal_dhahabi,
          gap: Math.abs(row.ordinal_ibn_hajar - row.ordinal_dhahabi),
        }))}
        label="Dumbbell chart of contested narrators: Ibn Hajar against al-Dhahabi on the six-grade axis"
      />
      <Table caption="Contested narrators with both grades and the gap. The chart above is the summary; this table is the source of truth.">
        <thead>
          <tr>
            <th scope="col">Narrator</th>
            <th scope="col">Ibn Hajar</th>
            <th scope="col">Al-Dhahabi</th>
            <th scope="col">Gap</th>
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
              <td>
                <span className="ar" dir="rtl">
                  {row.label_ibn_hajar}
                </span>
              </td>
              <td>
                <span className="ar" dir="rtl">
                  {row.label_dhahabi}
                </span>
              </td>
              <td className="m m--bare">{`[${Math.abs(row.ordinal_ibn_hajar - row.ordinal_dhahabi)}]`}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
