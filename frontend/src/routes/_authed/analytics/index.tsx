import { Link, createFileRoute } from '@tanstack/react-router';

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
    <div>
      <h1>Analytics</h1>
      <ul>
        {QUESTIONS.map((item) => (
          <li key={item.to}>
            <Link to={item.to}>{item.question}</Link>
            <p className="label">{item.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
