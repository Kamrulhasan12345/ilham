import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { useAuth } from '../../../auth/AuthContext';
import { State } from '../../../domain/State';
import { apiFetch } from '../../../lib/apiClient';
import { Table } from '../../../ui/Table';

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

  const assignment = useQuery({
    queryKey: ['assignments', assignmentId],
    queryFn: () => apiFetch(`/assignments/${assignmentId}`, assignmentSchema),
    enabled: isTeacher,
  });
  const completion = useQuery({
    queryKey: ['assignments', assignmentId, 'completion'],
    queryFn: () => apiFetch(`/assignments/${assignmentId}/completion`, completionSchema),
    enabled: isTeacher,
  });
  const students = useQuery({
    queryKey: ['circles', assignment.data?.circle_id, 'students'],
    queryFn: () => apiFetch(`/circles/${assignment.data?.circle_id}/students`, studentsSchema),
    enabled: isTeacher && assignment.data !== undefined,
  });

  // The backend owns the guard; the page explains the rule instead of
  // redirecting in silence (docs/frontend-prd.md §5.4).
  if (!isTeacher) {
    return (
      <div>
        <h1>Assignment completion</h1>
        <p>
          Only a teacher reads completion across students. A student reads their own obligations
          from their circles.
        </p>
        <p>
          <Link to="/circles">Return to the circles.</Link>
        </p>
      </div>
    );
  }

  if (assignment.isLoading || completion.isLoading) {
    return (
      <State title="Loading the assignment" quiet>
        <p>Reading what each student owes.</p>
      </State>
    );
  }
  if (assignment.isError || completion.isError || !assignment.data || !completion.data) {
    return (
      <State title="This assignment could not be loaded">
        <p>Try again.</p>
      </State>
    );
  }

  const names = new Map((students.data ?? []).map((s) => [s.student_id, s.full_name] as const));
  const due = new Date(`${assignment.data.due_date}T23:59:59`);
  const now = new Date();
  const daysLeft = Math.ceil((due.getTime() - now.getTime()) / 86400000);
  const dueState: DueState = daysLeft < 0 ? 'overdue' : daysLeft <= 7 ? 'due soon' : 'upcoming';

  return (
    <div>
      <h1>
        Assignment <span className="m m--bare">{`[${assignment.data.assignment_id}]`}</span>
      </h1>
      <p className="label">
        What does each student still owe? Done against owed, for each student. An assignment carries
        a due date and nothing else — overdue, due soon, and upcoming are computed from it, not
        stored. This one is {dueState}, due {assignment.data.due_date}.
      </p>
      <Table caption="Per student: hadiths owed, reviewed, and mastered under this assignment.">
        <thead>
          <tr>
            <th scope="col">Student</th>
            <th scope="col">Owed</th>
            <th scope="col">Reviewed</th>
            <th scope="col">Mastered</th>
            <th scope="col">Still owed</th>
            <th scope="col">Review</th>
          </tr>
        </thead>
        <tbody>
          {completion.data.map((row) => (
            <tr key={row.student_id}>
              <td>{names.get(row.student_id) ?? `Student ${row.student_id}`}</td>
              <td>
                <span className="m m--bare">{`[${row.total}]`}</span>
              </td>
              <td>
                <span className="m m--bare">{`[${row.reviewed}]`}</span>
              </td>
              <td>
                <span className="m m--bare">{`[${row.mastered}]`}</span>
              </td>
              <td>
                <span className="m m--bare">{`[${row.total - row.mastered}]`}</span>
              </td>
              <td>
                <Link
                  to="/review/$sessionId"
                  params={{ sessionId: 'new' }}
                  search={{ student_id: String(row.student_id), assignment_id: assignmentId }}
                >
                  Review
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="label">
        A hadith mastered under another assignment is still outstanding here. Start a review from
        the circle overview.
      </p>
    </div>
  );
}
