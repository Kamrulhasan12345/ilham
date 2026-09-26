import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Link } from '@tanstack/react-router';
import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { Brand } from './AuthLayout';
import { GeoPattern, Showcase, useCorpusCounts } from './Showcase';
import { ThemeSwitch } from './ThemeSwitch';

const NAV = [
  { href: '#features', label: 'Features' },
  { href: '#roles', label: 'Who it is for' },
  { href: '#method', label: 'Chain strength' },
  { href: '#faq', label: 'Questions' },
];

const SOURCES = [
  { name: 'Ifta Sunnah Dataset', gives: 'Arabic text, chains, and narrators' },
  { name: 'LK Hadith Corpus', gives: 'English text for each hadith' },
  { name: 'MIS Narrators', gives: 'English narrator names' },
];

/** The signed-out front page. Colours are preset tokens only. */
export function Landing() {
  const corpus = useCorpusCounts();

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-50 border-b border-primary-foreground/15 bg-primary text-primary-foreground">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
          <Brand inverse />
          <nav aria-label="Sections" className="hidden items-center gap-7 text-sm lg:flex">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-primary-foreground/80 hover:text-primary-foreground"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link to="/login" className="hidden text-sm font-medium sm:inline">
              Sign in
            </Link>
            <Button variant="secondary" asChild>
              <Link to="/register">Get started</Link>
            </Button>
            <ThemeSwitch />
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="outline-none">
        <Hero hadiths={corpus?.hadiths} narrators={corpus?.narrators} />
        <Sources hadiths={corpus?.hadiths} narrators={corpus?.narrators} />
        <Features />
        <Roles />
        <Steps />
        <Method />
        <Faq />
        <FinalCta />
      </main>

      <Footer />
    </div>
  );
}

function Hero({ hadiths, narrators }: { hadiths?: number; narrators?: number }) {
  return (
    <section className="relative overflow-hidden bg-primary text-primary-foreground">
      <GeoPattern className="text-primary-foreground/10 [mask-image:linear-gradient(to_bottom,black,transparent_60%)]" />
      <div className="relative mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-6xl flex-col items-center justify-center gap-6 px-6 pt-12 pb-20 text-center">
        <p dir="rtl" lang="ar" className="font-arabic text-2xl text-primary-foreground/80">
          حدثنا الحميدي عبد الله بن الزبير
        </p>
        <h1 className="max-w-4xl font-heading text-5xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl lg:text-7xl">
          Every hadith, with the chain that carried it.
        </h1>
        <p className="max-w-2xl text-lg text-pretty text-primary-foreground/85">
          Ilham shows the full isnad behind each hadith and how the scholars graded every narrator
          in it. A teacher leads the study in a circle.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6">
          <Button size="lg" variant="secondary" asChild>
            <Link to="/register">Create an account</Link>
          </Button>
          <Link to="/login" className="font-medium underline-offset-4 hover:underline">
            I already have an account
          </Link>
        </div>
        {hadiths && narrators ? (
          <p className="text-sm text-primary-foreground/75">
            {hadiths.toLocaleString('en')} hadiths and {narrators.toLocaleString('en')} narrators,
            ready to study.
          </p>
        ) : null}
      </div>
      <div className="relative px-6 pb-24 text-start">
        <Showcase spread />
      </div>
    </section>
  );
}

