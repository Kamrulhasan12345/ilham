import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
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
import { z } from 'zod';
import { useAuth } from '../../../auth/AuthContext';
import { apiFetch } from '../../../lib/apiClient';

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

type DueState = 'overdue' | 'due soon' | 'upcoming';

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
  const due = new Date(`${assignment.data.due_date}T23:59:59`);
  const now = new Date();
  const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86400000);
  const dueState: DueState = daysLeft < 0 ? 'overdue' : daysLeft <= 7 ? 'due soon' : 'upcoming';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold">
          Assignment <span className="font-mono tabular-nums">{assignment.data.assignment_id}</span>
        </h1>
        <Badge variant={dueState === 'overdue' ? 'destructive' : 'secondary'}>{dueState}</Badge>
        <span className="text-sm text-muted-foreground">due {assignment.data.due_date}</span>
      </div>
      <p className="text-muted-foreground">
        What does each student still owe? Done against owed, for each student. An assignment carries
        a due date and nothing else — overdue, due soon, and upcoming are computed from it, not
        stored.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student</TableHead>
            <TableHead className="w-20">Owed</TableHead>
            <TableHead className="w-24">Reviewed</TableHead>
            <TableHead className="w-24">Mastered</TableHead>
            <TableHead className="w-24">Still owed</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {completion.data.map((row) => (
            <TableRow key={row.student_id}>
              <TableCell>{names.get(row.student_id) ?? `Student ${row.student_id}`}</TableCell>
              <TableCell className="font-mono tabular-nums">{row.total}</TableCell>
              <TableCell className="font-mono tabular-nums">{row.reviewed}</TableCell>
              <TableCell className="font-mono tabular-nums">{row.mastered}</TableCell>
              <TableCell className="font-mono tabular-nums">{row.total - row.mastered}</TableCell>
              <TableCell>
                <Button variant="ghost" size="sm" asChild>
                  <Link
                    to="/review/$sessionId"
                    params={{ sessionId: 'new' }}
                    search={{ student_id: String(row.student_id), assignment_id: assignmentId }}
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
        A hadith mastered under another assignment is still outstanding here. Start a review from
        the circle overview.
      </p>
    </div>
  );
}
