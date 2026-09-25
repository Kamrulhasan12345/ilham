import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
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
import { ChevronRight, Search } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { PageHeader } from '../../../app/PageHeader';
import { Pager } from '../../../app/Pager';
import { UserAvatar } from '../../../app/UserAvatar';
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
      <Empty className="border">
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

const PAGE = 50;

function StudentsList() {
  const [filter, setFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const { data, isLoading, isError } = useQuery({
    queryKey: ['students'],
    queryFn: () => apiFetch('/students', studentsSchema),
  });
  const needle = filter.trim().toLowerCase();
  const matches = (data ?? []).filter(
    (s) =>
      needle === '' ||
      s.full_name.toLowerCase().includes(needle) ||
      s.email.toLowerCase().includes(needle),
  );
  // ponytail: client-side paging over the full list; move to API limit/offset if it grows past a few thousand.
  const visible = matches.slice(offset, offset + PAGE);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Students" description="Everyone registered as a student." />
      {isLoading ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : isError || !data ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>The students could not be loaded</EmptyTitle>
            <EmptyDescription>Try again.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : data.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No students yet</EmptyTitle>
            <EmptyDescription>Nobody registered as a student so far.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>
                {data.length} {data.length === 1 ? 'student' : 'students'}
              </h2>
            </CardTitle>
            <CardAction>
              <InputGroup className="w-64">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  aria-label="Filter by name or email"
                  placeholder="Filter by name or email"
                  value={filter}
                  onChange={(event) => {
                    setFilter(event.target.value);
                    setOffset(0);
                  }}
                />
              </InputGroup>
            </CardAction>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((student) => (
                  <TableRow key={student.user_id}>
                    <TableCell>
                      <Link
                        to="/students/$studentId"
                        params={{ studentId: String(student.user_id) }}
                        className="flex items-center gap-3 hover:no-underline"
                      >
                        <UserAvatar name={student.full_name} className="size-9" />
                        <span className="flex flex-col">
                          <span className="font-medium hover:underline">{student.full_name}</span>
                          <span className="text-sm text-muted-foreground">{student.email}</span>
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      {student.student_level ? (
                        <Badge variant="secondary">{student.student_level}</Badge>
                      ) : (
                        <span className="text-muted-foreground">not set</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(student.created_at).toLocaleDateString('en', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {visible.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No student matches “{filter}”.
              </p>
            ) : (
              <div className="pt-4">
                <Pager offset={offset} count={visible.length} limit={PAGE} onOffset={setOffset} />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
