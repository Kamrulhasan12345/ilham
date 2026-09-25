import { Button } from '@/components/ui/button';
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { ChevronRight, Layers, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { PageHeader } from '../../../app/PageHeader';
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
  const [dialogOpen, setDialogOpen] = useState(false);

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
      setDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['sets'] });
      toast.success('Study set created.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create the set. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Study sets"
        description="The sets you own. A teacher assigns a set to a circle from here or from the circle."
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus data-icon="inline-start" />
                New set
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                <DialogHeader>
                  <DialogTitle>New study set</DialogTitle>
                  <DialogDescription>
                    A set with no items is legal. Fill it from any hadith page.
                  </DialogDescription>
                </DialogHeader>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="new-set-name">Set name</FieldLabel>
                    <Input
                      id="new-set-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                    />
                  </Field>
                </FieldGroup>
                <DialogFooter>
                  <Button type="submit" disabled={busy || !name.trim()}>
                    {busy ? <Spinner data-icon="inline-start" /> : null}
                    Create set
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {sets.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((n) => (
            <Skeleton key={n} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : sets.isError || !sets.data ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>The sets could not be loaded</EmptyTitle>
            <EmptyDescription>Try again.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : sets.data.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No sets yet</EmptyTitle>
            <EmptyDescription>
              Make the first one with New set. A set with no items is legal; fill it from any hadith
              page.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sets.data.map((set) => (
            <Card key={set.study_set_id} className="transition-shadow hover:shadow-md">
              <Link
                to="/sets/$setId"
                params={{ setId: String(set.study_set_id) }}
                className="hover:no-underline"
              >
                <CardHeader>
                  <CardTitle>{set.name}</CardTitle>
                  <CardDescription>Set {set.study_set_id}</CardDescription>
                  <CardAction>
                    <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Layers className="size-5" />
                    </span>
                  </CardAction>
                </CardHeader>
                <div className="flex items-center justify-end gap-1 px-4 pt-4 text-sm font-medium text-primary">
                  Open
                  <ChevronRight className="size-4" />
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
