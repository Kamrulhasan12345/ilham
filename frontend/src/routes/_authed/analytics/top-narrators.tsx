import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { PageHeader } from '../../../app/PageHeader';
import { Bars } from '../../../domain/Bars';
import { apiFetchEnvelope } from '../../../lib/apiClient';

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
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>The ranking could not be loaded</EmptyTitle>
          <EmptyDescription>Try again.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const rows = data.data;
  const summary = data.summary;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumbs={[{ label: 'Analytics', href: '/analytics' }]}
        title="Who carries the corpus?"
        description={
          <>
            The {LIMIT} narrators behind the most chain positions. A silent top-N reads as “this is
            everyone”, and it is not.
            {summary !== null ? (
              <>
                {' '}
                {summary.top_count} narrators hold {(summary.top_share * 100).toFixed(1)}% of all{' '}
                {summary.total_positions} positions.
              </>
            ) : null}
          </>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Chain positions</h2>
          </CardTitle>
          <CardDescription>One bar per narrator</CardDescription>
        </CardHeader>
        <CardContent>
          <Bars
            rows={rows.map((row) => ({
              key: row.narrator_id,
              name: row.display_name,
              value: row.positions,
            }))}
            label={`Horizontal bars of the top ${LIMIT} narrators by chain positions`}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Ranking</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Narrator</TableHead>
                <TableHead className="w-28">Positions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.narrator_id}>
                  <TableCell>
                    <Link
                      to="/narrators/$narratorId"
                      params={{ narratorId: String(row.narrator_id) }}
                      className="hover:underline"
                    >
                      <span dir="rtl" lang="ar" className="font-arabic">
                        {row.display_name}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">{row.positions}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
