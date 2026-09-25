import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { Progress } from '@/components/ui/progress';
import { Link } from '@tanstack/react-router';
import { BookOpenText, CalendarDays, CheckCheck, Flame, GraduationCap, Layers } from 'lucide-react';
import { bucketSessionsByDay } from '../domain/Heatmap';
import { dueStateFor } from '../lib/due';
import {
  type Assignment,
  MASTERY_MAX,
  type Progress as ProgressRow,
  useAssignments,
  useCircles,
  useReviewSessions,
  useStudentStats,
} from '../lib/study';
import { StatCard } from './StatCard';

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short' });
}

/** The four headline numbers for the signed-in user. */
export function StudyStats({ userId, isStudent }: { userId: number; isStudent: boolean }) {
  const stats = useStudentStats(userId, isStudent);
  const sessions = useReviewSessions();
  const assignments = useAssignments();
  const circles = useCircles();

  const studyDays = bucketSessionsByDay((sessions.data ?? []).map((s) => s.created_at)).filter(
    (d) => d.count > 0,
  ).length;
  const states = (assignments.data ?? []).map((a) => dueStateFor(a.due_date.slice(0, 10)));
  const overdue = states.filter((s) => s === 'overdue').length;
  const dueSoon = states.filter((s) => s === 'due soon').length;

  return (
    <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {isStudent ? (
        <>
          <StatCard
            label="Mastered"
            value={stats.data?.mastered_count ?? 0}
            hint="Hadiths at mastery 3 or more"
            icon={CheckCheck}
          />
          <StatCard
            label="Reviews"
            value={stats.data?.review_count ?? 0}
            hint="Reviews recorded so far"
            icon={BookOpenText}
          />
        </>
      ) : (
        <>
          <StatCard
            label="Circles"
            value={circles.data?.length ?? 0}
            hint="Circles you lead"
            icon={GraduationCap}
          />
          <StatCard
            label="Review sittings"
            value={sessions.data?.length ?? 0}
            hint="Sittings you recorded"
            icon={BookOpenText}
          />
        </>
      )}
      <StatCard
        label="Due this week"
        value={dueSoon}
        hint={overdue > 0 ? `${overdue} overdue` : 'Nothing overdue'}
        icon={CalendarDays}
      />
      <StatCard label="Study days" value={studyDays} hint="In the last 16 weeks" icon={Flame} />
    </section>
  );
}

/** Assignment rows: the set, its circle, the due state, and a review link for students. */
export function AssignmentItems({
  assignments,
  studentId,
}: {
  assignments: Assignment[];
  studentId: number | null;
}) {
  const circles = useCircles();
  const circleNames = new Map((circles.data ?? []).map((c) => [c.circle_id, c.name] as const));
  return (
    <ItemGroup>
      {assignments.map((a) => {
        const dueDay = a.due_date.slice(0, 10);
        const dueState = dueStateFor(dueDay);
        return (
          <Item key={a.assignment_id} variant="outline" size="sm">
            <ItemMedia variant="icon" className="size-9 rounded-lg bg-primary/10 text-primary">
              <Layers />
            </ItemMedia>
            <ItemContent>
              <ItemTitle>
                <Link
                  to="/sets/$setId"
                  params={{ setId: String(a.study_set_id) }}
                  className="hover:underline"
                >
                  Set {a.study_set_id}
                </Link>
              </ItemTitle>
              <ItemDescription>
                {circleNames.get(a.circle_id) ?? `Circle ${a.circle_id}`}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Badge variant={dueState === 'overdue' ? 'destructive' : 'secondary'}>
                {dueState}
              </Badge>
              <span className="hidden text-sm text-muted-foreground tabular-nums sm:inline">
                {shortDate(`${dueDay}T00:00:00`)}
              </span>
              {studentId !== null ? (
                <Button variant="outline" size="sm" asChild>
                  <Link
                    to="/review/$sessionId"
                    params={{ sessionId: 'new' }}
                    search={{
                      student_id: String(studentId),
                      assignment_id: String(a.assignment_id),
                    }}
                  >
                    Review
                  </Link>
                </Button>
              ) : null}
            </ItemActions>
          </Item>
        );
      })}
    </ItemGroup>
  );
}

/** Recently studied hadiths with their mastery on the 0–4 scale. */
export function RecentItems({ rows }: { rows: ProgressRow[] }) {
  return (
    <ItemGroup>
      {rows.map((p) => (
        <Item key={p.progress_id} variant="outline" size="sm">
          <ItemMedia variant="icon" className="size-9 rounded-lg bg-primary/10 text-primary">
            <BookOpenText />
          </ItemMedia>
          <ItemContent>
            <ItemTitle>
              <Link
                to="/hadiths/$hadithId"
                params={{ hadithId: String(p.hadith_id) }}
                className="hover:underline"
              >
                Hadith {p.hadith_id}
              </Link>
            </ItemTitle>
            <ItemDescription>
              Reviewed {p.times_reviewed} {p.times_reviewed === 1 ? 'time' : 'times'}
              {p.last_reviewed ? `, last on ${shortDate(p.last_reviewed)}` : ''}
            </ItemDescription>
          </ItemContent>
          <ItemActions className="w-32">
            <Progress
              value={(p.mastery / MASTERY_MAX) * 100}
              aria-label={`Mastery ${p.mastery} of ${MASTERY_MAX}`}
            />
            <span className="text-sm text-muted-foreground tabular-nums">
              {p.mastery}/{MASTERY_MAX}
            </span>
          </ItemActions>
        </Item>
      ))}
    </ItemGroup>
  );
}
