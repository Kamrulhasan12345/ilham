import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { ChevronRight, GraduationCap, Plus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { PageHeader } from '../../../app/PageHeader';
import { useAuth } from '../../../auth/AuthContext';
import { ApiError, apiFetch } from '../../../lib/apiClient';
import { circleSchema, useCircles } from '../../../lib/study';

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
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, isError } = useCircles();

  const role = state.status === 'signed-in' ? state.user.role : null;
  const ownId = state.status === 'signed-in' ? state.user.user_id : null;
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
      setDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['circles'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function leave(circleId: number) {
    setSubmitting(true);
    try {
      await apiFetch(`/circles/${circleId}/students/${ownId}`, z.unknown(), {
        method: 'DELETE',
      });
      await queryClient.invalidateQueries({ queryKey: ['circles'] });
      toast.success('You left the circle. Your past work stays on record.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not leave. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const description =
    role === 'teacher' && !verifiedTeacher
      ? 'Only a verified teacher opens a circle. Your account is waiting for review, so the create control stays disabled until an admin verifies it.'
      : role === 'student'
        ? 'Only a teacher opens a circle. You see here the circles you joined; enrolment happens through your teacher.'
        : 'Your halaqas: open one to manage members, assign sets, and follow progress.';

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Circles"
        description={description}
        actions={
          role === 'teacher' ? (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={!verifiedTeacher || submitting}>
                  <Plus data-icon="inline-start" />
                  Open circle
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                  <DialogHeader>
                    <DialogTitle>Open a circle</DialogTitle>
                    <DialogDescription>
                      Name the halaqa. You enrol students once it exists.
                    </DialogDescription>
                  </DialogHeader>
                  {error ? (
                    <Alert variant="destructive">
                      <AlertTitle>Could not open the circle</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ) : null}
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="new-circle-name">Circle name</FieldLabel>
                      <Input
                        id="new-circle-name"
                        type="text"
                        required
                        disabled={submitting}
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                      />
                    </Field>
                  </FieldGroup>
                  <DialogFooter>
                    <Button type="submit" disabled={submitting || !name.trim()}>
                      {submitting ? <Spinner data-icon="inline-start" /> : null}
                      Create circle
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((n) => (
            <Skeleton key={n} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : isError || !data ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>The circles could not be loaded</EmptyTitle>
            <EmptyDescription>Try again.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : data.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No circles yet</EmptyTitle>
            <EmptyDescription>
              {role === 'student'
                ? 'Your teacher enrols you in a circle.'
                : 'Open a circle to start teaching.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((circle) => (
            <Card key={circle.circle_id}>
              <CardHeader>
                <CardTitle>{circle.name}</CardTitle>
                <CardDescription>
                  Started{' '}
                  {new Date(circle.created_at).toLocaleDateString('en', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </CardDescription>
                <CardAction>
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <GraduationCap className="size-5" />
                  </span>
                </CardAction>
              </CardHeader>
              <CardFooter className="justify-end">
                {role === 'teacher' || role === 'admin' ? (
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/circles/$circleId" params={{ circleId: String(circle.circle_id) }}>
                      Manage
                      <ChevronRight data-icon="inline-end" />
                    </Link>
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={submitting}
                    onClick={() => leave(circle.circle_id)}
                  >
                    Leave
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
