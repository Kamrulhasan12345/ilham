import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';
import { z } from 'zod';
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
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Review</h1>
        <p className="text-muted-foreground">
          {`Hadith ${decided} of ${list.length}. Nothing is saved until you finish — one message for the session, never a tick per hadith.`}
        </p>
        <Progress value={list.length === 0 ? 0 : (decided / list.length) * 100} className="mt-2" />
      </div>
      <ol className="flex flex-col gap-3">
        {list.map((item, i) => (
          <li key={item.hadith_id}>
            <Card>
              <CardContent>
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-muted-foreground">{`Hadith ${i + 1} of ${list.length}:`}</p>
                  <p>
                    <Link
                      to="/hadiths/$hadithId"
                      params={{ hadithId: String(item.hadith_id) }}
                      className="font-mono tabular-nums hover:underline"
                    >
                      {item.hadith_num}
                    </Link>
                  </p>
                  <ToggleGroup
                    type="single"
                    value={verdicts[item.hadith_id] ?? ''}
                    onValueChange={(next) =>
                      next &&
                      setVerdicts((prev) => ({ ...prev, [item.hadith_id]: next as Verdict }))
                    }
                    aria-label={`Verdict for hadith ${item.hadith_num}`}
                  >
                    <ToggleGroupItem value="pass" aria-label="Passed">
                      Passed
                    </ToggleGroupItem>
                    <ToggleGroupItem value="partial" aria-label="Partial">
                      Partial
                    </ToggleGroupItem>
                    <ToggleGroupItem value="fail" aria-label="Not yet">
                      Not yet
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
      <Button
        type="button"
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
  );
}

function ReviewRecord({ sessionId }: { sessionId: string }) {
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
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">
          Review session <span className="font-mono tabular-nums">{data.session_id}</span>
        </h1>
        <p className="text-muted-foreground">
          Recorded {data.created_at}.
          {data.reviewer_id === null ? ' A self-review: no reviewer.' : ''}
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Hadith</TableHead>
            <TableHead>Verdict</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.items.map((item) => (
            <TableRow key={item.hadith_id}>
              <TableCell>
                <Link
                  to="/hadiths/$hadithId"
                  params={{ hadithId: String(item.hadith_id) }}
                  className="font-mono tabular-nums hover:underline"
                >
                  {item.hadith_id}
                </Link>
              </TableCell>
              <TableCell>
                {item.result === 'pass'
                  ? 'Passed'
                  : item.result === 'partial'
                    ? 'Partial'
                    : 'Not yet'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
