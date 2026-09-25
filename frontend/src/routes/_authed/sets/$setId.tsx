import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupInput } from '@/components/ui/input-group';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { PageHeader } from '../../../app/PageHeader';
import { ApiError, apiFetch } from '../../../lib/apiClient';

const setDetailSchema = z.object({
  study_set_id: z.number(),
  name: z.string(),
  items: z.array(
    z.object({ hadith_id: z.number(), hadith_num: z.string(), text_plain: z.string() }),
  ),
});

export const Route = createFileRoute('/_authed/sets/$setId')({
  component: StudySetDetailPage,
});

/** The hadiths in the set. A set has no order and no per-item note. */
function StudySetDetailPage() {
  const { setId } = Route.useParams();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);

  const detail = useQuery({
    queryKey: ['sets', setId],
    queryFn: () => apiFetch(`/sets/${setId}`, setDetailSchema),
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['sets', setId] });
    await queryClient.invalidateQueries({ queryKey: ['sets'] });
  }

  async function rename(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name || !name.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/sets/${setId}`, z.unknown(), {
        method: 'PATCH',
        body: { name: name.trim() },
      });
      setName(null);
      await refresh();
      toast.success('Set renamed.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not rename the set. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(hadithId: number) {
    setBusy(true);
    try {
      await apiFetch(`/sets/${setId}/items/${hadithId}`, z.unknown(), { method: 'DELETE' });
      await refresh();
      toast.success('Hadith removed from the set.');
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Could not remove the hadith. Try again.',
      );
    } finally {
      setBusy(false);
      setRemoving(null);
    }
  }

  async function deleteSet() {
    setBusy(true);
    try {
      await apiFetch(`/sets/${setId}`, z.unknown(), { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: ['sets'] });
      toast.success('Set deleted.');
      await router.navigate({ to: '/sets' });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete the set. Try again.');
      setBusy(false);
      setConfirmingDelete(false);
    }
  }

  if (detail.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>This set could not be loaded</EmptyTitle>
          <EmptyDescription>Try again.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const set = detail.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumbs={[{ label: 'Study sets', href: '/sets' }, { label: set.name }]}
        title={set.name}
        description={`${set.items.length} ${set.items.length === 1 ? 'hadith' : 'hadiths'} in this set. A set has no order and no per-item note.`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              <h2>Hadiths</h2>
            </CardTitle>
            <CardDescription>Add more from any hadith page</CardDescription>
          </CardHeader>
          <CardContent>
            {set.items.length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyTitle>This set is empty</EmptyTitle>
                  <EmptyDescription>
                    A set with no items is legal. Add hadiths from any hadith page.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ItemGroup className="gap-2">
                {set.items.map((item) => (
                  <Item key={item.hadith_id} variant="outline" size="sm">
                    <ItemMedia>
                      <Badge variant="secondary" className="tabular-nums">
                        {item.hadith_num}
                      </Badge>
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle className="w-full font-normal">
                        <Link
                          to="/hadiths/$hadithId"
                          params={{ hadithId: String(item.hadith_id) }}
                          className="w-full hover:text-primary hover:no-underline"
                        >
                          <span
                            dir="rtl"
                            lang="ar"
                            className="block font-arabic text-lg leading-relaxed"
                          >
                            {item.text_plain.length > 120
                              ? `${item.text_plain.slice(0, 120)}…`
                              : item.text_plain}
                          </span>
                        </Link>
                      </ItemTitle>
                    </ItemContent>
                    <ItemActions>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() => setRemoving(item.hadith_id)}
                      >
                        Remove
                      </Button>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </CardContent>
        </Card>

        <aside className="flex h-fit flex-col gap-6 lg:sticky lg:top-20">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Rename</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={rename}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="rename-set">Rename this set</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="rename-set"
                        value={name ?? set.name}
                        onChange={(event) => setName(event.target.value)}
                      />
                    </InputGroup>
                  </Field>
                  <Field>
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={busy || !name || !name.trim() || name.trim() === set.name}
                    >
                      Rename
                    </Button>
                  </Field>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
          <Card className="ring-destructive/30">
            <CardHeader>
              <CardTitle>
                <h2>Danger zone</h2>
              </CardTitle>
              <CardDescription>Deleting a set never deletes work already assigned.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => setConfirmingDelete(true)}
              >
                Delete this set
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this hadith?</AlertDialogTitle>
            <AlertDialogDescription>
              The hadith leaves this set. Assignments already made from it keep their obligations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => removing !== null && removeItem(removing)}>
              Remove it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{set.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The set and its {set.items.length}{' '}
              {set.items.length === 1 ? 'entry go' : 'entries go'} with it. Assignments already made
              from it keep running — deleting a set never deletes work.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSet}>Delete it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
