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
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
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
import { Link, createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAuth } from '../../../../auth/AuthContext';
import { ApiError, apiFetch } from '../../../../lib/apiClient';

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

export const Route = createFileRoute('/_authed/circles/$circleId/')({
  component: CircleOverviewPage,
});

/** How much of the corpus has each student mastered? Q4 and Q6 disagree
    about the same student, and both are right: this page counts distinct
    hadiths mastered anywhere in the circle; the assignment page counts
    what is still owed under one assignment. */
function CircleOverviewPage() {
  const { circleId } = Route.useParams();
  const { state } = useAuth();

  const isTeacher =
    state.status === 'signed-in' && (state.user.role === 'teacher' || state.user.role === 'admin');

  // The backend owns the guard; the page explains the rule instead of
  // redirecting in silence (docs/frontend-prd.md §5.4).
  if (!isTeacher) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Circle overview</EmptyTitle>
          <EmptyDescription>
            Only a teacher reads the overview of their own circle. A student sees the circles they
            joined, and their own study data.{' '}
            <Link to="/circles" className="underline">
              Return to the circles.
            </Link>
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return <CircleOverview circleId={circleId} />;
}

function CircleOverview({ circleId }: { circleId: string }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<{ id: number; name: string } | null>(null);

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
      toast.error('No student carries that email. They register first, then you enrol them.');
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
      toast.success(`${target.full_name} joined the circle.`);
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Could not enrol the student. Try again.',
      );
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
      toast.success('Student removed. Their past work stays on record.');
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Could not remove the student. Try again.',
      );
    } finally {
      setBusy(false);
      setRemoving(null);
    }
  }

  if (circle.isLoading || overview.isLoading || students.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
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
      <Empty>
        <EmptyHeader>
          <EmptyTitle>This circle could not be loaded</EmptyTitle>
          <EmptyDescription>Try again.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const names = new Map(students.data.map((s) => [s.student_id, s.full_name] as const));
  const circleSessions = (sessions.data ?? []).filter((s) => s.circle_id === Number(circleId));
  const lastReview = new Map<number, string>();
  for (const session of circleSessions) {
    const prev = lastReview.get(session.student_id);
    if (!prev || session.created_at > prev) lastReview.set(session.student_id, session.created_at);
  }
  const circleAssignments = (assignments.data ?? []).filter(
    (a) => a.circle_id === Number(circleId),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">{circle.data.name}</h1>
        <p className="text-muted-foreground">
          How much of the corpus has each student mastered? Mastered counts distinct hadiths with
          mastery 3 or more. Reviews count sessions, one per sitting.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Students</h2>
        {overview.data.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No students yet</EmptyTitle>
              <EmptyDescription>
                Enrol the first student below. A set assigned to an empty circle reaches nobody —
                the call succeeds and creates zero obligations.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead className="w-24">Mastered</TableHead>
                <TableHead className="w-24">Assigned</TableHead>
                <TableHead>Share</TableHead>
                <TableHead>Last review</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {overview.data.map((row) => (
                <TableRow key={row.student_id}>
                  <TableCell>{names.get(row.student_id) ?? `Student ${row.student_id}`}</TableCell>
                  <TableCell className="font-mono tabular-nums">{row.mastered}</TableCell>
                  <TableCell className="font-mono tabular-nums">{row.assigned}</TableCell>
                  <TableCell>
                    {row.assigned === 0
                      ? '0 of 0 — nothing assigned, so no share'
                      : `${Math.round((row.mastered / row.assigned) * 100)}%`}
                  </TableCell>
                  <TableCell>{lastReview.get(row.student_id) ?? 'never'}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
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
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="text-sm text-muted-foreground">
          Mastered counts distinct hadiths. Reviews sum over sessions
          {circleSessions.length > 0 ? ` — ${circleSessions.length} sittings in this circle` : ''}.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Assignments</h2>
        {assignments.isLoading ? (
          <p className="text-sm text-muted-foreground">Reading the assignments…</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {circleAssignments.map((assignment) => (
              <li key={assignment.assignment_id}>
                <Link
                  to="/assignments/$assignmentId"
                  params={{ assignmentId: String(assignment.assignment_id) }}
                  className="hover:underline"
                >
                  Assignment {assignment.assignment_id}
                </Link>{' '}
                <span className="text-sm text-muted-foreground">due {assignment.due_date}</span>
              </li>
            ))}
          </ul>
        )}
        <p>
          <Button variant="outline" asChild>
            <Link to="/circles/$circleId/assign" params={{ circleId }}>
              Assign a set
            </Link>
          </Button>
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Enrol a student</h2>
        <Card>
          <CardContent>
            <form onSubmit={enrol}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="enrol-email">Student email</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="enrol-email"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </InputGroup>
                  <FieldDescription>They register first, then you enrol them.</FieldDescription>
                </Field>
                <Field orientation="horizontal">
                  <Button type="submit" disabled={busy || !email.trim()}>
                    Enrol
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </section>

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removing?.name ?? 'this student'}?</AlertDialogTitle>
            <AlertDialogDescription>
              Enrolment ends. Their progress rows and review history stay on record — removal
              revokes the seat, not the past.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep them</AlertDialogCancel>
            <AlertDialogAction onClick={() => removing && removeStudent(removing.id)}>
              Remove them
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
