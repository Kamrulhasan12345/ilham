import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { Check, X } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { PageHeader } from '../../../app/PageHeader';
import { Pager } from '../../../app/Pager';
import { UserAvatar } from '../../../app/UserAvatar';
import { useAuth } from '../../../auth/AuthContext';
import { ApiError, apiFetch } from '../../../lib/apiClient';

const teacherSchema = z.object({
  user_id: z.number(),
  email: z.string(),
  full_name: z.string(),
  institution: z.string().nullable(),
  specialization: z.string().nullable(),
  created_at: z.string(),
});
const queueSchema = z.array(teacherSchema);

export const Route = createFileRoute('/_authed/admin/verify')({
  validateSearch: z.object({ offset: z.number().catch(0) }),
  component: VerifyPage,
});

function VerifyPage() {
  // Read the live auth context, not the router context snapshot: the header
  // and this page must never disagree about the role.
  const { state } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState<number | null>(null);

  const isAdmin = state.status === 'signed-in' && state.user.role === 'admin';

  // The backend owns the guard; the page explains the rule instead of
  // redirecting in silence (docs/frontend-prd.md §5.4).
  if (!isAdmin) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Verification queue</EmptyTitle>
          <EmptyDescription>
            Only an admin verifies a teacher. Your account does not hold that role, so there is
            nothing to show here.{' '}
            <Link to="/collections" className="underline">
              Return to the collections.
            </Link>
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <VerifyQueue
      error={error}
      setError={setError}
      verifying={verifying}
      setVerifying={setVerifying}
      queryClient={queryClient}
    />
  );
}

function VerifyQueue({
  error,
  setError,
  verifying,
  setVerifying,
  queryClient,
}: {
  error: string | null;
  setError: (e: string | null) => void;
  verifying: number | null;
  setVerifying: (id: number | null) => void;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  const { offset } = Route.useSearch();
  const navigate = Route.useNavigate();
  const LIMIT = 20;
  const { data, isLoading, isError } = useQuery({
    queryKey: ['teachers', 'unverified', { limit: LIMIT, offset }],
    queryFn: () => apiFetch(`/teachers/unverified?limit=${LIMIT}&offset=${offset}`, queueSchema),
  });
  const [declining, setDeclining] = useState<{ id: number; name: string } | null>(null);

  // Verifying is not destructive and needs no dialogue. Declining is, so
  // it confirms (docs/frontend-prd.md §7.23).
  async function handleVerify(userId: number) {
    setVerifying(userId);
    setError(null);
    try {
      await apiFetch(`/teachers/${userId}/verify`, z.unknown(), { method: 'POST' });
      await queryClient.invalidateQueries({ queryKey: ['teachers', 'unverified'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setVerifying(null);
    }
  }

  async function handleDecline(userId: number) {
    setVerifying(userId);
    setError(null);
    try {
      await apiFetch(`/teachers/${userId}/verify`, z.unknown(), { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: ['teachers', 'unverified'] });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setVerifying(null);
      setDeclining(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Verification queue"
        description="Teachers waiting for review. A verified teacher can open circles; everything else works before verification."
      />
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>The queue needs attention</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : isError || !data ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>The queue could not be loaded</EmptyTitle>
            <EmptyDescription>Try again.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : data.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyTitle>No teacher waits</EmptyTitle>
            <EmptyDescription>Every application has an answer.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {data.map((teacher) => (
              <Card key={teacher.user_id}>
                <CardHeader className="flex items-center gap-3">
                  <UserAvatar name={teacher.full_name} className="size-10" />
                  <div className="flex min-w-0 flex-col gap-1">
                    <CardTitle>{teacher.full_name}</CardTitle>
                    <CardDescription className="truncate">{teacher.email}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-muted-foreground">Institution</span>
                    <span>{teacher.institution ?? 'not given'}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Specialization
                    </span>
                    <span>{teacher.specialization ?? 'not given'}</span>
                  </div>
                  <div className="col-span-2 flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-muted-foreground">Applied</span>
                    <span>
                      {new Date(teacher.created_at).toLocaleDateString('en', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                </CardContent>
                <CardFooter className="justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={verifying === teacher.user_id}
                    onClick={() => setDeclining({ id: teacher.user_id, name: teacher.full_name })}
                  >
                    <X data-icon="inline-start" />
                    Decline
                  </Button>
                  <Button
                    type="button"
                    disabled={verifying === teacher.user_id}
                    onClick={() => handleVerify(teacher.user_id)}
                  >
                    {verifying === teacher.user_id ? (
                      <Spinner data-icon="inline-start" />
                    ) : (
                      <Check data-icon="inline-start" />
                    )}
                    Verify
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
          <Pager
            offset={offset}
            count={data.length}
            limit={LIMIT}
            onOffset={(next) => navigate({ search: { offset: next } })}
          />
        </>
      )}

      <AlertDialog open={declining !== null} onOpenChange={(open) => !open && setDeclining(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline {declining?.name ?? 'this teacher'}?</AlertDialogTitle>
            <AlertDialogDescription>
              Declining ends this application. Their existing circles keep running, and they keep
              building sets, writing notes, and reviewing — only new circles stay closed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep the application</AlertDialogCancel>
            <AlertDialogAction onClick={() => declining && handleDecline(declining.id)}>
              Decline it
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
