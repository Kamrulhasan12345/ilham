import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute, useRouter } from '@tanstack/react-router';
import { z } from 'zod';
import { useAuth } from '../../auth/AuthContext';
import { State } from '../../domain/State';
import { apiFetch } from '../../lib/apiClient';
import { Button } from '../../ui/Button';
import { Tag } from '../../ui/Tag';

const meSchema = z.object({
  user_id: z.number(),
  role: z.string(),
  full_name: z.string(),
  email: z.string(),
  is_verified: z.boolean().optional(),
});

export const Route = createFileRoute('/_authed/me')({
  component: AccountPage,
});

/** Who is signed in, and the way out. */
function AccountPage() {
  const { signOut } = useAuth();
  const router = useRouter();

  const me = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch('/auth/me', meSchema),
    staleTime: Number.POSITIVE_INFINITY,
  });

  async function handleSignOut() {
    await signOut();
    await router.navigate({ to: '/login' });
  }

  if (me.isLoading) {
    return (
      <State title="Loading the account" quiet>
        <p>Reading who is signed in.</p>
      </State>
    );
  }
  if (me.isError || !me.data) {
    return (
      <State title="The account could not be loaded">
        <p>Try again.</p>
      </State>
    );
  }

  const account = me.data;

  return (
    <div>
      <h1>Account</h1>
      <dl>
        <dt className="label">Name</dt>
        <dd>{account.full_name}</dd>
        <dt className="label">Email</dt>
        <dd>{account.email}</dd>
        <dt className="label">Role</dt>
        <dd>
          {account.role === 'student'
            ? 'Student'
            : account.role === 'teacher'
              ? 'Teacher'
              : 'Admin'}
        </dd>
        {account.role === 'teacher' ? (
          <>
            <dt className="label">Verification</dt>
            <dd>
              {account.is_verified === true ? (
                <Tag>Verified — circles open</Tag>
              ) : (
                <Tag accent>
                  Waiting for review. You can build study sets, write notes, and review students.
                  You cannot open a circle yet.
                </Tag>
              )}
            </dd>
          </>
        ) : null}
      </dl>
      <p>
        <Button variant="default" onClick={handleSignOut}>
          Sign out
        </Button>
      </p>
      <p className="label">
        <Link to="/collections">Return to the collections.</Link>
      </p>
    </div>
  );
}
