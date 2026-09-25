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
import { Progress } from '@/components/ui/progress';
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
import { BookOpenText, CheckCheck, ListTodo, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { PageHeader } from '../../../app/PageHeader';
import { StatCard } from '../../../app/StatCard';
import { useAuth } from '../../../auth/AuthContext';
import { ApiError, apiFetch } from '../../../lib/apiClient';
import { dueStateFor } from '../../../lib/due';

const assignmentSchema = z.object({
  assignment_id: z.number(),
  circle_id: z.number(),
  study_set_id: z.number(),
  due_date: z.string(),
});
const completionSchema = z.array(
  z.object({
    student_id: z.coerce.number(),
    total: z.coerce.number(),
    reviewed: z.coerce.number(),
    mastered: z.coerce.number(),
  }),
);
const studentsSchema = z.array(z.object({ student_id: z.number(), full_name: z.string() }));

export const Route = createFileRoute('/_authed/assignments/$assignmentId')({
  component: AssignmentCompletionPage,
});

/** What does each student still owe? Done against owed, for each student.
    A hadith mastered under another assignment is still outstanding here —
    the counts below read this assignment's rows only. */
function AssignmentCompletionPage() {
  const { assignmentId } = Route.useParams();
  const { state } = useAuth();

  const isTeacher =
    state.status === 'signed-in' && (state.user.role === 'teacher' || state.user.role === 'admin');

  // The backend owns the guard; the page explains the rule instead of
  // redirecting in silence (docs/frontend-prd.md §5.4).
  if (!isTeacher) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Assignment completion</EmptyTitle>
          <EmptyDescription>
            Only a teacher reads completion across students. A student reads their own obligations
            from their circles.{' '}
            <Link to="/circles" className="underline">
              Return to the circles.
            </Link>
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return <AssignmentCompletion assignmentId={assignmentId} />;
}

function AssignmentCompletion({ assignmentId }: { assignmentId: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const assignment = useQuery({
    queryKey: ['assignments', assignmentId],
    queryFn: () => apiFetch(`/assignments/${assignmentId}`, assignmentSchema),
  });
  const completion = useQuery({
    queryKey: ['assignments', assignmentId, 'completion'],
    queryFn: () => apiFetch(`/assignments/${assignmentId}/completion`, completionSchema),
  });
  const students = useQuery({
    queryKey: ['circles', assignment.data?.circle_id, 'students'],
    queryFn: () => apiFetch(`/circles/${assignment.data?.circle_id}/students`, studentsSchema),
    enabled: assignment.data !== undefined,
  });

  if (assignment.isLoading || completion.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (assignment.isError || completion.isError || !assignment.data || !completion.data) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>This assignment could not be loaded</EmptyTitle>
          <EmptyDescription>Try again.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const names = new Map((students.data ?? []).map((s) => [s.student_id, s.full_name] as const));
  const circleId = assignment.data.circle_id;
  // due_date arrives as an ISO timestamp; only the calendar day matters.
  const dueDay = assignment.data.due_date.slice(0, 10);
  const dueState = dueStateFor(dueDay);

  async function moveDueDate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dueDate) return;
    setBusy(true);
    try {
      await apiFetch(`/assignments/${assignmentId}`, z.unknown(), {
        method: 'PATCH',
        body: { due_date: dueDate },
      });
      setDueDate(null);
      await queryClient.invalidateQueries({ queryKey: ['assignments', assignmentId] });
      toast.success('Due date moved.');
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Could not move the due date. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function deleteAssignment() {
    setBusy(true);
    try {
      await apiFetch(`/assignments/${assignmentId}`, z.unknown(), { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success('Assignment deleted.');
      await router.navigate({
        to: '/circles/$circleId',
        params: { circleId: String(circleId) },
      });
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Could not delete the assignment. Try again.',
      );
      setBusy(false);
      setConfirmingDelete(false);
    }
  }

  const owed = completion.data.reduce((n, row) => n + row.total, 0);
  const reviewed = completion.data.reduce((n, row) => n + row.reviewed, 0);
  const mastered = completion.data.reduce((n, row) => n + row.mastered, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumbs={[
          { label: 'Circles', href: '/circles' },
          { label: 'Circle', href: `/circles/${circleId}` },
        ]}
        title={
          <>
            Assignment <span className="tabular-nums">{assignment.data.assignment_id}</span>
          </>
        }
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge variant={dueState === 'overdue' ? 'destructive' : 'secondary'}>{dueState}</Badge>
            <span>due {dueDay}</span>
          </span>
        }
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Students"
          value={completion.data.length}
          hint="In the circle"
          icon={UsersRound}
        />
        <StatCard label="Owed" value={owed} hint="Student by hadith obligations" icon={ListTodo} />
        <StatCard
          label="Reviewed"
          value={reviewed}
          hint="Obligations touched"
          icon={BookOpenText}
        />
        <StatCard
          label="Mastered"
          value={mastered}
          hint={`${owed - mastered} still owed`}
          icon={CheckCheck}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              <h2>Completion</h2>
            </CardTitle>
            <CardDescription>
              What does each student still owe? Done against owed. Overdue, due soon, and upcoming
              are computed from the due date, not stored.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead className="w-20">Owed</TableHead>
                  <TableHead className="w-24">Reviewed</TableHead>
                  <TableHead className="w-40">Mastered</TableHead>
                  <TableHead className="w-24">Still owed</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {completion.data.map((row) => (
                  <TableRow key={row.student_id}>
                    <TableCell className="font-medium">
                      {names.get(row.student_id) ?? `Student ${row.student_id}`}
                    </TableCell>
                    <TableCell className="tabular-nums">{row.total}</TableCell>
                    <TableCell className="tabular-nums">{row.reviewed}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2">
                        <Progress
                          value={row.total === 0 ? 0 : (row.mastered / row.total) * 100}
                          aria-label={`${row.mastered} of ${row.total} mastered`}
                        />
                        <span className="tabular-nums">{row.mastered}</span>
                      </span>
                    </TableCell>
                    <TableCell className="tabular-nums">{row.total - row.mastered}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" asChild>
                        <Link
                          to="/review/$sessionId"
                          params={{ sessionId: 'new' }}
                          search={{
                            student_id: String(row.student_id),
                            assignment_id: assignmentId,
                          }}
                        >
                          Review
                        </Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-sm text-muted-foreground">
              A hadith mastered under another assignment is still outstanding here.
            </p>
          </CardContent>
        </Card>

        <aside className="flex h-fit flex-col gap-6 lg:sticky lg:top-20">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Schedule</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={moveDueDate}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="due-date">Due date</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="due-date"
                        type="date"
                        required
                        value={dueDate ?? dueDay}
                        onChange={(event) => setDueDate(event.target.value)}
                      />
                    </InputGroup>
                  </Field>
                  <Field>
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={busy || dueDate === null || dueDate === dueDay}
                    >
                      Move due date
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
              <CardDescription>Reviews already recorded stay on record.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() => setConfirmingDelete(true)}
              >
                Delete this assignment
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this assignment?</AlertDialogTitle>
            <AlertDialogDescription>
              The assignment and every obligation under it go away. Reviews already recorded stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={deleteAssignment}>Delete it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
