import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { PageHeader } from '../../app/PageHeader';
import { Pager } from '../../app/Pager';
import { SearchForm } from '../../app/SearchForm';
import { HadithList } from '../../domain/HadithList';
import { apiFetch } from '../../lib/apiClient';

const hadithRowSchema = z.object({
  hadith_id: z.number(),
  hadith_num: z.string(),
  text_plain: z.string(),
  text_en: z.string().nullable(),
  sanad_count: z.number(),
  chain_strength: z.coerce.number().nullable(),
});
const hadithListSchema = z.array(hadithRowSchema);

const searchParamsSchema = z.object({ q: z.string().catch(''), offset: z.number().catch(0) });
const LIMIT = 50;

export const Route = createFileRoute('/_authed/search')({
  validateSearch: searchParamsSchema,
  component: SearchPage,
});

function SearchPage() {
  const { q, offset } = Route.useSearch();
  const navigate = Route.useNavigate();

  const results = useQuery({
    queryKey: ['hadiths', { q, limit: LIMIT, offset }],
    queryFn: () =>
      apiFetch(
        `/hadiths?q=${encodeURIComponent(q)}&limit=${LIMIT}&offset=${offset}`,
        hadithListSchema,
      ),
    enabled: q.trim().length > 0,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const message = (title: string, description: React.ReactNode) => (
    <Empty className="border">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Search the hadiths"
        description="Find a hadith by any words of its Arabic text or its English translation."
      />
      <SearchForm
        id="hadith-search"
        label="Search the hadith text"
        defaultValue={q}
        placeholder="الأعمال or intentions"
        hint="Type Arabic to search the Arabic text. Search removes the diacritic marks and the tatweel, and unifies the alif, ta marbuta, and ya forms. Type English to search the English translation. About 5% of hadiths have no English, so search them in Arabic."
        onSearch={(next) => navigate({ search: { q: next, offset: 0 } })}
      />

      {q.trim().length === 0 ? (
        message(
          'Type to search',
          'Search reads hadith text only. To find a person instead, search the narrators.',
        )
      ) : results.isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </div>
      ) : results.isError || !results.data ? (
        message('The search could not run', 'Try again.')
      ) : results.data.length === 0 ? (
        message(
          'Nothing matches',
          <>
            Either no hadith carries these words, or the vocalisation or spelling differs. Try fewer
            words, or{' '}
            <Link to="/narrators" search={{ q, offset: 0 }} className="underline">
              search the narrators for “{q}”
            </Link>
            .
          </>,
        )
      ) : (
        <>
          <HadithList
            items={results.data.map((hadith) => ({
              hadith_id: hadith.hadith_id,
              hadith_num: hadith.hadith_num,
              text_plain: hadith.text_plain,
              text_en: hadith.text_en,
              chain_strength: hadith.chain_strength === null ? null : Number(hadith.chain_strength),
            }))}
          />
          <Pager
            offset={offset}
            count={results.data.length}
            limit={LIMIT}
            onOffset={(next) => navigate({ search: { q, offset: next } })}
          />
        </>
      )}
    </div>
  );
}
