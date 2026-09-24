import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { ArrowRight, BookOpen } from 'lucide-react';
import { z } from 'zod';
import { apiFetch } from '../../../lib/apiClient';

const collectionSchema = z.object({
  collection_id: z.number(),
  slug: z.string(),
  title_ar: z.string(),
  title_en: z.string().nullable(),
  hadith_count: z.coerce.number(),
});
const collectionsSchema = z.array(collectionSchema);

export const Route = createFileRoute('/_authed/collections/')({
  component: CollectionsPage,
});

function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: () => apiFetch('/collections', collectionsSchema),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

function CollectionsPage() {
  const { data, isLoading, isError } = useCollections();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <BookOpen className="size-6" />
          Collections
        </h1>
        <p className="text-muted-foreground">Two canonical collections, read-only as always.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((n) => (
            <Card key={n}>
              <CardHeader>
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : isError || !data ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>The collections could not be loaded</EmptyTitle>
            <EmptyDescription>Try again.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : data.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No collections are loaded yet</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((collection) => (
            <Card key={collection.collection_id}>
              <CardHeader>
                <CardTitle>
                  <Link
                    to="/collections/$slug"
                    params={{ slug: collection.slug }}
                    className="hover:underline"
                  >
                    <span>{collection.title_en ?? collection.title_ar}</span>
                    {collection.title_en ? (
                      <span dir="rtl" lang="ar" className="font-arabic">
                        {' '}
                        {collection.title_ar}
                      </span>
                    ) : null}
                  </Link>
                </CardTitle>
                <CardDescription>{collection.hadith_count} hadiths</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/collections/$slug" params={{ slug: collection.slug }}>
                    Browse chapters <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
