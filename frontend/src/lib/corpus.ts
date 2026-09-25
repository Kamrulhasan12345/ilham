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

// The book's structure: collection → kitab → bab → hadith. Kitab and bab
// titles are English-first; the Arabic title is always present.
export const kitabSchema = z.object({
  kitab_id: z.number(),
  collection_id: z.number(),
  kitab_num: z.number(),
  title_en: z.string(),
  title_ar: z.string(),
  bab_count: z.number(),
  hadith_count: z.number(),
});
export type Kitab = z.infer<typeof kitabSchema>;

export const babSchema = z.object({
  bab_id: z.number(),
  kitab_id: z.number(),
  seq: z.number(),
  bab_num: z.string().nullable(),
  surah_num: z.number().nullable(),
  surah_title_en: z.string().nullable(),
  surah_title_ar: z.string().nullable(),
  title_en: z.string().nullable(),
  title_ar: z.string(),
  hadith_count: z.number(),
});
export type Bab = z.infer<typeof babSchema>;

const kitabDetailSchema = kitabSchema.extend({
  kitab_level_count: z.number(),
  babs: z.array(babSchema),
});

export function useKitabs(collectionId: number | undefined) {
  return useQuery({
    queryKey: ['kitabs', { collectionId }],
    queryFn: () => apiFetch(`/kitabs?collection_id=${collectionId}`, z.array(kitabSchema)),
    enabled: collectionId !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useKitab(kitabId: number | undefined) {
  return useQuery({
    queryKey: ['kitab', kitabId],
    queryFn: () => apiFetch(`/kitabs/${kitabId}`, kitabDetailSchema),
    enabled: kitabId !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

/** Resolves a /collections/:slug/:kitab URL (the book's own numbers) to rows. */
export function useKitabByNum(slug: string, kitabNum: string) {
  const collections = useCollections();
  const collection = collections.data?.find((c) => c.slug === slug);
  const kitabs = useKitabs(collection?.collection_id);
  const kitabRow = kitabs.data?.find((k) => String(k.kitab_num) === kitabNum);
  const kitab = useKitab(kitabRow?.kitab_id);
  return {
    collection,
    kitab: kitab.data,
    isLoading: collections.isLoading || kitabs.isLoading || kitab.isLoading,
    isError: collections.isError || kitabs.isError || kitab.isError,
    notFound: (collections.isSuccess && !collection) || (kitabs.isSuccess && !kitabRow),
  };
}

// A bab headed by the word باب alone. Bukhari uses it for a chapter with no
// heading of its own (88 of them hold hadiths); no edition translates it.
const BARE_BAB = /^باب$/;

/** English where the edition has it; "Untitled chapter" for a bare باب;
    else the Arabic. */
export function titleOf(row: { title_en: string | null; title_ar: string }): string {
  if (row.title_en) return row.title_en;
  const letters = row.title_ar.replace(/[^\u0621-\u064A]/g, '');
  return BARE_BAB.test(letters) ? 'Untitled chapter' : row.title_ar;
}

export const hadithListSchema = z.array(
  z.object({
    hadith_id: z.number(),
    hadith_num: z.string(),
    text_plain: z.string(),
    text_en: z.string().nullable(),
    sanad_count: z.number(),
    chain_strength: z.coerce.number().nullable(),
  }),
);

export function plural(n: number, word: string): string {
  return n === 1 ? word : `${word}s`;
}
