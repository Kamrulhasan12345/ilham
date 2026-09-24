import { Badge } from '@/components/ui/badge';
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
import { apiFetchEnvelope } from '../../../lib/apiClient';

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
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>The ranking could not be loaded</EmptyTitle>
          <EmptyDescription>Try again.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Which chains score lowest?</h1>
        <p className="text-muted-foreground">
          Sorted up by chain strength, capped at {LIMIT} — the cap is printed because an ordered
          query recomputes for every row.
          {data.summary !== null ? (
            <> {data.summary.unscored} more hadiths carry no chain and cannot be scored.</>
          ) : null}
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Hadith</TableHead>
            <TableHead>Collection</TableHead>
            <TableHead className="w-32">Strength</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.data.map((row) => (
            <TableRow key={row.hadith_id}>
              <TableCell>
                <Link
                  to="/hadiths/$hadithId"
                  params={{ hadithId: String(row.hadith_id) }}
                  className="hover:underline"
                >
                  <span className="font-mono tabular-nums">{row.hadith_num}</span>
                </Link>
              </TableCell>
              <TableCell>
                <span dir="rtl" lang="ar" className="font-arabic">
                  {row.collection_title}
                </span>
                {row.chapter_title ? (
                  <>
                    {' '}
                    <span dir="rtl" lang="ar" className="font-arabic">
                      {row.chapter_title}
                    </span>
                  </>
                ) : null}
              </TableCell>
              <TableCell>
                {row.chain_strength === null ? (
                  <span className="text-muted-foreground">no chain</span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {row.chain_strength >= 0.8
                        ? 'strong'
                        : row.chain_strength >= 0.5
                          ? 'mixed'
                          : 'weak'}
                    </Badge>
                    <span className="font-mono tabular-nums">
                      {Number(row.chain_strength).toFixed(2)}
                    </span>
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
