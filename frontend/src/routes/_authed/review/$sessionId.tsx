import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { z } from 'zod';
import { useAuth } from '../../../auth/AuthContext';
import { State } from '../../../domain/State';
import { ApiError, apiFetch } from '../../../lib/apiClient';
import { Button } from '../../../ui/Button';
import { Seg } from '../../../ui/Seg';
import { Table } from '../../../ui/Table';
import { toast } from '../../../ui/Toast';

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
      toast(`Session saved: ${list.length} verdicts, one transaction.`);
      await router.navigate({
        to: '/review/$sessionId',
        params: { sessionId: String(created.session_id) },
      });
    } catch (err) {
      toast(
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
      <State title="No review to run" quiet>
        <p>
          A review starts from an assignment, with a student. Open an assignment and start there.
        </p>
      </State>
    );
  }
  if (assignment.isLoading || items.isLoading) {
    return (
      <State title="Loading the review" quiet>
        <p>Reading the assignment's hadiths.</p>
      </State>
    );
  }
  if (assignment.isError || items.isError || !assignment.data || !items.data) {
    return (
      <State title="This review could not be loaded">
        <p>Try again.</p>
      </State>
    );
  }

  return (
    <div>
      <h1>Review</h1>
      <p className="label">
        {`Hadith ${decided} of ${list.length}. Nothing is saved until you finish — one message for the session, never a tick per hadith.`}
      </p>
      <ol>
        {list.map((item, i) => (
          <li key={item.hadith_id}>
            <p>{`Hadith ${i + 1} of ${list.length}:`}</p>
            <p>
              <Link to="/hadiths/$hadithId" params={{ hadithId: String(item.hadith_id) }}>
                <span className="m">{item.hadith_num}</span>
              </Link>
            </p>
            <Seg<Verdict>
              label={`Verdict for hadith ${item.hadith_num}`}
              options={[
                { value: 'pass', label: 'Passed' },
                { value: 'partial', label: 'Partial' },
                { value: 'fail', label: 'Not yet' },
              ]}
              value={verdicts[item.hadith_id] ?? null}
              onChange={(next) => setVerdicts((prev) => ({ ...prev, [item.hadith_id]: next }))}
            />
          </li>
        ))}
      </ol>
      <Button
        type="button"
        variant="primary"
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
    return (
      <State title="Loading the session" quiet>
        <p>Reading its verdicts.</p>
      </State>
    );
  }
  if (session.isError || !session.data) {
    return (
      <State title="This session could not be loaded">
        <p>Try again.</p>
      </State>
    );
  }

  const data = session.data;
  return (
    <div>
      <h1>
        Review session <span className="m m--bare">{`[${data.session_id}]`}</span>
      </h1>
      <p className="label">
        Recorded {data.created_at}.{data.reviewer_id === null ? ' A self-review: no reviewer.' : ''}
      </p>
      <Table caption="One row per hadith reviewed in this sitting.">
        <thead>
          <tr>
            <th scope="col">Hadith</th>
            <th scope="col">Verdict</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item) => (
            <tr key={item.hadith_id}>
              <td>
                <Link to="/hadiths/$hadithId" params={{ hadithId: String(item.hadith_id) }}>
                  <span className="m m--bare">{`[${item.hadith_id}]`}</span>
                </Link>
              </td>
              <td>
                {item.result === 'pass'
                  ? 'Passed'
                  : item.result === 'partial'
                    ? 'Partial'
                    : 'Not yet'}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
