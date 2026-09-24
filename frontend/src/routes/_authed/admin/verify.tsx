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
import { Card, CardContent } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
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
      <Empty>
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
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ShieldCheck className="size-6" />
          Verification queue
        </h1>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>The queue needs attention</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : isError || !data ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>The queue could not be loaded</EmptyTitle>
            <EmptyDescription>Try again.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : data.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No teacher waits</EmptyTitle>
            <EmptyDescription>Every application has an answer.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            {data.map((teacher) => (
              <Card key={teacher.user_id}>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex-1">
                      {teacher.full_name} — {teacher.email}
                      {teacher.institution ? ` — ${teacher.institution}` : null}
                      {teacher.specialization ? ` — ${teacher.specialization}` : null}
                    </span>
                    <Button
                      type="button"
                      disabled={verifying === teacher.user_id}
                      onClick={() => handleVerify(teacher.user_id)}
                    >
                      {verifying === teacher.user_id ? <Spinner data-icon="inline-start" /> : null}
                      Verify
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={verifying === teacher.user_id}
                      onClick={() => setDeclining({ id: teacher.user_id, name: teacher.full_name })}
                    >
                      Decline
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Showing {offset + 1}–{offset + data.length}
            </span>
            <span className="flex-1" />
            <Button
              variant="outline"
              size="sm"
              disabled={offset === 0}
              onClick={() => navigate({ search: { offset: Math.max(0, offset - LIMIT) } })}
            >
              <ChevronLeft data-icon="inline-start" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.length < LIMIT}
              onClick={() => navigate({ search: { offset: offset + LIMIT } })}
            >
              Next
              <ChevronRight data-icon="inline-end" />
            </Button>
          </div>
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
