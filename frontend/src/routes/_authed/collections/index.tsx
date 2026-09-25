import { Card } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Link, createFileRoute } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { PageHeader } from '../../../app/PageHeader';
import { GeoPattern } from '../../../app/Showcase';
import { useCollections } from '../../../lib/corpus';

export const Route = createFileRoute('/_authed/collections/')({
  component: CollectionsPage,
});

function CollectionsPage() {
  const { data, isLoading, isError } = useCollections();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Collections"
        description="The canonical collections, browsed by chapter. The corpus is read-only."
      />

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[0, 1].map((n) => (
            <Skeleton key={n} className="h-64 rounded-xl" />
          ))}
        </div>
      ) : isError || !data ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>The collections could not be loaded</EmptyTitle>
            <EmptyDescription>Try again.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : data.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No collections are loaded yet</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {data.map((collection) => (
            <Card
              key={collection.collection_id}
              className="gap-0 p-0 transition-shadow hover:shadow-lg"
            >
              <Link
                to="/collections/$slug"
                params={{ slug: collection.slug }}
                className="flex flex-col hover:no-underline"
              >
                <div className="relative flex h-44 items-end justify-end overflow-hidden bg-primary p-6 text-primary-foreground">
                  <GeoPattern className="text-primary-foreground/15 [mask-image:linear-gradient(to_top_left,transparent_20%,black)]" />
                  <span dir="rtl" lang="ar" className="relative font-arabic text-4xl leading-loose">
                    {collection.title_ar}
                  </span>
                </div>
                <div className="flex items-center gap-4 p-6">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {collection.title_en ? (
                      <p className="font-heading text-lg font-semibold">{collection.title_en}</p>
                    ) : null}
                    <p className="text-sm text-muted-foreground">
                      {collection.hadith_count.toLocaleString('en')} hadiths
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-sm font-medium text-primary">
                    Browse chapters
                    <ChevronRight className="size-4" />
                  </span>
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
