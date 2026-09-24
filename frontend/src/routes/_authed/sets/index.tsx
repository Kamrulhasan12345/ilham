import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupInput } from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { LibraryBig } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { ApiError, apiFetch } from '../../../lib/apiClient';

const studySetSchema = z.object({ study_set_id: z.number(), name: z.string() });
const studySetsSchema = z.array(studySetSchema);

export const Route = createFileRoute('/_authed/sets/')({
  component: StudySetsPage,
});

function StudySetsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const sets = useQuery({
    queryKey: ['sets'],
    queryFn: () => apiFetch('/sets', studySetsSchema),
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await apiFetch('/sets', studySetSchema, { method: 'POST', body: { name: name.trim() } });
      setName('');
      await queryClient.invalidateQueries({ queryKey: ['sets'] });
      toast.success('Study set created.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create the set. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <LibraryBig className="size-6" />
          Study sets
        </h1>
        <p className="text-muted-foreground">
          The sets you own. A teacher assigns a set to a circle from here or from the circle.
        </p>
      </div>

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="new-set-name">New set name</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="new-set-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </InputGroup>
              </Field>
              <Field orientation="horizontal">
                <Button type="submit" disabled={busy || !name.trim()}>
                  {busy ? <Spinner data-icon="inline-start" /> : null}
                  Create set
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      {sets.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((n) => (
            <Card key={n}>
              <CardHeader>
                <Skeleton className="h-5 w-1/2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : sets.isError || !sets.data ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>The sets could not be loaded</EmptyTitle>
            <EmptyDescription>Try again.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : sets.data.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No sets yet</EmptyTitle>
            <EmptyDescription>
              Name the first one above. A set with no items is legal — fill it from any hadith page.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sets.data.map((set) => (
            <Card key={set.study_set_id}>
              <CardHeader>
                <CardTitle>
                  <Link
                    to="/sets/$setId"
                    params={{ setId: String(set.study_set_id) }}
                    className="hover:underline"
                  >
                    {set.name}
                  </Link>
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
