import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router';
import {
  ArrowRight,
  BookOpen,
  ChartColumn,
  GraduationCap,
  NotebookPen,
  Search,
} from 'lucide-react';
import { useState } from 'react';
import { z } from 'zod';
import { useAuth } from '../../auth/AuthContext';
import { apiFetch } from '../../lib/apiClient';

const collectionSchema = z.object({
  collection_id: z.number(),
  slug: z.string(),
  title_ar: z.string(),
  title_en: z.string().nullable(),
  hadith_count: z.coerce.number(),
});
const collectionsSchema = z.array(collectionSchema);

export const Route = createFileRoute('/_authed/')({
  component: DashboardPage,
});

function DashboardPage() {
  const { state } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const collections = useQuery({
    queryKey: ['collections'],
    queryFn: () => apiFetch('/collections', collectionsSchema),
    staleTime: Number.POSITIVE_INFINITY,
  });
  const name = state.status === 'signed-in' ? state.user.full_name : '';

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Good to see you{name ? `, ${name}` : ''}.</h1>
          <p className="text-muted-foreground">
            Search the corpus, or pick up your study where it stopped.
          </p>
        </div>
        <form
          className="flex w-full max-w-xl gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void navigate({ to: '/search', search: { q, offset: 0 } });
          }}
        >
          <Field className="flex-1">
            <FieldLabel htmlFor="dashboard-search">Search the Arabic text</FieldLabel>
            <Input
              id="dashboard-search"
              type="search"
              dir="rtl"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="ابحث في متن الحديث…"
            />
          </Field>
          <Button type="submit" variant="default" className="self-end">
            <Search data-icon="inline-start" />
            Search
          </Button>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Circles</CardTitle>
            <CardDescription>Join a halaqa, take assignments, record reviews.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link to="/circles">
                Open circles <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Study sets</CardTitle>
            <CardDescription>Collect hadiths into sets a teacher can assign.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link to="/sets">
                Open sets <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
            <CardDescription>Everything you wrote, grouped by hadith.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/notes">
                <NotebookPen data-icon="inline-start" />
                Open notes
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/analytics">
                <ChartColumn data-icon="inline-start" />
                Analytics
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <BookOpen className="size-5" />
          Collections
        </h2>
        {collections.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1].map((n) => (
              <Card key={n}>
                <CardHeader>
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                </CardHeader>
              </Card>
            ))}
          </div>
        ) : collections.isError || !collections.data ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>The collections could not be loaded</EmptyTitle>
              <EmptyDescription>Try again. The corpus may be unreachable.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {collections.data.map((collection) => (
              <Card key={collection.collection_id}>
                <CardHeader>
                  <CardTitle>
                    <Link
                      to="/collections/$slug"
                      params={{ slug: collection.slug }}
                      className="hover:underline"
                    >
                      <span>{collection.title_en ?? collection.title_ar}</span>
                      {collection.title_en ? (
                        <span dir="rtl" lang="ar" className="font-arabic">
                          {' '}
                          {collection.title_ar}
                        </span>
                      ) : null}
                    </Link>
                  </CardTitle>
                  <CardDescription>{collection.hadith_count} hadiths</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to="/collections/$slug" params={{ slug: collection.slug }}>
                      Browse chapters <ArrowRight data-icon="inline-end" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          <GraduationCap className="mr-1 inline size-4" />
          Teachers run the study loop from Circles; students join, complete assignments, and log
          reviews.
        </p>
      </section>
    </div>
  );
}
