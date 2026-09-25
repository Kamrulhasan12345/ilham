import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  ChartColumn,
  ChevronRight,
  GraduationCap,
  Layers,
  Library,
  NotebookPen,
  Search,
} from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { useAuth } from '../auth/AuthContext';
import { Heatmap, bucketSessionsByDay } from '../domain/Heatmap';
import { apiFetch } from '../lib/apiClient';
import { recentlyStudied, useAssignments, useMyProgress, useReviewSessions } from '../lib/study';
import { GeoPattern } from './Showcase';
import { AssignmentItems, RecentItems, StudyStats } from './StudyLists';

const collectionsSchema = z.array(
  z.object({
    collection_id: z.number(),
    slug: z.string(),
    title_ar: z.string(),
    title_en: z.string().nullable(),
    hadith_count: z.coerce.number(),
  }),
);

const SHORTCUTS = [
  { to: '/circles', label: 'Circles', body: 'Your halaqas and their members', icon: GraduationCap },
  { to: '/sets', label: 'Study sets', body: 'Hadiths grouped for study', icon: Layers },
  { to: '/notes', label: 'Notes', body: 'Everything you wrote, by hadith', icon: NotebookPen },
  {
    to: '/analytics',
    label: 'Analytics',
    body: 'Grades and chains across the corpus',
    icon: ChartColumn,
  },
] as const;

export function DashboardPage() {
  const { state } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const user = state.status === 'signed-in' ? state.user : null;
  const isStudent = user?.role === 'student';
  const firstName = user?.full_name.split(/\s+/)[0] ?? '';

  const collections = useQuery({
    queryKey: ['collections'],
    queryFn: () => apiFetch('/collections', collectionsSchema),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const assignments = useAssignments();
  const sessions = useReviewSessions();
  const progress = useMyProgress(isStudent);
  const upNext = [...(assignments.data ?? [])]
    .sort((a, b) => (a.due_date < b.due_date ? -1 : 1))
    .slice(0, 4);
  const recent = recentlyStudied(progress.data ?? [], 4);

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground md:p-10">
        <GeoPattern className="text-primary-foreground/15 [mask-image:linear-gradient(to_left,black,transparent_70%)]" />
        <div className="relative flex max-w-xl flex-col gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
              Good to see you{firstName ? `, ${firstName}` : ''}.
            </h1>
            <p className="text-primary-foreground/85">
              Search the corpus, or pick up your study where it stopped.
            </p>
          </div>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void navigate({ to: '/search', search: { q, offset: 0 } });
            }}
          >
            <Field className="flex-1">
              <FieldLabel htmlFor="dashboard-search" className="sr-only">
                Search the Arabic text
              </FieldLabel>
              <InputGroup className="bg-background text-foreground">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  id="dashboard-search"
                  type="search"
                  dir="rtl"
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder="ابحث في متن الحديث…"
                />
              </InputGroup>
            </Field>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>
        </div>
      </section>

      {user ? <StudyStats userId={user.user_id} isStudent={isStudent} /> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Up next</h2>
              </CardTitle>
              <CardDescription>Assignments from your circles, soonest first</CardDescription>
              <CardAction>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/me">
                    View all <ChevronRight data-icon="inline-end" />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {assignments.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : upNext.length === 0 ? (
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyTitle>Nothing assigned</EmptyTitle>
                    <EmptyDescription>
                      {isStudent
                        ? 'Your teacher assigns work to your circles.'
                        : 'Assign a study set from one of your circles.'}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <AssignmentItems
                  assignments={upNext}
                  studentId={isStudent && user ? user.user_id : null}
                />
              )}
            </CardContent>
          </Card>

          {isStudent ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2>Continue studying</h2>
                </CardTitle>
                <CardDescription>The hadiths you touched last</CardDescription>
              </CardHeader>
              <CardContent>
                {progress.isLoading ? (
                  <Skeleton className="h-32 w-full" />
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

          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Collections</h2>
              </CardTitle>
              <CardDescription>Browse the corpus by book and chapter</CardDescription>
            </CardHeader>
            <CardContent>
              {collections.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : collections.isError || !collections.data ? (
                <Empty className="border">
                  <EmptyHeader>
                    <EmptyTitle>The collections could not be loaded</EmptyTitle>
                    <EmptyDescription>Try again. The corpus may be unreachable.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <ItemGroup className="grid gap-3 sm:grid-cols-2">
                  {collections.data.map((c) => (
                    <Item key={c.collection_id} variant="outline" asChild>
                      <Link to="/collections/$slug" params={{ slug: c.slug }}>
                        <ItemMedia
                          variant="icon"
                          className="size-10 rounded-lg bg-primary/10 text-primary"
                        >
                          <Library />
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>
                            {c.title_en ?? c.title_ar}
                            {c.title_en ? (
                              <span dir="rtl" lang="ar" className="font-arabic font-normal">
                                {c.title_ar}
                              </span>
                            ) : null}
                          </ItemTitle>
                          <ItemDescription>
                            {c.hadith_count.toLocaleString('en')} hadiths
                          </ItemDescription>
                        </ItemContent>
                        <ItemActions>
                          <ChevronRight className="size-4 text-muted-foreground" />
                        </ItemActions>
                      </Link>
                    </Item>
                  ))}
                </ItemGroup>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
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
              ) : (
                <Heatmap
                  days={bucketSessionsByDay(
                    (sessions.data ?? []).map((s) => s.created_at),
                    12,
                  )}
                  label="My study activity"
                />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>
                <h2>Shortcuts</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ItemGroup className="gap-1">
                {SHORTCUTS.map((s) => (
                  <Item key={s.to} size="sm" asChild>
                    <Link to={s.to}>
                      <ItemMedia variant="icon" className="size-8 rounded-lg bg-muted">
                        <s.icon />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>{s.label}</ItemTitle>
                        <ItemDescription>{s.body}</ItemDescription>
                      </ItemContent>
                    </Link>
                  </Item>
                ))}
              </ItemGroup>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
