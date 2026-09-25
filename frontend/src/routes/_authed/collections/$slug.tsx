import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { Skeleton } from '@/components/ui/skeleton';
import { Link, createFileRoute } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { PageHeader } from '../../../app/PageHeader';
import { useCollections, useKitabs } from '../../../lib/corpus';

export const Route = createFileRoute('/_authed/collections/$slug')({
  component: KitabsPage,
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

/** A collection's kitabs (books), in the order of the printed edition. */
function KitabsPage() {
  const { slug } = Route.useParams();
  const collections = useCollections();
  const collection = collections.data?.find((c) => c.slug === slug);
  const kitabs = useKitabs(collection?.collection_id);

  const header = (
    <PageHeader
      crumbs={[
        { label: 'Collections', href: '/collections' },
        { label: collection?.title_en ?? collection?.title_ar ?? slug },
      ]}
      title={collection?.title_en ?? collection?.title_ar ?? 'Books'}
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
  if (collections.isLoading || kitabs.isLoading) {
    body = (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((n) => (
          <Skeleton key={n} className="h-14 w-full" />
        ))}
      </div>
    );
  } else if (collections.isError) {
    body = <Message title="The collection could not be loaded">Try again.</Message>;
  } else if (!collection) {
    body = (
      <Message title="No such collection">
        <Link to="/collections" className="underline">
          Return to the collections.
        </Link>
      </Message>
    );
  } else if (kitabs.isError || !kitabs.data) {
    body = <Message title="The books could not be loaded">Try again.</Message>;
  } else if (kitabs.data.length === 0) {
    body = (
      <Message title="This collection has no books yet">
        The collection stands empty in the corpus.
      </Message>
    );
  } else {
    body = (
      <Card>
        <CardContent>
          <ItemGroup className="gap-1">
            {kitabs.data.map((kitab) => (
              <Item key={kitab.kitab_id} size="sm" asChild>
                <Link
                  to="/collections/$slug/$kitab"
                  params={{ slug, kitab: String(kitab.kitab_num) }}
                >
                  <ItemMedia className="size-9 rounded-lg bg-muted text-sm font-medium tabular-nums">
                    {kitab.kitab_num}
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{kitab.title_en}</ItemTitle>
                    <ItemDescription>
                      {kitab.bab_count} chapters · {kitab.hadith_count} hadiths
                    </ItemDescription>
                  </ItemContent>
                  <span dir="rtl" lang="ar" className="hidden font-arabic text-lg sm:block">
                    {kitab.title_ar}
                  </span>
                  <ItemActions>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </ItemActions>
                </Link>
              </Item>
            ))}
          </ItemGroup>
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
