import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { apiFetch } from '../../../lib/apiClient';
import { Pager } from '../../../ui/Pager';

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

const hadithRowSchema = z.object({
  hadith_id: z.number(),
  hadith_num: z.string(),
  text_plain: z.string(),
  sanad_count: z.number(),
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

  const chapters = useQuery({
    queryKey: ['chapters', { collectionId }],
    queryFn: () => apiFetch(`/chapters?collection_id=${collectionId}&limit=100`, chaptersSchema),
    enabled: collectionId !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const chapterId = chapters.data?.find((ch) => ch.seq === Number(seq))?.chapter_id;

  const hadiths = useQuery({
    queryKey: ['hadiths', { chapterId, limit: LIMIT, offset }],
    queryFn: () =>
      apiFetch(
        `/hadiths?chapter_id=${chapterId}&limit=${LIMIT}&offset=${offset}`,
        hadithListSchema,
      ),
    enabled: chapterId !== undefined,
  });

  if (collections.isLoading) return <p>Loading…</p>;
  if (collections.isError) return <p>The collection could not be loaded. Try again.</p>;
  if (collectionId === undefined) return <p>This collection could not be found.</p>;
  if (chapters.isLoading) return <p>Loading the chapter…</p>;
  if (chapters.isError) return <p>The chapter could not be loaded. Try again.</p>;
  if (chapterId === undefined) return <p>This chapter could not be found.</p>;
  if (hadiths.isLoading) return <p>Loading hadiths…</p>;
  if (hadiths.isError || !hadiths.data)
    return <p>The hadith list could not be loaded. Try again.</p>;

  const data = hadiths.data;
  if (data.length === 0 && offset === 0) return <p>This chapter has no hadiths yet.</p>;

  return (
    <div>
      <h1>Hadiths</h1>
      <ul>
        {data.map((hadith) => (
          <li key={hadith.hadith_id}>
            <Link to="/hadiths/$hadithId" params={{ hadithId: String(hadith.hadith_id) }}>
              <span className="m">{hadith.hadith_num}</span>
              <span className="ar" dir="rtl">
                {hadith.text_plain.slice(0, 80)}…
              </span>
            </Link>
          </li>
        ))}
      </ul>
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
