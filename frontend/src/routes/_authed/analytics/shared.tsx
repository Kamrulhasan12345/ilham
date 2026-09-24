import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupInput } from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ChainPair } from '../../../domain/ChainPair';
import { apiFetch } from '../../../lib/apiClient';

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

const searchParamsSchema = z.object({
  a: z.coerce.string().catch(''),
  b: z.coerce.string().catch(''),
});

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
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">What do two hadiths share?</h1>
      </div>
      <Card>
        <CardContent>
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
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="shared-a">First hadith ID</FieldLabel>
                <InputGroup>
                  <InputGroupInput id="shared-a" name="a" inputMode="numeric" defaultValue={a} />
                </InputGroup>
                <FieldDescription>The database identifier, not the hadith number.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="shared-b">Second hadith ID</FieldLabel>
                <InputGroup>
                  <InputGroupInput id="shared-b" name="b" inputMode="numeric" defaultValue={b} />
                </InputGroup>
                <FieldDescription>The database identifier, not the hadith number.</FieldDescription>
              </Field>
              <Field orientation="horizontal">
                <Button type="submit">Compare</Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      {!ready ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>Name two hadiths</EmptyTitle>
            <EmptyDescription>
              Both hadiths come from the URL, so a result is shareable.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : shared.isLoading || chainA.isLoading || chainB.isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : shared.isError ||
        chainA.isError ||
        chainB.isError ||
        !shared.data ||
        !chainA.data ||
        !chainB.data ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>The comparison could not be loaded</EmptyTitle>
            <EmptyDescription>Check both identifiers and try again.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <p className="text-muted-foreground">
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
          <p className="text-sm text-muted-foreground">
            Read a chain in full:{' '}
            <Link to="/hadiths/$hadithId" params={{ hadithId: String(aId) }} className="underline">
              hadith {aId}
            </Link>{' '}
            <Link to="/hadiths/$hadithId" params={{ hadithId: String(bId) }} className="underline">
              hadith {bId}
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
