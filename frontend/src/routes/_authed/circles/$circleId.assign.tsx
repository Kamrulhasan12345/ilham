import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { useAuth } from '../../../auth/AuthContext';
import { State } from '../../../domain/State';
import { ApiError, apiFetch } from '../../../lib/apiClient';
import { Button } from '../../../ui/Button';
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { Seg } from '../../../ui/Seg';
import { toast } from '../../../ui/Toast';

const setsSchema = z.array(z.object({ study_set_id: z.number(), name: z.string() }));
const setItemsSchema = z.object({
  items: z.array(z.object({ hadith_id: z.number() })),
});
const studentsSchema = z.array(z.object({ student_id: z.number() }));

export const Route = createFileRoute('/_authed/circles/$circleId/assign')({
  component: AssignPage,
});

function AssignPage() {
  const { circleId } = Route.useParams();
  const { state } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [setId, setSetId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);

  const verifiedTeacher =
    state.status === 'signed-in' &&
    (state.user.role === 'admin' ||
      (state.user.role === 'teacher' && state.user.is_verified === true));

  const sets = useQuery({
    queryKey: ['sets'],
    queryFn: () => apiFetch('/sets', setsSchema),
    enabled: verifiedTeacher,
  });
  const students = useQuery({
    queryKey: ['circles', circleId, 'students'],
    queryFn: () => apiFetch(`/circles/${circleId}/students`, studentsSchema),
    enabled: verifiedTeacher,
  });
  const setItems = useQuery({
    queryKey: ['sets', setId, 'items'],
    queryFn: () => apiFetch(`/sets/${setId}`, setItemsSchema),
    enabled: verifiedTeacher && setId !== '',
  });

  // The backend owns the guard; the page explains the rule instead of
  // redirecting in silence (docs/frontend-prd.md §5.4).
  if (!verifiedTeacher) {
    return (
      <div>
        <h1>Assign a set</h1>
        <p>
          Only a verified teacher assigns work. An unverified account builds sets, writes notes, and
          reviews students — it does not open obligations.
        </p>
        <p>
          <Link to="/circles">Return to the circles.</Link>
        </p>
      </div>
    );
  }

  const studentCount = students.data?.length ?? 0;
  const hadithCount = setItems.data?.items.length ?? 0;
  const fanOut = setId !== '' && setItems.data ? studentCount * hadithCount : null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!setId || !dueDate) return;
    setBusy(true);
    try {
      await apiFetch('/assignments', z.unknown(), {
        method: 'POST',
        body: { circle_id: Number(circleId), study_set_id: Number(setId), due_date: dueDate },
      });
      await queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast(fanOut !== null ? `Assigned: ${fanOut} obligations created.` : 'Assigned.');
      await router.navigate({ to: '/circles/$circleId', params: { circleId } });
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not assign the set. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Assign a set</h1>
      {sets.isLoading || students.isLoading ? (
        <State title="Loading" quiet>
          <p>Reading your sets and the circle.</p>
        </State>
      ) : sets.isError || students.isError || !sets.data || !students.data ? (
        <State title="The assignment form could not be loaded">
          <p>Try again.</p>
        </State>
      ) : (
        <form onSubmit={handleSubmit}>
          <h2 className="label">The set</h2>
          {sets.data.length === 0 ? (
            <p className="label">No sets yet — create one from the study sets page first.</p>
          ) : (
            <Seg
              label="The set"
              options={sets.data.map((set) => ({
                value: String(set.study_set_id),
                label: set.name,
              }))}
              value={setId}
              onChange={setSetId}
            />
          )}
          <Field
            label="Due date"
            hint="A date only. Overdue, due soon, and upcoming are computed from it."
          >
            {({ controlId, describedBy }) => (
              <Input
                id={controlId}
                aria-describedby={describedBy}
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                required
              />
            )}
          </Field>
          {fanOut !== null ? (
            <p>
              This creates {fanOut} obligations: {studentCount}{' '}
              {studentCount === 1 ? 'student' : 'students'} by {hadithCount}{' '}
              {hadithCount === 1 ? 'hadith' : 'hadiths'}.
              {studentCount === 0 ? ' A set assigned to an empty circle reaches nobody.' : ''}{' '}
              Assigning the same set again is separate: work done for the first assignment does not
              close the second.
            </p>
          ) : null}
          <Button type="submit" variant="primary" disabled={busy || !setId || !dueDate}>
            Assign the set
          </Button>
        </form>
      )}
      <p className="label">The call is atomic: one result, not a per-student tick.</p>
    </div>
  );
}
