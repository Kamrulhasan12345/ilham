import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { apiFetch } from '../../../lib/apiClient';

const collectionSchema = z.object({
  collection_id: z.number(),
  slug: z.string(),
  title_ar: z.string(),
  title_en: z.string().nullable(),
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

  if (isLoading) return <p>Loading the collections…</p>;
  if (isError || !data) return <p>The collections could not be loaded. Try again.</p>;
  if (data.length === 0) return <p>No collections are loaded yet.</p>;

  return (
    <div>
      <h1>Collections</h1>
      <ul>
        {data.map((collection) => (
          <li key={collection.collection_id}>
            <Link to="/collections/$slug" params={{ slug: collection.slug }}>
              <span className="ar" dir="rtl">
                {collection.title_ar}
              </span>
              {collection.title_en ? <span> — {collection.title_en}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
