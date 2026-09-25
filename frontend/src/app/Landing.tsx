import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Link } from '@tanstack/react-router';
import {
  BookOpenText,
  CalendarCheck,
  ChevronDown,
  Link2,
  ListChecks,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { Brand } from './AuthLayout';
import { GeoPattern, Showcase, useCorpusCounts } from './Showcase';
import { ThemeSwitch } from './ThemeSwitch';

const FEATURES = [
  {
    icon: Link2,
    title: 'Full isnad chains',
    body: 'Every sanad is stored link by link, so you read a chain in the order it was passed on.',
  },
  {
    icon: Scale,
    title: 'Narrator grades',
    body: 'See how Ibn Hajar and al-Dhahabi graded each narrator, right beside the name.',
  },
  {
    icon: ShieldCheck,
    title: 'Chain strength',
    body: 'Each hadith gets a strength score from the weakest link in its best chain.',
  },
  {
    icon: BookOpenText,
    title: 'Arabic first',
    body: 'The Arabic text is canonical. An English translation sits beside it where one exists.',
  },
  {
    icon: ListChecks,
    title: 'Study sets',
    body: 'Teachers group hadiths into sets and assign them to a circle with a due date.',
  },
  {
    icon: CalendarCheck,
    title: 'Review and progress',
    body: 'Review sessions track what you have mastered, and a heatmap shows your study days.',
  },
];

const STEPS = [
  {
    title: 'A teacher opens a circle',
    body: 'Teachers sign up, and an admin verifies their ijaza or institution. Then they open a circle and add students.',
  },
  {
    title: 'The teacher assigns a study set',
    body: 'Pick hadiths into a set, then assign it to the circle with a due date.',
  },
  {
    title: 'Students study and review',
    body: 'Students read each hadith with its chain, mark their progress, and review. The teacher sees who is on track.',
  },
];

/** The signed-out front page. Colours are preset tokens only. */
export function Landing() {
  const corpus = useCorpusCounts();

  return (
    <div className="flex min-h-svh flex-col">
      <section className="relative overflow-hidden bg-primary text-primary-foreground">
        <GeoPattern className="text-primary-foreground/10 [mask-image:linear-gradient(to_bottom,black,transparent_60%)]" />
        <div className="relative flex min-h-svh flex-col">
          <header className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-5">
            <Brand inverse />
            <nav className="flex items-center gap-2 sm:gap-4">
              <Link to="/login" className="hidden text-sm font-medium sm:inline">
                Sign in
              </Link>
              <Button variant="secondary" asChild>
                <Link to="/register">Get started</Link>
              </Button>
              <ThemeSwitch />
            </nav>
          </header>
          <main
            id="main"
            tabIndex={-1}
            className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-6 pt-8 pb-24 text-center outline-none"
          >
            <div className="flex flex-col items-center gap-6">
              <h1 className="max-w-4xl font-heading text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
                Every hadith, with the chain that carried it.
              </h1>
              <p className="max-w-2xl text-lg text-pretty text-primary-foreground/85">
                Ilham shows the full isnad behind each hadith and how the scholars graded every
                narrator in it. A teacher leads the study in a circle.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-6">
                <Button size="lg" variant="secondary" asChild>
                  <Link to="/register">Create an account</Link>
                </Button>
                <Link to="/login" className="font-medium underline-offset-4 hover:underline">
                  I already have an account
                </Link>
              </div>
              {corpus ? (
                <p className="text-sm text-primary-foreground/75">
                  {corpus.hadiths.toLocaleString('en')} hadiths and{' '}
                  {corpus.narrators.toLocaleString('en')} narrators, ready to study.
                </p>
              ) : null}
            </div>
          </main>
          <ChevronDown
            aria-hidden="true"
            className="absolute inset-x-0 bottom-8 mx-auto size-6 animate-bounce text-primary-foreground/60 motion-reduce:animate-none"
          />
        </div>
        <div className="relative px-6 pb-24 text-start">
          <Showcase spread />
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-24 lg:grid-cols-[1fr_2fr]">
        <div className="flex flex-col gap-3">
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-balance">
            Built the way hadith is studied
          </h2>
          <p className="text-muted-foreground">
            The chain comes first, the narrators are graded, and a teacher sets the pace.
          </p>
        </div>
        <ul className="grid gap-x-10 gap-y-10 sm:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4">
              <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div className="flex flex-col gap-1">
                <h3 className="font-medium">{title}</h3>
                <p className="text-sm text-muted-foreground">{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-muted">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-24">
          <h2 className="font-heading text-3xl font-semibold tracking-tight">How a circle works</h2>
          <ol className="grid gap-10 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-3">
                <span className="font-heading text-5xl font-semibold text-primary tabular-nums">
                  {i + 1}
                </span>
                <h3 className="text-lg font-medium">{step.title}</h3>
                <p className="text-muted-foreground">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-8 px-6 py-20 md:flex-row md:items-center">
          <div className="flex flex-col gap-2">
            <h2 className="font-heading text-4xl font-semibold tracking-tight">
              Start with the first hadith.
            </h2>
            <p className="text-primary-foreground/85">
              Make an account, join a circle, and read the chain behind it.
            </p>
          </div>
          <Button size="lg" variant="secondary" asChild>
            <Link to="/register">Create an account</Link>
          </Button>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Brand />
          <nav className="flex gap-6 text-sm text-muted-foreground">
            <Link to="/login">Sign in</Link>
            <Link to="/register">Create an account</Link>
          </nav>
        </div>
        <Separator />
        <p className="text-sm text-muted-foreground">
          Hadith and narrator data from the Ifta Sunnah Hadith and Narrators Dataset. Ilham is a
          term project for a database course.
        </p>
      </footer>
    </div>
  );
}
