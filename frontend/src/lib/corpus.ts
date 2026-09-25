import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { apiFetch } from './apiClient';

// One schema for the ['collections'] key: zod strips unknown keys, so a
// narrower schema on another page would cache rows without hadith_count.
export const collectionSchema = z.object({
  collection_id: z.number(),
  slug: z.string(),
  title_ar: z.string(),
  title_en: z.string().nullable(),
  hadith_count: z.coerce.number(),
});
export type Collection = z.infer<typeof collectionSchema>;

export function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: () => apiFetch('/collections', z.array(collectionSchema)),
    staleTime: Number.POSITIVE_INFINITY,
  });
}
