import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ChainPair } from '../../../domain/ChainPair';
import { State } from '../../../domain/State';
import { apiFetch } from '../../../lib/apiClient';
import { Button } from '../../../ui/Button';
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';

const sharedSchema = z.array(z.object({ narrator_id: z.number(), display_name: z.string() }));
const chainSchema = z.object({
  hadith: z.object({ hadith_id: z.number(), hadith_num: z.string() }),
  isnadChain: z.array(
    z.object({
      display_name: z.string().nullable(),
      raw_name: z.string(),
      is_compiler: z.boolean(),
    }),
  ),
});

const searchParamsSchema = z.object({ a: z.coerce.string().catch(''), b: z.coerce.string().catch('') });

export const Route = createFileRoute('/_authed/analytics/shared')({
  validateSearch: searchParamsSchema,
  component: SharedPage,
});

function SharedPage() {
  const { a, b } = Route.useSearch();
  const navigate = Route.useNavigate();
  const aId = Number(a);
  const bId = Number(b);
  const ready = Number.isInteger(aId) && aId > 0 && Number.isInteger(bId) && bId > 0;

  const shared = useQuery({
    queryKey: ['analytics', 'shared', { a: aId, b: bId }],
    queryFn: () => apiFetch(`/analytics/shared-narrators?a=${aId}&b=${bId}`, sharedSchema),
    enabled: ready,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const chainA = useQuery({
    queryKey: ['hadiths', String(aId)],
    queryFn: () => apiFetch(`/hadiths/${aId}`, chainSchema),
    enabled: ready,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const chainB = useQuery({
    queryKey: ['hadiths', String(bId)],
    queryFn: () => apiFetch(`/hadiths/${bId}`, chainSchema),
    enabled: ready,
    staleTime: Number.POSITIVE_INFINITY,
  });

  return (
    <div>
      <h1>What do two hadiths share?</h1>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          navigate({
            search: {
              a: String(form.get('a') ?? ''),
              b: String(form.get('b') ?? ''),
            },
          });
        }}
      >
        <Field label="First hadith ID" hint="The database identifier, not the hadith number.">
          {({ controlId, describedBy }) => (
            <Input
              id={controlId}
              aria-describedby={describedBy}
              name="a"
              inputMode="numeric"
              defaultValue={a}
            />
          )}
        </Field>
        <Field label="Second hadith ID" hint="The database identifier, not the hadith number.">
          {({ controlId, describedBy }) => (
            <Input
              id={controlId}
              aria-describedby={describedBy}
              name="b"
              inputMode="numeric"
              defaultValue={b}
            />
          )}
        </Field>
        <Button type="submit" variant="primary">
          Compare
        </Button>
      </form>

      {!ready ? (
        <State title="Name two hadiths" quiet>
          <p>Both hadiths come from the URL, so a result is shareable.</p>
        </State>
      ) : shared.isLoading || chainA.isLoading || chainB.isLoading ? (
        <State title="Comparing" quiet>
          <p>Reading both chains.</p>
        </State>
      ) : shared.isError ||
        chainA.isError ||
        chainB.isError ||
        !shared.data ||
        !chainA.data ||
        !chainB.data ? (
        <State title="The comparison could not be loaded">
          <p>Check both identifiers and try again.</p>
        </State>
      ) : (
        <>
          <p className="label">
            {shared.data.length === 0
              ? 'These two chains share no narrator.'
              : `${shared.data.length} shared ${shared.data.length === 1 ? 'narrator' : 'narrators'}, marked in both columns.`}
          </p>
          <ChainPair
            left={{
              hadithId: chainA.data.hadith.hadith_id,
              hadithNum: chainA.data.hadith.hadith_num,
              names: [...chainA.data.isnadChain]
                .reverse()
                .map((link) => link.display_name ?? link.raw_name),
            }}
            right={{
              hadithId: chainB.data.hadith.hadith_id,
              hadithNum: chainB.data.hadith.hadith_num,
              names: [...chainB.data.isnadChain]
                .reverse()
                .map((link) => link.display_name ?? link.raw_name),
            }}
            shared={new Set(shared.data.map((row) => row.display_name))}
          />
          <p className="label">
            Read a chain in full:{' '}
            <Link to="/hadiths/$hadithId" params={{ hadithId: String(aId) }}>
              hadith {aId}
            </Link>{' '}
            <Link to="/hadiths/$hadithId" params={{ hadithId: String(bId) }}>
              hadith {bId}
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
