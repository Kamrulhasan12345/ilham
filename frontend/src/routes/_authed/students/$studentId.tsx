import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
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
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { BookOpenText, CheckCheck, Flame, ListTodo } from 'lucide-react';
import { z } from 'zod';
import { StatCard } from '../../../app/StatCard';
import { UserAvatar } from '../../../app/UserAvatar';
import { useAuth } from '../../../auth/AuthContext';
import { Crumbs } from '../../../domain/Crumbs';
import { Heatmap, bucketSessionsByDay } from '../../../domain/Heatmap';
import { ApiError, apiFetch } from '../../../lib/apiClient';
import { MASTERY_MAX } from '../../../lib/study';

const studentSchema = z.object({
  user_id: z.number(),
  email: z.string(),
  full_name: z.string(),
  student_level: z.string().nullable(),
  created_at: z.string(),
});
const studentsSchema = z.array(studentSchema);

const statsSchema = z.object({
  student_id: z.number(),
  mastered_count: z.coerce.number(),
  review_count: z.coerce.number(),
});

const progressSchema = z.array(
  z.object({
    // bigint arrives as a string over JSON; every other id here is integer.
    progress_id: z.coerce.number(),
    student_id: z.number(),
    hadith_id: z.number(),
    assignment_id: z.number().nullable(),
    mastery: z.number(),
    times_reviewed: z.coerce.number(),
    last_reviewed: z.string().nullable(),
  }),
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

export const Route = createFileRoute('/_authed/students/$studentId')({
  component: StudentDetailPage,
});

function StudentDetailPage() {
  const { studentId } = Route.useParams();
  const id = Number(studentId);
  // Live auth context, same source as the shell: role reads here can never
  // disagree with the header.
  const { state } = useAuth();

  const canSee =
    state.status === 'signed-in' && (state.user.role === 'teacher' || state.user.role === 'admin');

  // The backend owns the guard; the page explains the rule instead of
  // redirecting in silence (docs/frontend-prd.md §5.4).
  if (!canSee) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Student</EmptyTitle>
          <EmptyDescription>
            Only a teacher or an admin sees a student. Your account does not hold that role, so
            there is nothing to show here.{' '}
            <Link to="/collections" className="underline">
              Return to the collections.
            </Link>
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (!Number.isInteger(id)) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No such student</EmptyTitle>
          <EmptyDescription>That student id is not valid.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return <StudentDetail id={id} />;
}

function StudentDetail({ id }: { id: number }) {
  const student = useQuery({
    queryKey: ['students'],
    queryFn: () => apiFetch('/students', studentsSchema),
    staleTime: Number.POSITIVE_INFINITY,
  });
  // A fresh student has no stats row until the first progress insert, so a
  // 404 here means zeros, not a failure.
  const stats = useQuery({
    queryKey: ['students', id, 'stats'],
    queryFn: async () => {
      try {
        return await apiFetch(`/students/${id}/stats`, statsSchema);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
  });
  const progress = useQuery({
    queryKey: ['progress', { studentId: id }],
    queryFn: () => apiFetch(`/progress?student_id=${id}`, progressSchema),
  });
  const sessions = useQuery({
    queryKey: ['review-sessions'],
    queryFn: () => apiFetch('/review-sessions', sessionsSchema),
  });

  if (student.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (student.isError || !student.data) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>The student could not be loaded</EmptyTitle>
          <EmptyDescription>Try again.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  const row = student.data.find((s) => s.user_id === id);
  if (!row) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No such student</EmptyTitle>
          <EmptyDescription>Nobody with that id registered as a student.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const mastered = stats.data?.mastered_count ?? 0;
  const reviews = stats.data?.review_count ?? 0;
  const progressRows = progress.data ?? [];
  const sessionRows = (sessions.data ?? []).filter((s) => s.student_id === id);

  const days = bucketSessionsByDay(sessionRows.map((s) => s.created_at));
  const studyDays = days.filter((d) => d.count > 0).length;
  const shortDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="flex flex-col gap-6">
      <Crumbs trail={[{ label: 'Students', href: '/students' }]} />
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4">
          <UserAvatar name={row.full_name} className="size-14" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1 className="font-heading text-2xl font-semibold tracking-tight">{row.full_name}</h1>
            <p className="truncate text-sm text-muted-foreground">{row.email}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {row.student_level ? <Badge variant="secondary">{row.student_level}</Badge> : null}
            <Badge variant="outline">Joined {shortDate(row.created_at)}</Badge>
          </div>
        </CardContent>
      </Card>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Mastered"
          value={mastered}
          hint="Hadiths at mastery 3 or more"
          icon={CheckCheck}
        />
        <StatCard label="Reviews" value={reviews} hint="Reviews recorded" icon={BookOpenText} />
        <StatCard
          label="In progress"
          value={progressRows.length}
          hint="Progress rows on record"
          icon={ListTodo}
        />
        <StatCard label="Study days" value={studyDays} hint="In the last 16 weeks" icon={Flame} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Study days</h2>
          </CardTitle>
          <CardDescription>Each square is one day of review sittings</CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.isLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : sessions.isError ? (
            <p className="text-sm text-muted-foreground">The activity could not be loaded.</p>
          ) : (
            <Heatmap days={days} label={`${row.full_name}’s study activity`} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Progress</h2>
            </CardTitle>
            <CardDescription>Mastery runs from 0 to {MASTERY_MAX}</CardDescription>
          </CardHeader>
          <CardContent>
            {progress.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : progress.isError ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyTitle>The progress could not be loaded</EmptyTitle>
                  <EmptyDescription>Try again.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : progressRows.length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyTitle>No progress yet</EmptyTitle>
                  <EmptyDescription>Nothing assigned or reviewed so far.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hadith</TableHead>
                    <TableHead>Assignment</TableHead>
                    <TableHead className="w-36">Mastery</TableHead>
                    <TableHead className="w-28">Times reviewed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {progressRows.map((p) => (
                    <TableRow key={p.progress_id}>
                      <TableCell>
                        <Link
                          to="/hadiths/$hadithId"
                          params={{ hadithId: String(p.hadith_id) }}
                          className="tabular-nums hover:underline"
                        >
                          {p.hadith_id}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.assignment_id === null ? (
                          'self-study'
                        ) : (
                          <Link
                            to="/assignments/$assignmentId"
                            params={{ assignmentId: String(p.assignment_id) }}
                            className="tabular-nums hover:underline"
                          >
                            {p.assignment_id}
                          </Link>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <Progress
                            value={(p.mastery / MASTERY_MAX) * 100}
                            aria-label={`Mastery ${p.mastery} of ${MASTERY_MAX}`}
                          />
                          <span className="text-sm tabular-nums">{p.mastery}</span>
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums">{p.times_reviewed}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Review sessions</h2>
            </CardTitle>
            <CardDescription>Sittings recorded for this student</CardDescription>
          </CardHeader>
          <CardContent>
            {sessions.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : sessions.isError ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyTitle>The sessions could not be loaded</EmptyTitle>
                  <EmptyDescription>Try again.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : sessionRows.length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyTitle>No sessions yet</EmptyTitle>
                  <EmptyDescription>No review recorded for this student.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session</TableHead>
                    <TableHead>Reviewer</TableHead>
                    <TableHead>Recorded</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessionRows.map((s) => (
                    <TableRow key={s.session_id}>
                      <TableCell>
                        <Link
                          to="/review/$sessionId"
                          params={{ sessionId: String(s.session_id) }}
                          className="tabular-nums hover:underline"
                        >
                          {s.session_id}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {s.reviewer_id === null ? 'self-review' : `#${s.reviewer_id}`}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {shortDate(s.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
