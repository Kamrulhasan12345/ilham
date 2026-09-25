import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { PageHeader } from '../../app/PageHeader';
import { AssignmentItems, RecentItems, StudyStats } from '../../app/StudyLists';
import { UserAvatar } from '../../app/UserAvatar';
import { Heatmap, bucketSessionsByDay } from '../../domain/Heatmap';
import { apiFetch } from '../../lib/apiClient';
import { recentlyStudied, useAssignments, useMyProgress, useReviewSessions } from '../../lib/study';

const meSchema = z.object({
  user_id: z.number(),
  role: z.string(),
  full_name: z.string(),
  email: z.string(),
  is_verified: z.boolean().optional(),
});

type Account = z.infer<typeof meSchema>;

export const Route = createFileRoute('/_authed/me')({
  component: AccountPage,
});

/** My study, at a glance: who I am, what I have done, what I owe, and what
    I touched last. Account options (appearance, password) live in Settings;
    this page is the dashboard. */
function AccountPage() {
  const me = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => apiFetch('/auth/me', meSchema),
    staleTime: Number.POSITIVE_INFINITY,
  });

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

  return <Dashboard userId={me.data.user_id} account={me.data} />;
}

const ROLE_LABELS: Record<string, string> = {
  student: 'Student',
  teacher: 'Teacher',
  admin: 'Admin',
};

function ProfileCard({ account }: { account: Account }) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4">
        <UserAvatar name={account.full_name} className="size-14" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="font-heading text-lg font-semibold">{account.full_name}</p>
          <p className="truncate text-sm text-muted-foreground">{account.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">{ROLE_LABELS[account.role] ?? account.role}</Badge>
          {account.role === 'teacher' ? (
            account.is_verified === true ? (
              <Badge>Verified, circles open</Badge>
            ) : (
              <Badge variant="outline">Waiting for review</Badge>
            )
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard({ userId, account }: { userId: number; account: Account }) {
  const isStudent = account.role === 'student';
  const sessions = useReviewSessions();
  const assignments = useAssignments();
  const progress = useMyProgress(isStudent);
  const recent = recentlyStudied(progress.data ?? [], 8);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My progress"
        description="What you have done, what you owe, and what you touched last."
      />
      <ProfileCard account={account} />
      {account.role === 'teacher' && account.is_verified !== true ? (
        <p className="text-sm text-muted-foreground">
          You can build study sets, write notes, and review students. You cannot open a circle until
          an admin verifies your account.
        </p>
      ) : null}
      <StudyStats userId={userId} isStudent={isStudent} />
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Study days</h2>
          </CardTitle>
          <CardDescription>Each square is one day of review sittings</CardDescription>
        </CardHeader>
        <CardContent>
          {sessions.isLoading ? (
            <Skeleton className="h-28 w-full" />
          ) : sessions.isError ? (
            <p className="text-sm text-muted-foreground">The activity could not be loaded.</p>
          ) : (
            <Heatmap
              days={bucketSessionsByDay((sessions.data ?? []).map((s) => s.created_at))}
              label="My study activity"
            />
          )}
        </CardContent>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>{isStudent ? 'My assignments' : 'Assignments'}</h2>
            </CardTitle>
            <CardDescription>Everything assigned to your circles</CardDescription>
          </CardHeader>
          <CardContent>
            {assignments.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : assignments.isError ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyTitle>The assignments could not be loaded</EmptyTitle>
                  <EmptyDescription>Try again.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (assignments.data ?? []).length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyTitle>Nothing assigned</EmptyTitle>
                  <EmptyDescription>Your teacher assigns work to your circles.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <AssignmentItems
                assignments={assignments.data ?? []}
                studentId={isStudent ? userId : null}
              />
            )}
          </CardContent>
        </Card>
        {isStudent ? (
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Recently studied</h2>
              </CardTitle>
              <CardDescription>Mastery runs from 0 to 4</CardDescription>
            </CardHeader>
            <CardContent>
              {progress.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : progress.isError ? (
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyTitle>The history could not be loaded</EmptyTitle>
                    <EmptyDescription>Try again.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : recent.length === 0 ? (
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyTitle>Nothing studied yet</EmptyTitle>
                    <EmptyDescription>
                      Record your first review to start the history.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <RecentItems rows={recent} />
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
