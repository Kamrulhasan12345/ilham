import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { useAuth } from '../../../auth/AuthContext';
import { State } from '../../../domain/State';
import { ApiError, apiFetch } from '../../../lib/apiClient';
import { Button } from '../../../ui/Button';
import { Dialog } from '../../../ui/Dialog';

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
      <div>
        <h1>Verification queue</h1>
        <p>
          Only an admin verifies a teacher. Your account does not hold that role, so there is
          nothing to show here.
        </p>
        <p>
          <Link to="/collections">Return to the collections.</Link>
        </p>
      </div>
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
  const { data, isLoading, isError } = useQuery({
    queryKey: ['teachers', 'unverified'],
    queryFn: () => apiFetch('/teachers/unverified', queueSchema),
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
    <div>
      <h1>Verification queue</h1>
      {error ? (
        <State title="The queue needs attention">
          <p>{error}</p>
        </State>
      ) : null}
      {isLoading ? (
        <State title="Loading the queue" quiet>
          <p>Reading the waiting teachers.</p>
        </State>
      ) : null}
      {isError || (!isLoading && !data) ? (
        <State title="The queue could not be loaded">
          <p>Try again.</p>
        </State>
      ) : null}
      {data && data.length === 0 ? (
        <State title="No teacher waits" quiet>
          <p>Every application has an answer.</p>
        </State>
      ) : null}
      {data && data.length > 0 ? (
        <ul>
          {data.map((teacher) => (
            <li key={teacher.user_id}>
              {teacher.full_name} — {teacher.email}
              {teacher.institution ? ` — ${teacher.institution}` : null}
              {teacher.specialization ? ` — ${teacher.specialization}` : null}{' '}
              <Button
                type="button"
                variant="primary"
                disabled={verifying === teacher.user_id}
                onClick={() => handleVerify(teacher.user_id)}
              >
                Verify
              </Button>{' '}
              <Button
                type="button"
                variant="destructive"
                disabled={verifying === teacher.user_id}
                onClick={() => setDeclining({ id: teacher.user_id, name: teacher.full_name })}
              >
                Decline
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      <Dialog
        open={declining !== null}
        title={`Decline ${declining?.name ?? 'this teacher'}?`}
        onClose={() => setDeclining(null)}
        actions={
          <>
            <Button variant="default" onClick={() => setDeclining(null)}>
              Keep the application
            </Button>
            <Button
              variant="destructive"
              disabled={verifying !== null}
              onClick={() => declining && handleDecline(declining.id)}
            >
              Decline it
            </Button>
          </>
        }
      >
        <p>
          Declining ends this application. Their existing circles keep running, and they keep
          building sets, writing notes, and reviewing — only new circles stay closed.
        </p>
      </Dialog>
    </div>
  );
}
