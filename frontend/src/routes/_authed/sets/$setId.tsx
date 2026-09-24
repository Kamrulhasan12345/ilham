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
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupInput } from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold">{set.name}</h1>
        <span className="flex-1" />
        <Button variant="destructive" disabled={busy} onClick={() => setConfirmingDelete(true)}>
          Delete this set
        </Button>
      </div>

      <Card>
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
              <Field orientation="horizontal">
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

      {set.items.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>This set is empty</EmptyTitle>
            <EmptyDescription>
              A set with no items is legal. Add hadiths from any hadith page.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Hadith</TableHead>
              <TableHead>Text</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {set.items.map((item) => (
              <TableRow key={item.hadith_id}>
                <TableCell className="font-mono tabular-nums">{item.hadith_num}</TableCell>
                <TableCell>
                  <Link
                    to="/hadiths/$hadithId"
                    params={{ hadithId: String(item.hadith_id) }}
                    className="hover:underline"
                  >
                    <span dir="rtl" lang="ar" className="font-arabic">
                      {item.text_plain.length > 120
                        ? `${item.text_plain.slice(0, 120)}…`
                        : item.text_plain}
                    </span>
                  </Link>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => setRemoving(item.hadith_id)}
                  >
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

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
