import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { useAuth } from '../../../auth/AuthContext';
import { State } from '../../../domain/State';
import { ApiError, apiFetch } from '../../../lib/apiClient';
import { Button } from '../../../ui/Button';
import { Dialog } from '../../../ui/Dialog';
import { Field } from '../../../ui/Field';
import { Input } from '../../../ui/Input';
import { Table } from '../../../ui/Table';
import { toast } from '../../../ui/Toast';

const circleSchema = z.object({ circle_id: z.number(), teacher_id: z.number(), name: z.string() });
const overviewSchema = z.array(
  z.object({
    student_id: z.coerce.number(),
    assigned: z.coerce.number(),
    mastered: z.coerce.number(),
    overdue: z.coerce.number(),
  }),
);
const circleStudentsSchema = z.array(
  z.object({ student_id: z.number(), full_name: z.string(), email: z.string() }),
);
const sessionsSchema = z.array(
  z.object({
    session_id: z.number(),
    student_id: z.number(),
    reviewer_id: z.number().nullable(),
    circle_id: z.number().nullable(),
    created_at: z.string(),
  }),
);
const assignmentsSchema = z.array(
  z.object({
    assignment_id: z.number(),
    circle_id: z.number(),
    study_set_id: z.number(),
    due_date: z.string(),
  }),
);

export const Route = createFileRoute('/_authed/circles/$circleId')({
  component: CircleOverviewPage,
});

/** How much of the corpus has each student mastered? Q4 and Q6 disagree
    about the same student, and both are right: this page counts distinct
    hadiths mastered anywhere in the circle; the assignment page counts
    what is still owed under one assignment. */
