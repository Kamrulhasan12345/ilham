import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
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
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { z } from 'zod';
import { apiFetch } from '../../../lib/apiClient';

const collectionSchema = z.object({
  collection_id: z.number(),
  slug: z.string(),
  title_ar: z.string(),
  title_en: z.string().nullable(),
});
const collectionsSchema = z.array(collectionSchema);

const chapterSchema = z.object({
  chapter_id: z.number(),
  collection_id: z.number(),
  seq: z.number(),
  title_ar: z.string(),
});
const chaptersSchema = z.array(chapterSchema);

const searchSchema = z.object({ offset: z.number().catch(0) });
const LIMIT = 50;

export const Route = createFileRoute('/_authed/collections/$slug')({
  validateSearch: searchSchema,
  component: ChaptersPage,
});

function ChaptersPage() {
  const { slug } = Route.useParams();
  const { offset } = Route.useSearch();
  const navigate = Route.useNavigate();

  const collections = useQuery({
    queryKey: ['collections'],
    queryFn: () => apiFetch('/collections', collectionsSchema),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const collection = collections.data?.find((c) => c.slug === slug);
  const collectionId = collection?.collection_id;

  const chapters = useQuery({
    queryKey: ['chapters', { collectionId, limit: LIMIT, offset }],
    queryFn: () =>
      apiFetch(
        `/chapters?collection_id=${collectionId}&limit=${LIMIT}&offset=${offset}`,
        chaptersSchema,
      ),
    enabled: collectionId !== undefined,
  });

  if (collections.isLoading || chapters.isLoading) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{collections.isLoading ? 'Loading' : 'Loading chapters'}</EmptyTitle>
          <EmptyDescription>
            {collections.isLoading ? 'Reading the collection.' : 'Reading the chapter list.'}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  if (collections.isError) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>The collection could not be loaded</EmptyTitle>
          <EmptyDescription>Try again.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  if (collectionId === undefined) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No such collection</EmptyTitle>
          <EmptyDescription>
            <Link to="/collections" className="underline">
              Return to the collections.
            </Link>
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  if (chapters.isError || !chapters.data) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>The chapters could not be loaded</EmptyTitle>
          <EmptyDescription>Try again.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const data = chapters.data;
  if (data.length === 0 && offset === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>This collection has no chapters yet</EmptyTitle>
          <EmptyDescription>The collection stands empty in the corpus.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/collections">Collections</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{collection?.title_en ?? collection?.title_ar}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div>
        <h1 className="text-2xl font-semibold">
          {collection?.title_en ?? collection?.title_ar ?? 'Chapters'}
        </h1>
        {collection?.title_en ? (
          <p dir="rtl" lang="ar" className="font-arabic text-muted-foreground">
            {collection.title_ar}
          </p>
        ) : null}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">Chapter</TableHead>
            <TableHead>Title</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((chapter) => (
            <TableRow key={chapter.chapter_id}>
              <TableCell className="font-mono tabular-nums">{chapter.seq}</TableCell>
              <TableCell>
                <Link
                  to="/collections/$slug/$seq"
                  params={{ slug, seq: String(chapter.seq) }}
                  className="underline-offset-4 hover:underline"
                >
                  <span dir="rtl" lang="ar" className="font-arabic">
                    {chapter.title_ar}
                  </span>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Showing {offset + 1}–{offset + data.length}
        </span>
        <span className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          disabled={offset === 0}
          onClick={() => navigate({ search: { offset: Math.max(0, offset - LIMIT) } })}
        >
          <ChevronLeft data-icon="inline-start" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={data.length < LIMIT}
          onClick={() => navigate({ search: { offset: offset + LIMIT } })}
        >
          Next
          <ChevronRight data-icon="inline-end" />
        </Button>
      </div>
    </div>
  );
}
