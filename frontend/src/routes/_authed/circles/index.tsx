import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupInput } from '@/components/ui/input-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { GraduationCap } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { useAuth } from '../../../auth/AuthContext';
import { ApiError, apiFetch } from '../../../lib/apiClient';

const circleSchema = z.object({
  circle_id: z.number(),
  teacher_id: z.number(),
  name: z.string(),
  created_at: z.string(),
});
const circlesSchema = z.array(circleSchema);

export const Route = createFileRoute('/_authed/circles/')({
  component: CirclesPage,
});

function CirclesPage() {
  // Live auth context, same source as the shell: role reads here can never
  // disagree with the header.
  const { state } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['circles'],
    queryFn: () => apiFetch('/circles', circlesSchema),
  });

  const role = state.status === 'signed-in' ? state.user.role : null;
  const verifiedTeacher =
    state.status === 'signed-in' &&
    state.user.role === 'teacher' &&
    state.user.is_verified === true;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch('/circles', circleSchema, { method: 'POST', body: { name } });
      setName('');
      await queryClient.invalidateQueries({ queryKey: ['circles'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <GraduationCap className="size-6" />
          Circles
        </h1>
        {role === 'teacher' && !verifiedTeacher ? (
          <p className="text-muted-foreground">
            Only a verified teacher opens a circle. Your account is waiting for review — the create
            control below stays disabled until an admin verifies it.
          </p>
        ) : null}
        {role === 'student' ? (
          <p className="text-muted-foreground">
            Only a teacher opens a circle. You see here the circles you joined; enrolment happens
            through your teacher.
          </p>
        ) : null}
      </div>

      {role === 'teacher' ? (
        <Card>
          <CardHeader>
            {error ? (
              <Alert variant="destructive">
                <AlertTitle>Could not open the circle</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <form onSubmit={handleSubmit}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="new-circle-name">New circle name</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="new-circle-name"
                      type="text"
                      required
                      disabled={!verifiedTeacher || submitting}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </InputGroup>
                </Field>
                <Field orientation="horizontal">
                  <Button type="submit" disabled={!verifiedTeacher || submitting}>
                    {submitting ? <Spinner data-icon="inline-start" /> : null}
                    Open circle
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          </CardHeader>
        </Card>
      ) : null}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((n) => (
            <Card key={n}>
              <CardHeader>
                <Skeleton className="h-5 w-1/2" />
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : isError || !data ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>The circles could not be loaded</EmptyTitle>
            <EmptyDescription>Try again.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : data.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No circles yet</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((circle) => (
            <Card key={circle.circle_id}>
              <CardHeader>
                <CardTitle>
                  {role === 'teacher' || role === 'admin' ? (
                    <Link
                      to="/circles/$circleId"
                      params={{ circleId: String(circle.circle_id) }}
                      className="hover:underline"
                    >
                      {circle.name}
                    </Link>
                  ) : (
                    circle.name
                  )}
                </CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