function CircleOverviewPage() {
  const { circleId } = Route.useParams();
  const { state } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<{ id: number; name: string } | null>(null);

  const isTeacher =
    state.status === 'signed-in' && (state.user.role === 'teacher' || state.user.role === 'admin');

  // The backend owns the guard; the page explains the rule instead of
  // redirecting in silence (docs/frontend-prd.md §5.4).
  if (!isTeacher) {
    return (
      <div>
        <h1>Circle overview</h1>
        <p>
          Only a teacher reads the overview of their own circle. A student sees the circles they
          joined, and their own study data.
        </p>
        <p>
          <Link to="/circles">Return to the circles.</Link>
        </p>
      </div>
    );
  }

  const circle = useQuery({
    queryKey: ['circles', circleId],
    queryFn: () => apiFetch(`/circles/${circleId}`, circleSchema),
  });
  const overview = useQuery({
    queryKey: ['circles', circleId, 'overview'],
    queryFn: () => apiFetch(`/circles/${circleId}/overview`, overviewSchema),
  });
  const students = useQuery({
    queryKey: ['circles', circleId, 'students'],
    queryFn: () => apiFetch(`/circles/${circleId}/students`, circleStudentsSchema),
  });
  const sessions = useQuery({
    queryKey: ['review-sessions'],
    queryFn: () => apiFetch('/review-sessions', sessionsSchema),
  });
  const assignments = useQuery({
    queryKey: ['assignments'],
    queryFn: () => apiFetch('/assignments', assignmentsSchema),
  });
  const registry = useQuery({
    queryKey: ['students'],
    queryFn: () =>
      apiFetch(
        '/students',
        z.array(z.object({ user_id: z.number(), full_name: z.string(), email: z.string() })),
      ),
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['circles', circleId] });
  }

  async function enrol(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const target = (registry.data ?? []).find((s) => s.email === email.trim());
    if (!target) {
      toast('No student carries that email. They register first, then you enrol them.');
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/circles/${circleId}/students`, z.unknown(), {
        method: 'POST',
        body: { student_id: target.user_id },
      });
      setEmail('');
      await refresh();
      toast(`${target.full_name} joined the circle.`);
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not enrol the student. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function removeStudent(studentId: number) {
    setBusy(true);
    try {
      await apiFetch(`/circles/${circleId}/students/${studentId}`, z.unknown(), {
        method: 'DELETE',
      });
      await refresh();
      toast('Student removed. Their past work stays on record.');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not remove the student. Try again.');
    } finally {
      setBusy(false);
      setRemoving(null);
    }
  }

  if (circle.isLoading || overview.isLoading || students.isLoading) {
    return (
      <State title="Loading the circle" quiet>
        <p>Reading its students.</p>
      </State>
    );
  }
  if (
    circle.isError ||
    overview.isError ||
    students.isError ||
    !circle.data ||
    !overview.data ||
    !students.data
  ) {
    return (
      <State title="This circle could not be loaded">
        <p>Try again.</p>
      </State>
    );
  }

  const names = new Map(students.data.map((s) => [s.student_id, s.full_name] as const));
  const circleSessions = (sessions.data ?? []).filter((s) => s.circle_id === Number(circleId));
  const lastReview = new Map<number, string>();
  const reviewCount = new Map<number, number>();
  for (const session of circleSessions) {
    reviewCount.set(session.student_id, (reviewCount.get(session.student_id) ?? 0) + 1);
    const prev = lastReview.get(session.student_id);
    if (!prev || session.created_at > prev) lastReview.set(session.student_id, session.created_at);
  }
  const circleAssignments = (assignments.data ?? []).filter(
    (a) => a.circle_id === Number(circleId),
  );

  return (
    <div>
      <h1>{circle.data.name}</h1>
      <p className="label">
        How much of the corpus has each student mastered? Mastered counts distinct hadiths with
        mastery 3 or more. Reviews count sessions, one per sitting — two different rules, printed
        under each total.
      </p>

      {overview.data.length === 0 ? (
        <State title="No students yet" quiet>
          <p>
            Enrol the first student below. A set assigned to an empty circle reaches nobody — the
            call succeeds and creates zero obligations.
          </p>
        </State>
      ) : (
        <Table caption="One row per student: distinct hadiths mastered, assigned, share, and last review.">
          <thead>
            <tr>
              <th scope="col">Student</th>
              <th scope="col">Mastered</th>
              <th scope="col">Assigned</th>
              <th scope="col">Share</th>
              <th scope="col">Last review</th>
              <th scope="col">Open</th>
            </tr>
          </thead>
          <tbody>
            {overview.data.map((row) => (
              <tr key={row.student_id}>
                <td>{names.get(row.student_id) ?? `Student ${row.student_id}`}</td>
                <td>
                  <span className="m m--bare">{`[${row.mastered}]`}</span>
                </td>
                <td>
                  <span className="m m--bare">{`[${row.assigned}]`}</span>
                </td>
                <td>
                  {row.assigned === 0 ? (
                    '0 of 0 — nothing assigned, so no share'
                  ) : (
                    <span className="m m--bare">{`[${Math.round((row.mastered / row.assigned) * 100)}%]`}</span>
                  )}
                </td>
                <td>{lastReview.get(row.student_id) ?? 'never'}</td>
                <td>
                  <Button
                    size="small"
                    variant="destructive"
                    disabled={busy}
                    onClick={() =>
                      setRemoving({
                        id: row.student_id,
                        name: names.get(row.student_id) ?? `Student ${row.student_id}`,
                      })
                    }
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <p className="label">
        Mastered counts distinct hadiths. Reviews sum over sessions
        {circleSessions.length > 0 ? ` — ${circleSessions.length} sittings in this circle` : ''}.
      </p>

      <h2 className="label">Assignments</h2>
      {assignments.isLoading ? (
        <p className="label">Reading the assignments…</p>
      ) : (
        <ul>
          {circleAssignments.map((assignment) => (
            <li key={assignment.assignment_id}>
              <Link
                to="/assignments/$assignmentId"
                params={{ assignmentId: String(assignment.assignment_id) }}
              >
                Assignment <span className="m m--bare">{`[${assignment.assignment_id}]`}</span>
              </Link>{' '}
              <span className="label">due {assignment.due_date}</span>
            </li>
          ))}
        </ul>
      )}
      <p>
        <Link to="/circles/$circleId/assign" params={{ circleId }}>
          Assign a set
        </Link>
      </p>

      <h2 className="label">Enrol a student</h2>
      <form onSubmit={enrol}>
        <Field label="Student email" hint="They register first, then you enrol them.">
          {({ controlId, describedBy }) => (
            <Input
              id={controlId}
              aria-describedby={describedBy}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          )}
        </Field>
        <Button type="submit" variant="primary" disabled={busy || !email.trim()}>
          Enrol
        </Button>
      </form>

      <Dialog
        open={removing !== null}
        title={`Remove ${removing?.name ?? 'this student'}?`}
        onClose={() => setRemoving(null)}
        actions={
          <>
            <Button variant="default" onClick={() => setRemoving(null)}>
              Keep them
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => removing && removeStudent(removing.id)}
            >
              Remove them
            </Button>
          </>
        }
      >
        <p>
          Enrolment ends. Their progress rows and review history stay on record — removal revokes
          the seat, not the past.
        </p>
      </Dialog>
    </div>
  );
}
