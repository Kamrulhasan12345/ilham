import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { useAuth } from '../../../auth/AuthContext';
import { ApiError, apiFetch } from '../../../lib/apiClient';
import { Button } from '../../../ui/Button';

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

  // Verifying is not destructive and needs no dialogue (§7.23). There is no
  // decline control because the API offers no decline endpoint.
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

  return (
    <div>
      <h1>Verification queue</h1>
      {error ? <p>{error}</p> : null}
      {isLoading ? <p>Loading the queue…</p> : null}
      {isError || (!isLoading && !data) ? <p>The queue could not be loaded. Try again.</p> : null}
      {data && data.length === 0 ? <p>No teacher waits for review.</p> : null}
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
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
