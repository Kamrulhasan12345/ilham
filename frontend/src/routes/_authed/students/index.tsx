import { Badge } from '@/components/ui/badge';
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
import { Users } from 'lucide-react';
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
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Students</EmptyTitle>
          <EmptyDescription>
            Only a teacher or an admin sees the student list. Your account does not hold that role,
            so there is nothing to show here.{' '}
            <Link to="/collections" className="underline">
              Return to the collections.
            </Link>
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
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
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Users className="size-6" />
          Students
        </h1>
        <p className="text-muted-foreground">Everyone registered as a student.</p>
      </div>
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : isError || !data ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>The students could not be loaded</EmptyTitle>
            <EmptyDescription>Try again.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : data.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No students yet</EmptyTitle>
            <EmptyDescription>Nobody registered as a student so far.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Level</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((student) => (
              <TableRow key={student.user_id}>
                <TableCell>
                  {student.full_name} — {student.email}
                </TableCell>
                <TableCell className="text-muted-foreground">{student.email}</TableCell>
                <TableCell>
                  {student.student_level ? (
                    <Badge variant="secondary">{student.student_level}</Badge>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
