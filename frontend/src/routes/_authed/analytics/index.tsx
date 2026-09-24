import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link, createFileRoute } from '@tanstack/react-router';
import { ChartColumn } from 'lucide-react';

export const Route = createFileRoute('/_authed/analytics/')({
  component: AnalyticsIndexPage,
});

const QUESTIONS = [
  {
    to: '/analytics/top-narrators',
    question: 'Who carries the corpus?',
    note: 'The narrators behind the most chain positions.',
  },
  {
    to: '/analytics/contested',
    question: 'Where do the two scholars disagree?',
    note: 'Narrators Ibn Hajar and al-Dhahabi graded apart.',
  },
  {
    to: '/analytics/shared',
    question: 'What do two hadiths share?',
    note: 'The narrators standing in both chains.',
  },
  {
    to: '/analytics/weakest-chains',
    question: 'Which chains score lowest?',
    note: 'Hadiths sorted up by chain strength.',
  },
] as const;

/** A card for each question. The card title is the question, not the
    table name. */
function AnalyticsIndexPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <ChartColumn className="size-6" />
          Analytics
        </h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {QUESTIONS.map((item) => (
          <Card key={item.to}>
            <CardHeader>
              <CardTitle>
                <Link to={item.to} className="hover:underline">
                  {item.question}
                </Link>
              </CardTitle>
              <CardDescription>{item.note}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
