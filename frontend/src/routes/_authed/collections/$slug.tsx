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
  const collectionId = collections.data?.find((c) => c.slug === slug)?.collection_id;

  const chapters = useQuery({
    queryKey: ['chapters', { collectionId, limit: LIMIT, offset }],
    queryFn: () =>
      apiFetch(
        `/chapters?collection_id=${collectionId}&limit=${LIMIT}&offset=${offset}`,
        chaptersSchema,
      ),
    enabled: collectionId !== undefined,
  });

  if (collections.isLoading) return <p>Loading…</p>;
  if (collections.isError) return <p>The collection could not be loaded. Try again.</p>;
  if (collectionId === undefined) return <p>This collection could not be found.</p>;
  if (chapters.isLoading) return <p>Loading chapters…</p>;
  if (chapters.isError || !chapters.data)
    return <p>The chapters could not be loaded. Try again.</p>;

  const data = chapters.data;
  if (data.length === 0 && offset === 0) return <p>This collection has no chapters yet.</p>;

  return (
    <div>
      <h1>Chapters</h1>
      <ul>
        {data.map((chapter) => (
          <li key={chapter.chapter_id}>
            <Link to="/collections/$slug/$seq" params={{ slug, seq: String(chapter.seq) }}>
              <span className="m">{chapter.seq}</span>
              <span className="ar" dir="rtl">
                {chapter.title_ar}
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
