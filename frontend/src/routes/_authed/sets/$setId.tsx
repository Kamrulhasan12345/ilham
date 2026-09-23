import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { State } from '../../../domain/State';
import { ApiError, apiFetch } from '../../../lib/apiClient';
import { Button } from '../../../ui/Button';
import { Dialog } from '../../../ui/Dialog';
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { toast } from '../../../ui/Toast';

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
      toast('Set renamed.');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not rename the set. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(hadithId: number) {
    setBusy(true);
    try {
      await apiFetch(`/sets/${setId}/items/${hadithId}`, z.unknown(), { method: 'DELETE' });
      await refresh();
      toast('Hadith removed from the set.');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not remove the hadith. Try again.');
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
      toast('Set deleted.');
      await router.navigate({ to: '/sets' });
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not delete the set. Try again.');
      setBusy(false);
      setConfirmingDelete(false);
    }
  }

  if (detail.isLoading) {
    return (
      <State title="Loading the set" quiet>
        <p>Reading its hadiths.</p>
      </State>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <State title="This set could not be loaded">
        <p>Try again.</p>
      </State>
    );
  }

  const set = detail.data;

  return (
    <div>
      <h1>{set.name}</h1>

      <form onSubmit={rename}>
        <Field label="Rename this set">
          {({ controlId, describedBy }) => (
            <Input
              id={controlId}
              aria-describedby={describedBy}
              value={name ?? set.name}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>
        <Button
          type="submit"
          variant="default"
          disabled={busy || !name || !name.trim() || name.trim() === set.name}
        >
          Rename
        </Button>
      </form>

      {set.items.length === 0 ? (
        <State title="This set is empty" quiet>
          <p>A set with no items is legal. Add hadiths from any hadith page.</p>
        </State>
      ) : (
        <ul>
          {set.items.map((item) => (
            <li key={item.hadith_id}>
              <Link to="/hadiths/$hadithId" params={{ hadithId: String(item.hadith_id) }}>
                <span className="m">{item.hadith_num}</span>{' '}
                <span className="ar" dir="rtl">
                  {item.text_plain.length > 120
                    ? `${item.text_plain.slice(0, 120)}…`
                    : item.text_plain}
                </span>
              </Link>{' '}
              <Button
                size="small"
                variant="destructive"
                disabled={busy}
                onClick={() => setRemoving(item.hadith_id)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <p>
        <Button variant="destructive" disabled={busy} onClick={() => setConfirmingDelete(true)}>
          Delete this set
        </Button>
      </p>

      <Dialog
        open={removing !== null}
        title="Remove this hadith?"
        onClose={() => setRemoving(null)}
        actions={
          <>
            <Button variant="default" onClick={() => setRemoving(null)}>
              Keep it
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => removing !== null && removeItem(removing)}
            >
              Remove it
            </Button>
          </>
        }
      >
        <p>The hadith leaves this set. Assignments already made from it keep their obligations.</p>
      </Dialog>

      <Dialog
        open={confirmingDelete}
        title={`Delete “${set.name}”?`}
        onClose={() => setConfirmingDelete(false)}
        actions={
          <>
            <Button variant="default" onClick={() => setConfirmingDelete(false)}>
              Keep it
            </Button>
            <Button variant="destructive" disabled={busy} onClick={deleteSet}>
              Delete it
            </Button>
          </>
        }
      >
        <p>
          The set and its {set.items.length} {set.items.length === 1 ? 'entry go' : 'entries go'}{' '}
          with it. Assignments already made from it keep running — deleting a set never deletes
          work.
        </p>
      </Dialog>
    </div>
  );
}
