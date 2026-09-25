import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link, createFileRoute } from '@tanstack/react-router';
import { ArrowDownWideNarrow, ChevronRight, GitCompareArrows, Scale, Trophy } from 'lucide-react';
import { PageHeader } from '../../../app/PageHeader';

export const Route = createFileRoute('/_authed/analytics/')({
  component: AnalyticsIndexPage,
});

const QUESTIONS = [
  {
    to: '/analytics/top-narrators',
    question: 'Who carries the corpus?',
    note: 'The narrators behind the most chain positions.',
    icon: Trophy,
  },
  {
    to: '/analytics/contested',
    question: 'Where do the two scholars disagree?',
    note: 'Narrators Ibn Hajar and al-Dhahabi graded apart.',
    icon: Scale,
  },
  {
    to: '/analytics/shared',
    question: 'What do two hadiths share?',
    note: 'The narrators standing in both chains.',
    icon: GitCompareArrows,
  },
  {
    to: '/analytics/weakest-chains',
    question: 'Which chains score lowest?',
    note: 'Hadiths sorted up by chain strength.',
    icon: ArrowDownWideNarrow,
  },
] as const;

/** A card for each question. The card title is the question, not the
    table name. */
function AnalyticsIndexPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analytics"
        description="Questions the corpus can answer. Every number here comes straight from the database."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {QUESTIONS.map((item) => (
          <Card key={item.to} className="transition-shadow hover:shadow-md">
            <Link to={item.to} className="hover:no-underline">
              <CardHeader>
                <CardTitle>{item.question}</CardTitle>
                <CardDescription>{item.note}</CardDescription>
                <CardAction>
                  <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <item.icon className="size-5" />
                  </span>
                </CardAction>
              </CardHeader>
              <div className="flex items-center justify-end gap-1 px-4 pt-4 text-sm font-medium text-primary">
                Open
                <ChevronRight className="size-4" />
              </div>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
