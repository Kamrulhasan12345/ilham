import { cn } from '@/lib/utils';
import { Link } from '@tanstack/react-router';
import { BookOpen } from 'lucide-react';
import type { ReactNode } from 'react';
import { GeoPattern, Showcase, useCorpusCounts } from './Showcase';
import { ThemeSwitch } from './ThemeSwitch';

/** The wordmark. `inverse` for use on a bg-primary surface. */
export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2 text-lg font-semibold hover:no-underline">
      <span
        className={cn(
          'flex size-8 items-center justify-center rounded-lg',
          inverse ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground',
        )}
      >
        <BookOpen className="size-4" />
      </span>
      Ilham
      <span dir="rtl" lang="ar" className="font-arabic">
        إلهام
      </span>
    </Link>
  );
}

/** Full-bleed split for the signed-out pages: a brand panel on the left from
    lg up, the form on the right. Rendered outside Shell, so it owns #main. */
export function AuthLayout({ switchTo, children }: { switchTo: ReactNode; children: ReactNode }) {
  const counts = useCorpusCounts();
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <aside className="relative hidden flex-col gap-8 overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <GeoPattern className="text-primary-foreground/10 [mask-image:radial-gradient(ellipse_at_center,transparent_30%,black_80%)]" />
        <div className="relative">
          <Brand inverse />
        </div>
        <div className="relative flex flex-1 items-center justify-center">
          <Showcase />
        </div>
        <div className="relative flex flex-col gap-2">
          <p className="font-heading text-3xl font-semibold tracking-tight text-balance">
            Read the chain behind every hadith.
          </p>
          <p className="text-primary-foreground/75">
            {counts
              ? `${counts.hadiths.toLocaleString('en')} hadiths and ${counts.narrators.toLocaleString('en')} graded narrators.`
              : 'A hadith study platform. A teacher leads the study.'}
          </p>
        </div>
      </aside>
      <main id="main" tabIndex={-1} className="flex flex-col gap-4 p-6 outline-none md:p-10">
        <div className="flex items-center justify-between gap-2">
          <div className="lg:invisible">
            <Brand />
          </div>
          <div className="flex items-center gap-2">
            {switchTo}
            <ThemeSwitch />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-sm flex-col gap-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
