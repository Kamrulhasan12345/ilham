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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, createFileRoute, useRouter } from '@tanstack/react-router';
import { CircleCheck, CircleDashed, CircleX } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
import { PageHeader } from '../../../app/PageHeader';
import { StatCard } from '../../../app/StatCard';
import { useAuth } from '../../../auth/AuthContext';
import { ApiError, apiFetch } from '../../../lib/apiClient';

const sessionSchema = z.object({
  session_id: z.number(),
  student_id: z.number(),
  reviewer_id: z.number().nullable(),
  circle_id: z.number().nullable(),
  created_at: z.string(),
  items: z.array(z.object({ hadith_id: z.number(), result: z.string() })),
});
const assignmentSchema = z.object({
  assignment_id: z.number(),
  circle_id: z.number(),
  study_set_id: z.number(),
});
const setItemsSchema = z.object({
  items: z.array(
    z.object({ hadith_id: z.number(), hadith_num: z.string(), text_plain: z.string() }),
  ),
});

const searchParamsSchema = z.object({
  student_id: z.coerce.string().catch(''),
  assignment_id: z.coerce.string().catch(''),
});
type Verdict = 'pass' | 'partial' | 'fail';

export const Route = createFileRoute('/_authed/review/$sessionId')({
  validateSearch: searchParamsSchema,
  component: ReviewPage,
});

function ReviewPage() {
  const { sessionId } = Route.useParams();
  if (sessionId === 'new') return <ReviewRunner />;
  return <ReviewRecord sessionId={sessionId} />;
}

/** One sitting, one transaction. Nothing is saved until the runner
    finishes; then the session row, every result row, and the progress
    updates write together. */
