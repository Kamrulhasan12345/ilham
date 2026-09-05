import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { useAuth } from '../../../auth/AuthContext';
import { apiFetch } from '../../../lib/apiClient';

const studentSchema = z.object({
  user_id: z.number(),
  email: z.string(),
  full_name: z.string(),
  student_level: z.string().nullable(),
  created_at: z.string(),
});
const studentsSchema = z.array(studentSchema);

export const Route = createFileRoute('/_authed/students/')({
  component: StudentsPage,
});

function StudentsPage() {
  // Live auth context, same source as the shell: role reads here can never
  // disagree with the header.
  const { state } = useAuth();

  const canSee =
    state.status === 'signed-in' && (state.user.role === 'teacher' || state.user.role === 'admin');

  // The backend owns the guard; the page explains the rule instead of
  // redirecting in silence (docs/frontend-prd.md §5.4).
  if (!canSee) {
    return (
      <div>
        <h1>Students</h1>
        <p>
          Only a teacher or an admin sees the student list. Your account does not hold that role, so
          there is nothing to show here.
        </p>
        <p>
          <Link to="/collections">Return to the collections.</Link>
        </p>
      </div>
    );
  }

  return <StudentsList />;
}

function StudentsList() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['students'],
    queryFn: () => apiFetch('/students', studentsSchema),
  });

  return (
    <div>
      <h1>Students</h1>
      {isLoading ? <p>Loading the students…</p> : null}
      {isError || (!isLoading && !data) ? (
        <p>The students could not be loaded. Try again.</p>
      ) : null}
      {data && data.length === 0 ? <p>No students are registered yet.</p> : null}
      {data && data.length > 0 ? (
        <ul>
          {data.map((student) => (
            <li key={student.user_id}>
              {student.full_name} — {student.email}
              {student.student_level ? ` — ${student.student_level}` : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
