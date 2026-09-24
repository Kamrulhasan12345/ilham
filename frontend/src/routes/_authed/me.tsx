import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute, useRouter } from '@tanstack/react-router';
import { CircleUserRound } from 'lucide-react';
import { z } from 'zod';
import { useAuth } from '../../auth/AuthContext';
import { apiFetch } from '../../lib/apiClient';

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
    return <Skeleton className="h-48 w-full max-w-md" />;
  }
  if (me.isError || !me.data) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>The account could not be loaded</EmptyTitle>
          <EmptyDescription>Try again.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const account = me.data;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <CircleUserRound className="size-6" />
          Account
        </h1>
      </div>
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle className="text-base">{account.full_name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-muted-foreground">Email</span>
            <span>{account.email}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-muted-foreground">Role</span>
            <span>
              {account.role === 'student'
                ? 'Student'
                : account.role === 'teacher'
                  ? 'Teacher'
                  : 'Admin'}
            </span>
          </div>
          {account.role === 'teacher' ? (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-muted-foreground">Verification</span>
              <span>
                {account.is_verified === true ? (
                  <Badge>Verified — circles open</Badge>
                ) : (
                  <Badge variant="secondary">
                    Waiting for review. You can build study sets, write notes, and review students.
                    You cannot open a circle yet.
                  </Badge>
                )}
              </span>
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSignOut}>
              Sign out
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/collections">Back to the collections</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
