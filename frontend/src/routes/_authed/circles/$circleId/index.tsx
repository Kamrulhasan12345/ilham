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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupInput } from '@/components/ui/input-group';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
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
import {
  BookOpenText,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  Layers,
  Plus,
  UsersRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { PageHeader } from '../../../../app/PageHeader';
import { StatCard } from '../../../../app/StatCard';
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
const directorySchema = z.array(
  z.object({ user_id: z.number(), full_name: z.string(), email: z.string() }),
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
  const router = useRouter();
  const { state } = useAuth();
  const [email, setEmail] = useState('');
  const [debouncedEmail, setDebouncedEmail] = useState('');
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<{ id: number; name: string } | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
  // Debounced directory search: one request per pause, not per keystroke.
  useEffect(() => {
    if (pickedId !== null) return;
    const timer = setTimeout(() => setDebouncedEmail(email.trim()), 300);
    return () => clearTimeout(timer);
  }, [email, pickedId]);
  const suggestions = useQuery({
    queryKey: ['students', 'search', debouncedEmail],
    queryFn: () => apiFetch(`/students?q=${encodeURIComponent(debouncedEmail)}`, directorySchema),
    enabled: pickedId === null && debouncedEmail !== '',
  });
  // Fallback only: when the teacher submits a typed email without picking a
  // suggestion, resolve it against the full directory one time.
  const registry = useQuery({
    queryKey: ['students'],
    queryFn: () => apiFetch('/students', directorySchema),
    enabled: false,
  });

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['circles', circleId] });
  }

  async function enrol(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = email.trim();
    let target =
      pickedId !== null
        ? ((suggestions.data ?? []).find((s) => s.user_id === pickedId) ?? null)
        : ((suggestions.data ?? []).find((s) => s.email === trimmed) ?? null);
    if (!target) {
      const registryData = await registry.refetch();
      target = (registryData.data ?? []).find((s) => s.email === trimmed) ?? null;
    }
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
      setDebouncedEmail('');
      setPickedId(null);
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

  async function deleteCircle() {
    setBusy(true);
    try {
      await apiFetch(`/circles/${circleId}`, z.unknown(), { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: ['circles'] });
      toast.success('Circle deleted.');
      await router.navigate({ to: '/circles' });
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Could not delete the circle. Try again.',
      );
      setBusy(false);
      setConfirmingDelete(false);
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

  const isOwner =
    state.status === 'signed-in' &&
    state.user.role === 'teacher' &&
    circle.data.teacher_id === state.user.user_id;
  const totalMastered = overview.data.reduce((n, row) => n + row.mastered, 0);
  const shortDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumbs={[{ label: 'Circles', href: '/circles' }, { label: circle.data.name }]}
        title={circle.data.name}
        description="How much of the corpus has each student mastered? Mastered counts distinct hadiths with mastery 3 or more. Reviews count sessions, one per sitting."
        actions={
          <Button asChild>
            <Link to="/circles/$circleId/assign" params={{ circleId }}>
              <Plus data-icon="inline-start" />
              Assign a set
            </Link>
          </Button>
        }
      />

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Students"
          value={overview.data.length}
          hint="Enrolled now"
          icon={UsersRound}
        />
        <StatCard
          label="Assignments"
          value={circleAssignments.length}
          hint="Sets assigned to this circle"
          icon={Layers}
        />
        <StatCard
          label="Review sittings"
          value={circleSessions.length}
          hint="Recorded in this circle"
          icon={BookOpenText}
        />
        <StatCard
          label="Mastered"
          value={totalMastered}
          hint="Across all students"
          icon={CheckCheck}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Students</h2>
              </CardTitle>
              <CardDescription>Mastered counts distinct hadiths</CardDescription>
            </CardHeader>
            <CardContent>
              {overview.data.length === 0 ? (
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyTitle>No students yet</EmptyTitle>
                    <EmptyDescription>
                      Enrol the first student. A set assigned to an empty circle reaches nobody: the
                      call succeeds and creates zero obligations.
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
                      <TableHead className="w-40">Share</TableHead>
                      <TableHead>Last review</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.data.map((row) => {
                      const share =
                        row.assigned === 0 ? null : Math.round((row.mastered / row.assigned) * 100);
                      const last = lastReview.get(row.student_id);
                      return (
                        <TableRow key={row.student_id}>
                          <TableCell className="font-medium">
                            {names.get(row.student_id) ?? `Student ${row.student_id}`}
                          </TableCell>
                          <TableCell className="tabular-nums">{row.mastered}</TableCell>
                          <TableCell className="tabular-nums">{row.assigned}</TableCell>
                          <TableCell>
                            {share === null ? (
                              <span className="text-sm text-muted-foreground">
                                nothing assigned
                              </span>
                            ) : (
                              <span className="flex items-center gap-2">
                                <Progress value={share} aria-label={`${share}% mastered`} />
                                <span className="text-sm tabular-nums">{share}%</span>
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {last ? shortDate(last) : 'never'}
                          </TableCell>
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
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Assignments</h2>
              </CardTitle>
              <CardDescription>Open one to see who finished it</CardDescription>
            </CardHeader>
            <CardContent>
              {assignments.isLoading ? (
                <Skeleton className="h-20 w-full" />
              ) : circleAssignments.length === 0 ? (
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyTitle>Nothing assigned yet</EmptyTitle>
                    <EmptyDescription>Assign a study set to give the circle work.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ItemGroup className="gap-2">
                  {circleAssignments.map((assignment) => (
                    <Item key={assignment.assignment_id} variant="outline" size="sm" asChild>
                      <Link
                        to="/assignments/$assignmentId"
                        params={{ assignmentId: String(assignment.assignment_id) }}
                      >
                        <ItemMedia
                          variant="icon"
                          className="size-9 rounded-lg bg-primary/10 text-primary"
                        >
                          <CalendarDays />
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>Assignment {assignment.assignment_id}</ItemTitle>
                          <ItemDescription>
                            Set {assignment.study_set_id}, due {shortDate(assignment.due_date)}
                          </ItemDescription>
                        </ItemContent>
                        <ItemActions>
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </ItemActions>
                      </Link>
                    </Item>
                  ))}
                </ItemGroup>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="flex h-fit flex-col gap-6 lg:sticky lg:top-20">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Enrol a student</h2>
              </CardTitle>
              <CardDescription>They register first, then you enrol them.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={enrol}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="enrol-email">Student email</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id="enrol-email"
                        type="text"
                        value={email}
                        onChange={(event) => {
                          setEmail(event.target.value);
                          setPickedId(null);
                        }}
                        required
                        autoComplete="off"
                        role="combobox"
                        aria-expanded={(suggestions.data ?? []).length > 0}
                        aria-controls="enrol-suggestions"
                      />
                    </InputGroup>
                  </Field>
                  {pickedId === null &&
                  debouncedEmail !== '' &&
                  (suggestions.data ?? []).length > 0 ? (
                    <ul
                      id="enrol-suggestions"
                      role="listbox"
                      aria-label="Matching students"
                      className="flex flex-col gap-1 rounded-lg border p-1"
                    >
                      {suggestions.data!.map((s) => (
                        <li key={s.user_id} role="option" aria-selected="false">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => {
                              setEmail(s.email);
                              setPickedId(s.user_id);
                            }}
                          >
                            {s.full_name} — {s.email}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <Field>
                    <Button type="submit" disabled={busy || !email.trim()}>
                      Enrol
                    </Button>
                  </Field>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>

          {isOwner ? (
            <Card className="ring-destructive/30">
              <CardHeader>
                <CardTitle>
                  <h2>Danger zone</h2>
                </CardTitle>
                <CardDescription>
                  Only an empty circle deletes. History is never cascaded away.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() => setConfirmingDelete(true)}
                >
                  Delete this circle
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </aside>
      </div>

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

      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this circle?</AlertDialogTitle>
            <AlertDialogDescription>
              Only an empty circle deletes. With students, assignments, or sessions on record,
              remove those first — history is never cascaded away.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={deleteCircle}>Delete it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