function ReviewRunner() {
  const { student_id, assignment_id } = Route.useSearch();
  const { state } = useAuth();
  const router = useRouter();
  const [verdicts, setVerdicts] = useState<Record<number, Verdict>>({});
  const [busy, setBusy] = useState(false);

  const studentId = Number(student_id);
  const assignmentId = Number(assignment_id);
  const ready =
    Number.isInteger(studentId) &&
    studentId > 0 &&
    Number.isInteger(assignmentId) &&
    assignmentId > 0;

  const assignment = useQuery({
    queryKey: ['assignments', assignment_id],
    queryFn: () => apiFetch(`/assignments/${assignmentId}`, assignmentSchema),
    enabled: ready,
  });
  const items = useQuery({
    queryKey: ['sets', assignment.data?.study_set_id, 'items'],
    queryFn: () => apiFetch(`/sets/${assignment.data?.study_set_id}`, setItemsSchema),
    enabled: ready && assignment.data !== undefined,
  });

  const list = items.data?.items ?? [];
  const decided = list.filter((item) => verdicts[item.hadith_id] !== undefined).length;

  async function handleSubmit() {
    if (state.status !== 'signed-in') return;
    if (decided !== list.length) return;
    setBusy(true);
    try {
      const created = await apiFetch('/review-sessions', z.object({ session_id: z.number() }), {
        method: 'POST',
        body: {
          student_id: studentId,
          circle_id: assignment.data?.circle_id ?? null,
          assignment_id: assignmentId,
          items: list.map((item) => ({
            hadith_id: item.hadith_id,
            result: verdicts[item.hadith_id] as Verdict,
          })),
        },
      });
      toast.success(`Session saved: ${list.length} verdicts, one transaction.`);
      await router.navigate({
        to: '/review/$sessionId',
        params: { sessionId: String(created.session_id) },
      });
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : 'Nothing was recorded — the verdicts are still on screen. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No review to run</EmptyTitle>
          <EmptyDescription>
            A review starts from an assignment, with a student. Open an assignment and start there.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  if (assignment.isLoading || items.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (assignment.isError || items.isError || !assignment.data || !items.data) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>This review could not be loaded</EmptyTitle>
          <EmptyDescription>Try again.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Review"
        description="Nothing is saved until you finish: one message for the session, never a tick per hadith."
      />
      <Card className="sticky top-16 z-[5] shadow-md">
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{`Hadith ${decided} of ${list.length}`}</span>
            <span className="text-muted-foreground tabular-nums">
              {list.length === 0 ? 0 : Math.round((decided / list.length) * 100)}%
            </span>
          </div>
          <Progress value={list.length === 0 ? 0 : (decided / list.length) * 100} />
        </CardContent>
      </Card>
      <ol className="flex flex-col gap-4">
        {list.map((item, i) => (
          <li key={item.hadith_id}>
            <Card
              className={verdicts[item.hadith_id] !== undefined ? 'ring-primary/40' : undefined}
            >
              <CardHeader>
                <CardDescription>{`Hadith ${i + 1} of ${list.length}:`}</CardDescription>
                <CardTitle>
                  <Link
                    to="/hadiths/$hadithId"
                    params={{ hadithId: String(item.hadith_id) }}
                    className="tabular-nums hover:underline"
                  >
                    {item.hadith_num}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p dir="rtl" lang="ar" className="font-arabic text-xl leading-loose">
                  {item.text_plain.length > 240
                    ? `${item.text_plain.slice(0, 240)}…`
                    : item.text_plain}
                </p>
                <ToggleGroup
                  type="single"
                  variant="outline"
                  value={verdicts[item.hadith_id] ?? ''}
                  onValueChange={(next) =>
                    next && setVerdicts((prev) => ({ ...prev, [item.hadith_id]: next as Verdict }))
                  }
                  aria-label={`Verdict for hadith ${item.hadith_num}`}
                >
                  <ToggleGroupItem value="pass" aria-label="Passed">
                    <CircleCheck data-icon="inline-start" />
                    Passed
                  </ToggleGroupItem>
                  <ToggleGroupItem value="partial" aria-label="Partial">
                    <CircleDashed data-icon="inline-start" />
                    Partial
                  </ToggleGroupItem>
                  <ToggleGroupItem value="fail" aria-label="Not yet">
                    <CircleX data-icon="inline-start" />
                    Not yet
                  </ToggleGroupItem>
                </ToggleGroup>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
      <div className="sticky bottom-4 flex justify-end">
        <Button
          type="button"
          size="lg"
          className="shadow-lg"
          disabled={busy || list.length === 0 || decided !== list.length}
          onClick={handleSubmit}
        >
          {busy
            ? 'Saving…'
            : decided !== list.length
              ? `Decide every hadith first — ${decided} of ${list.length} decided`
              : `Finish — save ${list.length} verdicts`}
        </Button>
      </div>
    </div>
  );
}

function ReviewRecord({ sessionId }: { sessionId: string }) {
  const { state } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const session = useQuery({
    queryKey: ['review-sessions', sessionId],
    queryFn: () => apiFetch(`/review-sessions/${sessionId}`, sessionSchema),
  });

  if (session.isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }
  if (session.isError || !session.data) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>This session could not be loaded</EmptyTitle>
          <EmptyDescription>Try again.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const data = session.data;
  // Same authorship rule the backend enforces: a teacher deletes the sessions
  // they recorded, a student deletes their own self-logs, an admin deletes
  // anything. Anyone else never sees the button.
  const canDelete =
    state.status === 'signed-in' &&
    (state.user.role === 'admin' ||
      (state.user.role === 'teacher' && data.reviewer_id === state.user.user_id) ||
      (state.user.role === 'student' &&
        data.student_id === state.user.user_id &&
        data.reviewer_id === null));

  async function deleteSession() {
    setBusy(true);
    try {
      await apiFetch(`/review-sessions/${sessionId}`, z.unknown(), { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: ['review-sessions'] });
      toast.success('Session deleted. The progress it touched was rebuilt.');
      if (data.circle_id === null) {
        await router.navigate({ to: '/circles' });
      } else {
        await router.navigate({
          to: '/circles/$circleId',
          params: { circleId: String(data.circle_id) },
        });
      }
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : 'Could not delete the session. Try again.',
      );
      setBusy(false);
      setConfirmingDelete(false);
    }
  }

  const count = (result: string) => data.items.filter((item) => item.result === result).length;
  const VERDICTS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> =
    {
      pass: { label: 'Passed', variant: 'default' },
      partial: { label: 'Partial', variant: 'secondary' },
      fail: { label: 'Not yet', variant: 'outline' },
    };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={
          <>
            Review session <span className="tabular-nums">{data.session_id}</span>
          </>
        }
        description={`Recorded ${new Date(data.created_at).toLocaleString('en', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })}.${data.reviewer_id === null ? ' A self-review: no reviewer.' : ''}`}
        actions={
          canDelete ? (
            <Button variant="destructive" disabled={busy} onClick={() => setConfirmingDelete(true)}>
              Delete this session
            </Button>
          ) : null
        }
      />
      <section className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Passed" value={count('pass')} icon={CircleCheck} />
        <StatCard label="Partial" value={count('partial')} icon={CircleDashed} />
        <StatCard label="Not yet" value={count('fail')} icon={CircleX} />
      </section>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Verdicts</h2>
          </CardTitle>
          <CardDescription>One row per hadith in the sitting</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hadith</TableHead>
                <TableHead>Verdict</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => {
                const verdict = VERDICTS[item.result] ?? VERDICTS.fail;
                return (
                  <TableRow key={item.hadith_id}>
                    <TableCell>
                      <Link
                        to="/hadiths/$hadithId"
                        params={{ hadithId: String(item.hadith_id) }}
                        className="tabular-nums hover:underline"
                      >
                        {item.hadith_id}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={verdict.variant}>{verdict.label}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>
              The session and its verdicts go away, and the progress they touched is rebuilt from
              the remaining sessions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSession}>Delete it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
