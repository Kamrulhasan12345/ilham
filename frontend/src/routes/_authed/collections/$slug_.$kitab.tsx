import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Fragment } from 'react';
import { PageHeader } from '../../../app/PageHeader';
import { AddToSet } from '../../../domain/AddToSet/AddToSet';
import { HadithList } from '../../../domain/HadithList';
import { apiFetch } from '../../../lib/apiClient';
import { hadithListSchema, plural, titleOf, useKitabByNum } from '../../../lib/corpus';

export const Route = createFileRoute('/_authed/collections/$slug_/$kitab')({
  component: KitabPage,
});

function message(title: string, description: React.ReactNode) {
  return (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/** One kitab: its babs (grouped by surah in Tafseer) and any hadiths the
    book files under the kitab itself, before its first bab. */
function KitabPage() {
  const { slug, kitab: kitabNum } = Route.useParams();
  const { collection, kitab, isLoading, isError, notFound } = useKitabByNum(slug, kitabNum);
  const collectionTitle = collection?.title_en ?? collection?.title_ar ?? slug;

  const kitabLevel = useQuery({
    queryKey: ['hadiths', { kitabId: kitab?.kitab_id, babId: 'none' }],
    queryFn: () =>
      apiFetch(`/hadiths?kitab_id=${kitab?.kitab_id}&bab_id=none&limit=100`, hadithListSchema),
    enabled: (kitab?.kitab_level_count ?? 0) > 0,
  });

  const header = (
    <PageHeader
      crumbs={[
        { label: 'Collections', href: '/collections' },
        { label: collectionTitle, href: `/collections/${slug}` },
        { label: `Book ${kitabNum}` },
      ]}
      title={kitab?.title_en ?? `Book ${kitabNum}`}
      description={
        kitab ? (
          <span dir="rtl" lang="ar" className="font-arabic text-lg">
            {kitab.title_ar}
          </span>
        ) : undefined
      }
    />
  );

  let body: React.ReactNode;
  if (isLoading) {
    body = (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((n) => (
          <Skeleton key={n} className="h-14 w-full" />
        ))}
      </div>
    );
  } else if (isError) {
    body = message('The book could not be loaded', 'Try again.');
  } else if (notFound || !kitab) {
    body = message(
      'No such book',
      <Link to="/collections/$slug" params={{ slug }} className="underline">
        Return to {collectionTitle}.
      </Link>,
    );
  } else {
    body = (
      <>
        <Card>
          <CardContent>
            <AddToSet
              target={{ kitab_id: kitab.kitab_id }}
              label={`Add all ${kitab.hadith_count} ${plural(kitab.hadith_count, 'hadith')} of this book to a study set`}
            />
          </CardContent>
        </Card>
        {kitab.kitab_level_count > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Before the first chapter</h2>
              </CardTitle>
              <CardDescription>
                The book files{' '}
                {kitab.kitab_level_count === 1
                  ? 'this hadith'
                  : `these ${kitab.kitab_level_count} hadiths`}{' '}
                under the book itself.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {kitabLevel.data ? (
                <HadithList items={kitabLevel.data} />
              ) : (
                <Skeleton className="h-24 w-full" />
              )}
            </CardContent>
          </Card>
        ) : null}
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Chapters</h2>
            </CardTitle>
            <CardDescription>{kitab.babs.length} chapters</CardDescription>
          </CardHeader>
          <CardContent>
            <ItemGroup className="gap-1">
              {kitab.babs.map((bab, i) => (
                <Fragment key={bab.bab_id}>
                  {bab.surah_num !== null && bab.surah_num !== kitab.babs[i - 1]?.surah_num ? (
                    <h3 className="mt-4 flex items-baseline justify-between border-b pb-1 font-medium">
                      <span>{bab.surah_title_en}</span>
                      <span dir="rtl" lang="ar" className="font-arabic text-lg font-normal">
                        {bab.surah_title_ar}
                      </span>
                    </h3>
                  ) : null}
                  <Item size="sm" asChild>
                    <Link
                      to="/collections/$slug/$kitab/$bab"
                      params={{ slug, kitab: kitabNum, bab: String(bab.seq) }}
                    >
                      <ItemMedia className="size-9 rounded-lg bg-muted text-sm font-medium tabular-nums">
                        {bab.bab_num ?? '·'}
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle className="font-normal">{titleOf(bab)}</ItemTitle>
                        {titleOf(bab) !== bab.title_ar ? (
                          <span
                            dir="rtl"
                            lang="ar"
                            className="w-full font-arabic text-base text-muted-foreground"
                          >
                            {bab.title_ar}
                          </span>
                        ) : null}
                      </ItemContent>
                      <ItemActions className="text-sm text-muted-foreground tabular-nums">
                        {bab.hadith_count > 0 ? bab.hadith_count : 'no hadiths'}
                        <ChevronRight className="size-4" />
                      </ItemActions>
                    </Link>
                  </Item>
                </Fragment>
              ))}
            </ItemGroup>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {header}
      {body}
    </div>
  );
}
