import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { PageHeader } from '../../../app/PageHeader';
import { Pager } from '../../../app/Pager';
import { HadithList } from '../../../domain/HadithList';
import { apiFetch } from '../../../lib/apiClient';
import { useCollections } from '../../../lib/corpus';

const chapterSchema = z.object({
  chapter_id: z.number(),
  collection_id: z.number(),
  seq: z.number(),
  title_ar: z.string(),
});
const chaptersSchema = z.array(chapterSchema);

const hadithRowSchema = z.object({
  hadith_id: z.number(),
  hadith_num: z.string(),
  text_plain: z.string(),
  text_en: z.string().nullable(),
  sanad_count: z.number(),
  chain_strength: z.coerce.number().nullable(),
});
const hadithListSchema = z.array(hadithRowSchema);

const searchSchema = z.object({ offset: z.number().catch(0) });
const LIMIT = 50;

export const Route = createFileRoute('/_authed/collections/$slug_/$seq')({
  validateSearch: searchSchema,
  component: HadithsInChapterPage,
});

function HadithsInChapterPage() {
  const { slug, seq } = Route.useParams();
  const { offset } = Route.useSearch();
  const navigate = Route.useNavigate();

  const collections = useCollections();
  const collectionId = collections.data?.find((c) => c.slug === slug)?.collection_id;
  const collection = collections.data?.find((c) => c.slug === slug);

  const chapters = useQuery({
    queryKey: ['chapters', { collectionId, seq }],
    queryFn: () => apiFetch(`/chapters?collection_id=${collectionId}&seq=${seq}`, chaptersSchema),
    enabled: collectionId !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const chapter = chapters.data?.[0];
  const chapterId = chapter?.chapter_id;

  const hadiths = useQuery({
    queryKey: ['hadiths', { chapterId, limit: LIMIT, offset }],
    queryFn: () =>
      apiFetch(
        `/hadiths?chapter_id=${chapterId}&limit=${LIMIT}&offset=${offset}`,
        hadithListSchema,
      ),
    enabled: chapterId !== undefined,
  });

  const collectionTitle = collection?.title_en ?? collection?.title_ar;
  const header = (
    <PageHeader
      crumbs={[
        { label: 'Collections', href: '/collections' },
        { label: collectionTitle ?? slug, href: `/collections/${slug}` },
        { label: `Chapter ${seq}` },
      ]}
      title={
        chapter ? (
          <span dir="rtl" lang="ar" className="font-arabic font-normal">
            {chapter.title_ar}
          </span>
        ) : (
          `Chapter ${seq}`
        )
      }
      description={collectionTitle ? `Chapter ${seq} of ${collectionTitle}` : undefined}
    />
  );

  const message = (title: string, description: React.ReactNode) => (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );

  let body: React.ReactNode;
  if (collections.isLoading || chapters.isLoading || hadiths.isLoading) {
    body = (
      <div className="flex flex-col gap-4">
        {[0, 1, 2].map((n) => (
          <Skeleton key={n} className="h-36 w-full rounded-xl" />
        ))}
      </div>
    );
  } else if (collections.isError) {
    body = message('The collection could not be loaded', 'Try again.');
  } else if (collectionId === undefined) {
    body = message(
      'No such collection',
      <Link to="/collections" className="underline">
        Return to the collections.
      </Link>,
    );
  } else if (chapters.isError) {
    body = message('The chapter could not be loaded', 'Try again.');
  } else if (chapterId === undefined) {
    body = message(
      'No such chapter',
      <Link to="/collections/$slug" params={{ slug }} className="underline">
        Return to {collectionTitle ?? 'the collection'}.
      </Link>,
    );
  } else if (hadiths.isError || !hadiths.data) {
    body = message('The hadith list could not be loaded', 'Try again.');
  } else if (hadiths.data.length === 0 && offset === 0) {
    body = message('This chapter has no hadiths yet', 'The chapter stands empty in the corpus.');
  } else {
    const data = hadiths.data;
    body = (
      <>
        <HadithList
          items={data.map((hadith) => ({
            hadith_id: hadith.hadith_id,
            hadith_num: hadith.hadith_num,
            text_plain: hadith.text_plain,
            text_en: hadith.text_en,
            chain_strength: hadith.chain_strength === null ? null : Number(hadith.chain_strength),
          }))}
        />
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