/** Where the corpus comes from, set in one hairline grid with the live counts. */
function Sources({ hadiths, narrators }: { hadiths?: number; narrators?: number }) {
  const counts = [
    { value: hadiths, label: 'hadiths' },
    { value: narrators, label: 'narrators' },
  ];
  return (
    <section aria-labelledby="sources-title" className="border-b">
      <div className="mx-auto w-full max-w-6xl px-6 py-12">
        <h2 id="sources-title" className="mb-6 text-sm text-muted-foreground">
          The corpus is built from three open datasets
        </h2>
        <div className="grid border-s border-t sm:grid-cols-2 lg:grid-cols-5">
          {SOURCES.map((s) => (
            <div key={s.name} className="flex flex-col gap-1 border-e border-b p-5">
              <span className="font-medium">{s.name}</span>
              <span className="text-sm text-muted-foreground">{s.gives}</span>
            </div>
          ))}
          {counts.map((c) => (
            <div key={c.label} className="flex flex-col gap-1 border-e border-b p-5">
              <span className="font-heading text-2xl font-semibold tabular-nums">
                {c.value ? c.value.toLocaleString('en') : '—'}
              </span>
              <span className="text-sm text-muted-foreground">{c.label} in the corpus</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SectionHead({ id, title, body }: { id: string; title: string; body: string }) {
  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <h2
        id={id}
        className="font-heading text-3xl font-semibold tracking-tight text-balance sm:text-4xl"
      >
        {title}
      </h2>
      <p className="text-lg text-pretty text-muted-foreground">{body}</p>
    </div>
  );
}

/** One bento cell: a product fragment on top that fades out, the words below. */
function Cell({
  title,
  body,
  className,
  children,
}: {
  title: string;
  body: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <li className={cn('flex flex-col border-e border-b', className)}>
      <div
        aria-hidden="true"
        className="relative flex-1 overflow-hidden p-6 select-none [mask-image:linear-gradient(to_bottom,black_70%,transparent)]"
      >
        {children}
      </div>
      <div className="flex flex-col gap-1 p-6 pt-2">
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
    </li>
  );
}

const MINI_CHAIN = [
  { ar: 'عمر بن الخطاب', word: 'سمعت' },
  { ar: 'علقمة بن وقاص', word: 'سمعت' },
  { ar: 'محمد بن إبراهيم', word: 'أخبرني' },
  { ar: 'يحيى بن سعيد', word: 'حدثنا' },
];

function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-16">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-24">
        <SectionHead
          id="features-title"
          title="Built the way hadith is studied"
          body="The chain comes first, the narrators are graded, and a teacher sets the pace."
        />
        <ul className="grid border-s border-t md:grid-cols-6">
          <Cell
            className="md:col-span-4"
            title="Full isnad chains"
            body="Every sanad is stored link by link, with the word each narrator used, so you read a chain in the order it was passed on."
          >
            <ol className="flex flex-wrap items-center gap-2" dir="rtl" lang="ar">
              {MINI_CHAIN.map((link, i) => (
                <li key={link.ar} className="flex items-center gap-2">
                  {i > 0 ? (
                    <span className="font-arabic text-sm text-muted-foreground">{link.word}</span>
                  ) : null}
                  <span className="rounded-md border bg-card px-3 py-1.5 font-arabic text-lg">
                    {link.ar}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-6 font-arabic text-2xl leading-loose" dir="rtl" lang="ar">
              إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ، وَإِنَّمَا لِكُلِّ امْرِئٍ مَا نَوَى
            </p>
          </Cell>
          <Cell
            className="md:col-span-2"
            title="Narrator grades"
            body="See how Ibn Hajar and al-Dhahabi graded each narrator, right beside the name."
          >
            <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 text-sm">
              <dt className="text-muted-foreground">Ibn Hajar</dt>
              <dd dir="rtl" lang="ar" className="font-arabic text-lg">
                ثقة ثبت
              </dd>
              <dt className="text-muted-foreground">al-Dhahabi</dt>
              <dd dir="rtl" lang="ar" className="font-arabic text-lg">
                صدوق
              </dd>
              <dt className="text-muted-foreground">Stricter</dt>
              <dd>
                <Badge variant="secondary">saduq, 0.80</Badge>
              </dd>
            </dl>
          </Cell>
          <Cell
            className="md:col-span-2"
            title="Chain strength"
            body="Each hadith gets a score from 0 to 1, from the weakest link in its best chain."
          >
            <div className="flex flex-col gap-3">
              <span className="font-heading text-5xl font-semibold tabular-nums">0.80</span>
              <Progress value={80} />
            </div>
          </Cell>
          <Cell
            className="md:col-span-2"
            title="Arabic first"
            body="The Arabic text is canonical. An English translation sits beside it where one exists."
          >
            <p dir="rtl" lang="ar" className="font-arabic text-xl leading-loose">
              الدِّينُ النَّصِيحَةُ
            </p>
            <p className="text-sm text-muted-foreground">Religion is sincere counsel.</p>
          </Cell>
          <Cell
            className="md:col-span-2"
            title="Study sets and progress"
            body="Teachers group hadiths into sets with a due date. Students see what is left."
          >
            <div className="flex flex-col gap-4 text-sm">
              {[
                { name: 'Intentions', done: 7, of: 10 },
                { name: 'Purification', done: 3, of: 12 },
              ].map((s) => (
                <div key={s.name} className="flex flex-col gap-1.5">
                  <div className="flex justify-between">
                    <span>{s.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {s.done} of {s.of}
                    </span>
                  </div>
                  <Progress value={(s.done / s.of) * 100} />
                </div>
              ))}
            </div>
          </Cell>
        </ul>
      </div>
    </section>
  );
}

const ROLES = [
  {
    value: 'students',
    label: 'Students',
    title: 'Study at your own pace, or with a circle',
    points: [
      'Browse each collection by kitab and bab, as the printed book does',
      'Build your own study sets, and keep private notes on any hadith',
      'Mark each hadith as you learn it, and review what you mastered',
      'See your study days on a heatmap',
    ],
  },
  {
    value: 'teachers',
    label: 'Teachers',
    title: 'Run a circle and see who is on track',
    points: [
      'Open a circle after an admin verifies your ijaza or institution',
      'Assign a study set to the whole circle with one due date',
      'See the progress of every student in one overview',
      'Correct a student’s progress. Every change is kept in an audit log',
    ],
  },
  {
    value: 'researchers',
    label: 'Researchers',
    title: 'Look at the narrators behind the corpus',
    points: [
      'Find the narrators who appear in the most chains',
      'Compare narrators where Ibn Hajar and al-Dhahabi disagree',
      'Find narrators that two chains share',
      'List the weakest chains among the hadiths you study',
    ],
  },
];

function Roles() {
  return (
    <section id="roles" aria-labelledby="roles-title" className="scroll-mt-16 bg-muted">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-24">
        <SectionHead
          id="roles-title"
          title="One corpus, three ways to use it"
          body="Everyone reads the same hadiths. What you can do next depends on your role."
        />
        <Tabs defaultValue="students" className="gap-8">
          <TabsList>
            {ROLES.map((r) => (
              <TabsTrigger key={r.value} value={r.value}>
                {r.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {ROLES.map((r) => (
            <TabsContent
              key={r.value}
              value={r.value}
              className="grid gap-8 md:grid-cols-[2fr_3fr]"
            >
              <h3 className="font-heading text-2xl font-semibold tracking-tight text-balance">
                {r.title}
              </h3>
              <ul className="flex flex-col gap-4">
                {r.points.map((p) => (
                  <li key={p} className="flex gap-3">
                    <Check className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}

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

function Steps() {
  return (
    <section aria-labelledby="steps-title">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 py-24">
        <h2 id="steps-title" className="font-heading text-3xl font-semibold tracking-tight">
          How a circle works
        </h2>
        <ol className="grid gap-10 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-3 border-t-2 border-primary pt-6">
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
  );
}

// Two example chains. Weights come from corpus.rank_levels; ʿan (عن) costs 0.05.
const SANADS = [
  [
    { grade: 'thiqa', weight: 0.95 },
    { grade: 'saduq', weight: 0.8 },
    { grade: 'thiqa, عن', weight: 0.9 },
  ],
  [
    { grade: 'thiqa', weight: 0.95 },
    { grade: 'maqbul, عن', weight: 0.55 },
    { grade: 'ungraded', weight: 0.5 },
  ],
];

const RULES = [
  'Each narrator gets a weight from their grade. Where the two scholars differ, the stricter grade counts.',
  'A narrator with no grade counts as 0.50. No grade is not the same as criticism.',
  'An unnamed or unresolved narrator counts as 0.15.',
  'A link that uses ʿan (عن) loses 0.05, because it does not state that the narrator heard it directly.',
  'A chain is as strong as its weakest link. The best chain gives the hadith its score.',
];

function Method() {
  const mins = SANADS.map((s) => Math.min(...s.map((l) => l.weight)));
  const best = Math.max(...mins);
  return (
    <section id="method" aria-labelledby="method-title" className="scroll-mt-16 border-y">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-24 lg:grid-cols-2">
        <div className="flex flex-col gap-8">
          <SectionHead
            id="method-title"
            title="How chain strength is scored"
            body="The score is a simple, open rule. You can check every number by hand."
          />
          <ul className="flex flex-col gap-4">
            {RULES.map((r) => (
              <li key={r} className="flex gap-3">
                <Check className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
                <span>{r}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            The score does not replace the grade that the scholars gave the hadith. It shows how
            strong the chain is on paper.
          </p>
        </div>

        <figure className="flex flex-col gap-4 self-center rounded-xl border bg-card p-6">
          <figcaption className="text-sm text-muted-foreground">
            An example hadith with two chains
          </figcaption>
          {SANADS.map((sanad, i) => {
            const min = mins[i];
            const isBest = min === best;
            return (
              <div
                key={sanad.map((l) => l.grade).join()}
                className={cn(
                  'flex flex-col gap-3 rounded-lg border p-4',
                  isBest && 'border-primary bg-primary/5',
                )}
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Chain {i + 1}</span>
                  <span className="text-muted-foreground">
                    Weakest link{' '}
                    <span className="font-medium text-foreground tabular-nums">
                      {min.toFixed(2)}
                    </span>
                  </span>
                </div>
                <ol className="grid grid-cols-3 gap-2">
                  {sanad.map((link, j) => (
                    <li
                      // biome-ignore lint/suspicious/noArrayIndexKey: fixed example data
                      key={j}
                      className={cn(
                        'flex flex-col rounded-md border px-3 py-2 text-sm',
                        link.weight === min && 'border-foreground',
                      )}
                    >
                      <span className="text-muted-foreground">{link.grade}</span>
                      <span className="font-medium tabular-nums">{link.weight.toFixed(2)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            );
          })}
          <div className="flex items-baseline justify-between border-t pt-4">
            <span>Chain strength, from the best chain</span>
            <span className="font-heading text-3xl font-semibold text-primary tabular-nums">
              {best.toFixed(2)}
            </span>
          </div>
        </figure>
      </div>
    </section>
  );
}

const FAQ = [
  {
    q: 'Who can use Ilham?',
    a: 'Anyone can make a student account and read the whole corpus. Teachers sign up the same way, and an admin verifies them before they open a circle.',
  },
  {
    q: 'Where do the hadith texts come from?',
    a: 'The Arabic text, the chains, and the narrators come from the Ifta Sunnah Hadith and Narrators Dataset. English narrator names come from MIS, and the English hadith text comes from the LK corpus.',
  },
  {
    q: 'Why do some hadiths have no English?',
    a: 'English is attached only where its Arabic matches the Arabic in the corpus, so a translation never lands on the wrong hadith. About 95% of hadiths have a match. The rest show the Arabic only.',
  },
  {
    q: 'Can I study without a teacher?',
    a: 'Yes. Make your own study sets and mark your progress. If you join a circle later, your private study stays as it is.',
  },
  {
    q: 'Why must a teacher be verified?',
    a: 'A circle puts a teacher in charge of other people’s study. An admin checks the teacher’s ijaza or institution first.',
  },
  {
    q: 'Can users change the hadith text?',
    a: 'No. The corpus is read-only. The database itself stops the app from writing to it, so the text you read is the text that was loaded.',
  },
];

function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-16">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-6 py-24 lg:grid-cols-[1fr_2fr]">
        <SectionHead
          id="faq-title"
          title="Questions"
          body="What people ask before they make an account."
        />
        <Accordion type="single" collapsible>
          {FAQ.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="text-base">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-primary text-primary-foreground">
      <GeoPattern className="text-primary-foreground/10 [mask-image:linear-gradient(to_left,black,transparent_70%)]" />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-8 px-6 py-20 md:flex-row md:items-center">
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
  );
}

function Footer() {
  return (
    <footer className="bg-muted">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 pt-16 pb-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <Brand />
          <p className="max-w-xs text-sm text-muted-foreground">
            A hadith study platform. A teacher leads the study, and every hadith shows its chain.
          </p>
        </div>
        <FooterCol title="Product">
          {NAV.map((item) => (
            <a key={item.href} href={item.href}>
              {item.label}
            </a>
          ))}
        </FooterCol>
        <FooterCol title="Account">
          <Link to="/login">Sign in</Link>
          <Link to="/register">Create an account</Link>
        </FooterCol>
        <FooterCol title="Data">
          {SOURCES.map((s) => (
            <span key={s.name}>{s.name}</span>
          ))}
        </FooterCol>
      </div>
      <div className="mx-auto w-full max-w-6xl px-6 pb-10">
        <Separator />
        <p className="pt-6 text-sm text-muted-foreground">
          Ilham is a term project for a database course.
        </p>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-medium">{title}</h2>
      <div className="flex flex-col gap-2 text-sm text-muted-foreground [&_a:hover]:text-foreground">
        {children}
      </div>
    </div>
  );
}
