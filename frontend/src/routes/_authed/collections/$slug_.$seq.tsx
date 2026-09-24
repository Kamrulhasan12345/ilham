import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { z } from 'zod';
import { HadithList } from '../../../domain/HadithList';
import { apiFetch } from '../../../lib/apiClient';

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

  const collections = useQuery({
    queryKey: ['collections'],
    queryFn: () => apiFetch('/collections', collectionsSchema),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const collectionId = collections.data?.find((c) => c.slug === slug)?.collection_id;
  const collection = collections.data?.find((c) => c.slug === slug);

  const chapters = useQuery({
    queryKey: ['chapters', { collectionId, seq }],
    queryFn: () =>
      apiFetch(`/chapters?collection_id=${collectionId}&seq=${seq}`, chaptersSchema),
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

  if (collections.isLoading || chapters.isLoading || hadiths.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Loading</EmptyTitle>
            <EmptyDescription>Reading the chapter.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }
  if (collections.isError) {
    return (
      <div className="flex flex-col gap-4">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>The collection could not be loaded</EmptyTitle>
            <EmptyDescription>Try again.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }
  if (collectionId === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No such collection</EmptyTitle>
            <EmptyDescription>
              <Link to="/collections" className="underline">
                Return to the collections.
              </Link>
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }
  if (chapters.isError) {
    return (
      <div className="flex flex-col gap-4">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>The chapter could not be loaded</EmptyTitle>
            <EmptyDescription>Try again.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }
  if (chapterId === undefined) {
    return (
      <div className="flex flex-col gap-4">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No such chapter</EmptyTitle>
            <EmptyDescription>
              <Link to="/collections/$slug" params={{ slug }} className="underline">
                Return to {collection?.title_en ?? collection?.title_ar ?? 'the collection'}.
              </Link>
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }
  if (hadiths.isError || !hadiths.data) {
    return (
      <div className="flex flex-col gap-4">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>The hadith list could not be loaded</EmptyTitle>
            <EmptyDescription>Try again.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const data = hadiths.data;
  if (data.length === 0 && offset === 0) {
    return (
      <div className="flex flex-col gap-4">
        <Empty>
          <EmptyHeader>
            <EmptyTitle>This chapter has no hadiths yet</EmptyTitle>
            <EmptyDescription>The chapter stands empty in the corpus.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h1 dir="rtl" lang="ar" className="font-arabic text-3xl">
          {chapter?.title_ar}
        </h1>
        <span className="font-mono text-sm tabular-nums text-muted-foreground">
          chapter {chapter?.seq}
        </span>
      </div>
      <HadithList
        items={data.map((hadith) => ({
          hadith_id: hadith.hadith_id,
          hadith_num: hadith.hadith_num,
          text_plain: hadith.text_plain,
          text_en: hadith.text_en,
          chain_strength: hadith.chain_strength === null ? null : Number(hadith.chain_strength),
        }))}
      />
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          Showing {offset + 1}–{offset + data.length}
        </span>
        <span className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          disabled={offset === 0}
          onClick={() => navigate({ search: { offset: Math.max(0, offset - LIMIT) } })}
        >
          <ChevronLeft data-icon="inline-start" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={data.length < LIMIT}
          onClick={() => navigate({ search: { offset: offset + LIMIT } })}
        >
          Next
          <ChevronRight data-icon="inline-end" />
        </Button>
      </div>
    </div>
  );
}
