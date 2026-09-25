import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { z } from 'zod';
import { PageHeader } from '../../../app/PageHeader';
import { Pager } from '../../../app/Pager';
import { apiFetch } from '../../../lib/apiClient';
import { useCollections } from '../../../lib/corpus';

const chaptersSchema = z.array(
  z.object({
    chapter_id: z.number(),
    collection_id: z.number(),
    seq: z.number(),
    title_ar: z.string(),
  }),
);

const searchSchema = z.object({ offset: z.number().catch(0) });
const LIMIT = 50;

export const Route = createFileRoute('/_authed/collections/$slug')({
  validateSearch: searchSchema,
  component: ChaptersPage,
});

function Message({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {children ? <EmptyDescription>{children}</EmptyDescription> : null}
      </EmptyHeader>
    </Empty>
  );
}

function ChaptersPage() {
  const { slug } = Route.useParams();
  const { offset } = Route.useSearch();
  const navigate = Route.useNavigate();

  const collections = useCollections();
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

  const header = (
    <PageHeader
      crumbs={[
        { label: 'Collections', href: '/collections' },
        { label: collection?.title_en ?? collection?.title_ar ?? slug },
      ]}
      title={collection?.title_en ?? collection?.title_ar ?? 'Chapters'}
      description={
        collection?.title_en ? (
          <span dir="rtl" lang="ar" className="font-arabic text-lg">
            {collection.title_ar}
          </span>
        ) : undefined
      }
    />
  );

  let body: React.ReactNode;
  if (collections.isLoading || chapters.isLoading) {
    body = (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((n) => (
          <Skeleton key={n} className="h-14 w-full" />
        ))}
      </div>
    );
  } else if (collections.isError) {
    body = <Message title="The collection could not be loaded">Try again.</Message>;
  } else if (collectionId === undefined) {
    body = (
      <Message title="No such collection">
        <Link to="/collections" className="underline">
          Return to the collections.
        </Link>
      </Message>
    );
  } else if (chapters.isError || !chapters.data) {
    body = <Message title="The chapters could not be loaded">Try again.</Message>;
  } else if (chapters.data.length === 0 && offset === 0) {
    body = (
      <Message title="This collection has no chapters yet">
        The collection stands empty in the corpus.
      </Message>
    );
  } else {
    const data = chapters.data;
    body = (
      <Card>
        <CardContent className="flex flex-col gap-4">
          <ItemGroup className="gap-1">
            {data.map((chapter) => (
              <Item key={chapter.chapter_id} size="sm" asChild>
                <Link to="/collections/$slug/$seq" params={{ slug, seq: String(chapter.seq) }}>
                  <ItemMedia className="size-9 rounded-lg bg-muted text-sm font-medium tabular-nums">
                    {chapter.seq}
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle
                      dir="rtl"
                      lang="ar"
                      className="w-full font-arabic text-lg font-normal"
                    >
                      {chapter.title_ar}
                    </ItemTitle>
                  </ItemContent>
                  <ItemActions>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </ItemActions>
                </Link>
              </Item>
            ))}
          </ItemGroup>
          <Pager
            offset={offset}
            count={data.length}
            limit={LIMIT}
            onOffset={(next) => navigate({ search: { offset: next } })}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {header}
      {body}
    </div>
  );
}
