import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { apiFetch } from '../../../lib/apiClient';
import { Card } from '../../../ui/Card';
import { PageHeader } from '../../../ui/PageHeader';
import styles from './index.module.css';

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

  if (isLoading) return <p>Loading the collections…</p>;
  if (isError || !data) return <p>The collections could not be loaded. Try again.</p>;
  if (data.length === 0) return <p>No collections are loaded yet.</p>;

  return (
    <div>
      <PageHeader title="Collections" />
      <div>
        {data.map((collection) => (
          <Card key={collection.collection_id} className={styles.row}>
            <Link
              to="/collections/$slug"
              params={{ slug: collection.slug }}
              className={styles.link}
            >
              <span className={styles.titleEn}>{collection.title_en ?? collection.title_ar}</span>
              {collection.title_en ? (
                <span className={`ar ${styles.titleAr}`} dir="rtl">
                  {collection.title_ar}
                </span>
              ) : null}
            </Link>
            <span className={`m m--bare ${styles.count}`}>{`[${collection.hadith_count} hadiths]`}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}
