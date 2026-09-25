import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { PageHeader } from '../../../app/PageHeader';
import { Pager } from '../../../app/Pager';
import { AddToSet } from '../../../domain/AddToSet/AddToSet';
import { HadithList } from '../../../domain/HadithList';
import { apiFetch } from '../../../lib/apiClient';
import { hadithListSchema, plural, titleOf, useKitabByNum } from '../../../lib/corpus';

const searchSchema = z.object({ offset: z.number().catch(0) });
const LIMIT = 50;

export const Route = createFileRoute('/_authed/collections/$slug_/$kitab_/$bab')({
  validateSearch: searchSchema,
  component: BabPage,
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

/** One bab (chapter) of a kitab: its hadiths. The URL uses the bab's page
    position in the kitab, because printed bab numbers repeat in Tafseer. */
function BabPage() {
  const { slug, kitab: kitabNum, bab: babSeq } = Route.useParams();
  const { offset } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { collection, kitab, isLoading, isError, notFound } = useKitabByNum(slug, kitabNum);
  const bab = kitab?.babs.find((b) => String(b.seq) === babSeq);
  const babId = bab?.bab_id;

  const hadiths = useQuery({
    queryKey: ['hadiths', { babId, limit: LIMIT, offset }],
    queryFn: () =>
      apiFetch(`/hadiths?bab_id=${babId}&limit=${LIMIT}&offset=${offset}`, hadithListSchema),
    enabled: babId !== undefined,
  });

  const collectionTitle = collection?.title_en ?? collection?.title_ar ?? slug;
  const babLabel = bab?.bab_num ? `Chapter ${bab.bab_num}` : 'Chapter';
  const header = (
    <PageHeader
      crumbs={[
        { label: 'Collections', href: '/collections' },
        { label: collectionTitle, href: `/collections/${slug}` },
        { label: kitab?.title_en ?? `Book ${kitabNum}`, href: `/collections/${slug}/${kitabNum}` },
        { label: babLabel },
      ]}
      title={bab ? titleOf(bab) : babLabel}
      description={
        bab && titleOf(bab) !== bab.title_ar ? (
          <span dir="rtl" lang="ar" className="font-arabic text-lg">
            {bab.title_ar}
          </span>
        ) : undefined
      }
    />
  );

  let body: React.ReactNode;
  if (isLoading || hadiths.isLoading) {
    body = (
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((n) => (
          <Skeleton key={n} className="h-36 w-full rounded-xl" />
        ))}
      </div>
    );
  } else if (isError) {
    body = message('The chapter could not be loaded', 'Try again.');
  } else if (notFound || !kitab || !bab) {
    body = message(
      'No such chapter',
      <Link to="/collections/$slug" params={{ slug }} className="underline">
        Return to {collectionTitle}.
      </Link>,
    );
  } else if (hadiths.isError || !hadiths.data) {
    body = message('The hadith list could not be loaded', 'Try again.');
  } else if (hadiths.data.length === 0 && offset === 0) {
    body = message(
      'This chapter has no hadiths in the corpus',
      'The book gives this chapter a heading only, or its hadiths are not in this corpus.',
    );
  } else {
    const data = hadiths.data;
    body = (
      <>
        <Card>
          <CardContent>
            <AddToSet
              target={{ bab_id: bab.bab_id }}
              label={`Add all ${bab.hadith_count} ${plural(bab.hadith_count, 'hadith')} of this chapter to a study set`}
            />
          </CardContent>
        </Card>
        <HadithList items={data} />
        <Pager
          offset={offset}
          count={data.length}
          limit={LIMIT}
          onOffset={(next) => navigate({ search: { offset: next } })}
        />
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
