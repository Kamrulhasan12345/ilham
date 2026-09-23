import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { State } from '../../../domain/State';
import { ApiError, apiFetch } from '../../../lib/apiClient';
import { Button } from '../../../ui/Button';
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { toast } from '../../../ui/Toast';

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
      toast('Study set created.');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not create the set. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Study sets</h1>
      <p className="label">
        The sets you own. A teacher assigns a set to a circle from here or from the circle.
      </p>

      <form onSubmit={handleSubmit}>
        <Field label="New set name">
          {({ controlId, describedBy }) => (
            <Input
              id={controlId}
              aria-describedby={describedBy}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          )}
        </Field>
        <Button type="submit" variant="primary" disabled={busy || !name.trim()}>
          Create set
        </Button>
      </form>

      {sets.isLoading ? (
        <State title="Loading the sets" quiet>
          <p>Reading your shelves.</p>
        </State>
      ) : sets.isError || !sets.data ? (
        <State title="The sets could not be loaded">
          <p>Try again.</p>
        </State>
      ) : sets.data.length === 0 ? (
        <State title="No sets yet" quiet>
          <p>
            Name the first one above. A set with no items is legal — fill it from any hadith page.
          </p>
        </State>
      ) : (
        <ul>
          {sets.data.map((set) => (
            <li key={set.study_set_id}>
              <Link to="/sets/$setId" params={{ setId: String(set.study_set_id) }}>
                {set.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
