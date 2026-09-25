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
import { Dumbbell } from '../../../domain/Dumbbell';
import { apiFetch } from '../../../lib/apiClient';

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
          <EmptyTitle>The comparison could not be loaded</EmptyTitle>
          <EmptyDescription>Try again.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const rows = [...data].sort(
    (a, b) =>
      Math.abs(b.ordinal_ibn_hajar - b.ordinal_dhahabi) -
      Math.abs(a.ordinal_ibn_hajar - a.ordinal_dhahabi),
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumbs={[{ label: 'Analytics', href: '/analytics' }]}
        title="Where do the two scholars disagree?"
        description={`Sorted by the gap, which runs 1 to 5. The first ${LIMIT} contested narrators: a cap, printed because a silent top-N reads as everyone.`}
      />
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Ibn Hajar against al-Dhahabi</h2>
          </CardTitle>
          <CardDescription>Each row joins the two grades on the six-grade axis</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Grades side by side</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Narrator</TableHead>
                <TableHead>Ibn Hajar</TableHead>
                <TableHead>Al-Dhahabi</TableHead>
                <TableHead className="w-20">Gap</TableHead>
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
                  <TableCell>
                    <span dir="rtl" lang="ar" className="font-arabic">
                      {row.label_ibn_hajar}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span dir="rtl" lang="ar" className="font-arabic">
                      {row.label_dhahabi}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono tabular-nums">
                    {Math.abs(row.ordinal_ibn_hajar - row.ordinal_dhahabi)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
