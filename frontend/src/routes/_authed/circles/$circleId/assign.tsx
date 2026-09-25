import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupInput } from '@/components/ui/input-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { PageHeader } from '../../../../app/PageHeader';
import { useAuth } from '../../../../auth/AuthContext';
import { ApiError, apiFetch } from '../../../../lib/apiClient';

const setsSchema = z.array(z.object({ study_set_id: z.number(), name: z.string() }));
const setItemsSchema = z.object({
  items: z.array(z.object({ hadith_id: z.number() })),
});
const studentsSchema = z.array(z.object({ student_id: z.number() }));

export const Route = createFileRoute('/_authed/circles/$circleId/assign')({
  component: AssignPage,
});

function AssignPage() {
  const { circleId } = Route.useParams();
  const { state } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [setId, setSetId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);

  const verifiedTeacher =
    state.status === 'signed-in' &&
    (state.user.role === 'admin' ||
      (state.user.role === 'teacher' && state.user.is_verified === true));

  const sets = useQuery({
    queryKey: ['sets'],
    queryFn: () => apiFetch('/sets', setsSchema),
    enabled: verifiedTeacher,
  });
  const students = useQuery({
    queryKey: ['circles', circleId, 'students'],
    queryFn: () => apiFetch(`/circles/${circleId}/students`, studentsSchema),
    enabled: verifiedTeacher,
  });
  const setItems = useQuery({
    queryKey: ['sets', setId, 'items'],
    queryFn: () => apiFetch(`/sets/${setId}`, setItemsSchema),
    enabled: verifiedTeacher && setId !== '',
  });

  // The backend owns the guard; the page explains the rule instead of
  // redirecting in silence (docs/frontend-prd.md §5.4).
  if (!verifiedTeacher) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Assign a set</EmptyTitle>
          <EmptyDescription>
            Only a verified teacher assigns work. An unverified account builds sets, writes notes,
            and reviews students — it does not open obligations.{' '}
            <Link to="/circles" className="underline">
              Return to the circles.
            </Link>
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const studentCount = students.data?.length ?? 0;
  const hadithCount = setItems.data?.items.length ?? 0;
  const fanOut = setId !== '' && setItems.data ? studentCount * hadithCount : null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!setId || !dueDate) return;
    setBusy(true);
    try {
      await apiFetch('/assignments', z.unknown(), {
        method: 'POST',
        body: { circle_id: Number(circleId), study_set_id: Number(setId), due_date: dueDate },
      });
      await queryClient.invalidateQueries({ queryKey: ['assignments'] });
      toast.success(fanOut !== null ? `Assigned: ${fanOut} obligations created.` : 'Assigned.');
      await router.navigate({ to: '/circles/$circleId', params: { circleId } });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not assign the set. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        crumbs={[
          { label: 'Circles', href: '/circles' },
          { label: 'Circle', href: `/circles/${circleId}` },
          { label: 'Assign a set' },
        ]}
        title="Assign a set"
        description="The call is atomic: one result, not a per-student tick."
      />
      {sets.isLoading || students.isLoading ? (
        <Skeleton className="h-72 w-full max-w-2xl rounded-xl" />
      ) : sets.isError || students.isError || !sets.data || !students.data ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>The assignment form could not be loaded</EmptyTitle>
            <EmptyDescription>Try again.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>
              <h2>New assignment</h2>
            </CardTitle>
            <CardDescription>
              Every student in the circle gets every hadith in the set.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="assign-set">The set</FieldLabel>
                  {sets.data.length === 0 ? (
                    <FieldDescription>
                      No sets yet — create one from the study sets page first.
                    </FieldDescription>
                  ) : (
                    <Select value={setId} onValueChange={setSetId}>
                      <SelectTrigger id="assign-set">
                        <SelectValue placeholder="Choose a set" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectLabel>Study sets</SelectLabel>
                          {sets.data.map((set) => (
                            <SelectItem key={set.study_set_id} value={String(set.study_set_id)}>
                              {set.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="assign-due">Due date</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="assign-due"
                      type="date"
                      value={dueDate}
                      onChange={(event) => setDueDate(event.target.value)}
                      required
                    />
                  </InputGroup>
                  <FieldDescription>
                    A date only. Overdue, due soon, and upcoming are computed from it.
                  </FieldDescription>
                </Field>
                {fanOut !== null ? (
                  <Alert>
                    <AlertTitle>This creates {fanOut} obligations</AlertTitle>
                    <AlertDescription>
                      {studentCount} {studentCount === 1 ? 'student' : 'students'} by {hadithCount}{' '}
                      {hadithCount === 1 ? 'hadith' : 'hadiths'}.
                      {studentCount === 0
                        ? ' A set assigned to an empty circle reaches nobody.'
                        : ''}{' '}
                      Assigning the same set again is separate: work done for the first assignment
                      does not close the second.
                    </AlertDescription>
                  </Alert>
                ) : null}
                <Field>
                  <Button type="submit" disabled={busy || !setId || !dueDate}>
                    {busy ? <Spinner data-icon="inline-start" /> : null}
                    Assign the set
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
