import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { HadithList } from '../../../domain/HadithList';
import { State } from '../../../domain/State';
import { apiFetch } from '../../../lib/apiClient';
import { Pager } from '../../../ui/Pager';

const collectionSchema = z.object({
  collection_id: z.number(),
  slug: z.string(),
  title_ar: z.string(),
  title_en: z.string().nullable(),
  hadith_count: z.coerce.number().optional(),
});
const collectionsSchema = z.array(collectionSchema);

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

  const collections = useQuery({
    queryKey: ['collections'],
    queryFn: () => apiFetch('/collections', collectionsSchema),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const collectionId = collections.data?.find((c) => c.slug === slug)?.collection_id;
  const collection = collections.data?.find((c) => c.slug === slug);

  const chapters = useQuery({
    queryKey: ['chapters', { collectionId }],
    queryFn: () => apiFetch(`/chapters?collection_id=${collectionId}&limit=100`, chaptersSchema),
    enabled: collectionId !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const chapter = chapters.data?.find((ch) => ch.seq === Number(seq));
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

  if (collections.isLoading) {
    return (
      <State title="Loading" quiet>
        <p>Reading the collection.</p>
      </State>
    );
  }
  if (collections.isError) {
    return (
      <State title="The collection could not be loaded">
        <p>Try again.</p>
      </State>
    );
  }
  if (collectionId === undefined) {
    return (
      <State title="No such collection">
        <p>
          <Link to="/collections">Return to the collections.</Link>
        </p>
      </State>
    );
  }
  if (chapters.isLoading) {
    return (
      <State title="Loading the chapter" quiet>
        <p>Reading its hadiths.</p>
      </State>
    );
  }
  if (chapters.isError) {
    return (
      <State title="The chapter could not be loaded">
        <p>Try again.</p>
      </State>
    );
  }
  if (chapterId === undefined) {
    return (
      <State title="No such chapter">
        <p>
          <Link to="/collections/$slug" params={{ slug }}>
            Return to {collection?.title_en ?? collection?.title_ar ?? 'the collection'}.
          </Link>
        </p>
      </State>
    );
  }
  if (hadiths.isLoading) {
    return (
      <State title="Loading hadiths" quiet>
        <p>Reading the chapter.</p>
      </State>
    );
  }
  if (hadiths.isError || !hadiths.data) {
    return (
      <State title="The hadith list could not be loaded">
        <p>Try again.</p>
      </State>
    );
  }

  const data = hadiths.data;
  if (data.length === 0 && offset === 0) {
    return (
      <State title="This chapter has no hadiths yet" quiet>
        <p>The chapter stands empty in the corpus.</p>
      </State>
    );
  }

  return (
    <div>
      <h1>
        <span className="ar" dir="rtl">
          {chapter?.title_ar}
        </span>{' '}
        <span className="m m--bare">{`[chapter ${chapter?.seq}]`}</span>
      </h1>
      <HadithList
        items={data.map((hadith) => ({
          hadith_id: hadith.hadith_id,
          hadith_num: hadith.hadith_num,
          text_plain: hadith.text_plain,
          chain_strength: hadith.chain_strength === null ? null : Number(hadith.chain_strength),
        }))}
      />
      <Pager
        offset={offset}
        limit={LIMIT}
        count={data.length}
        onPrev={() => navigate({ search: { offset: Math.max(0, offset - LIMIT) } })}
        onNext={() => navigate({ search: { offset: offset + LIMIT } })}
      />
    </div>
  );
}
