import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { useId } from 'react';
import { z } from 'zod';
import { apiFetch } from '../lib/apiClient';

const healthSchema = z.object({
  corpus: z.object({ hadiths: z.number(), narrators: z.number() }),
});

/** Live corpus size from the public /health endpoint; undefined until loaded. */
export function useCorpusCounts() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch('/health', healthSchema),
    staleTime: Number.POSITIVE_INFINITY,
  });
  return health.data?.corpus;
}

/** Eight-point star (khatam) tiling, drawn in currentColor so the preset
    colours it. Set the colour and opacity with a text-* class. */
export function GeoPattern({ className }: { className?: string }) {
  const id = `geo${useId().replace(/:/g, '')}`;
  return (
    <svg
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 size-full', className)}
    >
      <defs>
        <pattern id={id} width="64" height="64" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="18" y="18" width="28" height="28" />
            <rect x="18" y="18" width="28" height="28" transform="rotate(45 32 32)" />
            <path d="M32 0v12M32 52v12M0 32h12M52 32h12" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

/** A pointed mihrab arch outline, stretched to its box. */
function Arch({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 300"
      preserveAspectRatio="none"
      className={cn('pointer-events-none absolute', className)}
    >
      <path
        d="M1 300V112Q1 44 100 2Q199 44 199 112V300"
        className="fill-primary-foreground/10 stroke-primary-foreground/60"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M14 300V116Q14 56 100 18Q186 56 186 116V300"
        className="fill-none stroke-primary-foreground/30"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// Sahih al-Bukhari 1, in the order of transmission: Companion first, compiler last.
const CHAIN = [
  { ar: 'عمر بن الخطاب', en: 'ʿUmar ibn al-Khaṭṭāb', grade: 'Companion' },
  { ar: 'علقمة بن وقاص الليثي', en: 'ʿAlqama ibn Waqqāṣ al-Laythī', grade: 'thiqa' },
  { ar: 'محمد بن إبراهيم التيمي', en: 'Muḥammad ibn Ibrāhīm al-Taymī', grade: 'thiqa' },
  { ar: 'يحيى بن سعيد الأنصاري', en: 'Yaḥyā ibn Saʿīd al-Anṣārī', grade: 'thiqa' },
  { ar: 'سفيان بن عيينة', en: 'Sufyān ibn ʿUyayna', grade: 'thiqa' },
  { ar: 'الحميدي', en: 'al-Ḥumaydī', grade: 'thiqa' },
  { ar: 'البخاري', en: 'al-Bukhārī', grade: 'Compiler' },
];

function ChainCard({ className }: { className?: string }) {
  return (
    <Card className={cn('shadow-2xl', className)}>
      <CardHeader>
        <CardTitle>Sahih al-Bukhari 1</CardTitle>
        <CardDescription>The chain, Companion to compiler</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="relative flex flex-col gap-2.5 before:absolute before:inset-y-2 before:start-[5px] before:w-px before:bg-border">
          {CHAIN.map((link, i) => (
            <li
              key={link.en}
              className="relative flex items-center gap-3 ps-6 animate-in fade-in slide-in-from-top-2 fill-mode-both duration-500 motion-reduce:animate-none"
              style={{ animationDelay: `${300 + i * 140}ms` }}
            >
              <span
                aria-hidden="true"
                className="absolute start-0 size-[11px] rounded-full border-2 border-card bg-primary"
              />
              <div className="flex min-w-0 flex-1 flex-col items-start">
                <span dir="rtl" lang="ar" className="font-arabic text-lg leading-snug">
                  {link.ar}
                </span>
                <span className="truncate text-xs text-muted-foreground">{link.en}</span>
              </div>
              <Badge variant={link.grade === 'thiqa' ? 'secondary' : 'outline'}>{link.grade}</Badge>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function MatnCard({ className }: { className?: string }) {
  return (
    <Card size="sm" className={cn('shadow-xl', className)}>
      <CardHeader>
        <CardDescription>The matn</CardDescription>
        <CardAction>
          <Badge>Sahih</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p dir="rtl" lang="ar" className="font-arabic text-2xl leading-loose">
          إِنَّمَا الْأَعْمَالُ بِالنِّيَّاتِ
        </p>
        <p className="text-muted-foreground">Actions are judged by intentions.</p>
      </CardContent>
    </Card>
  );
}

// A fixed, plausible study pattern: 12 weeks, busier toward the present.
const SHADES = ['bg-heat-0', 'bg-heat-1', 'bg-heat-2', 'bg-heat-3', 'bg-heat-4'];
const SAMPLE_DAYS = Array.from({ length: 84 }, (_, i) => {
  const busy = ((i * 7919) % 13) + Math.floor(i / 12);
  return { day: i, level: busy < 6 ? 0 : Math.min(4, Math.floor((busy - 4) / 3)) };
});

function StudyDaysCard({ className }: { className?: string }) {
  return (
    <Card size="sm" className={cn('shadow-xl', className)}>
      <CardHeader>
        <CardTitle>Study days</CardTitle>
        <CardDescription>5 sittings this week</CardDescription>
      </CardHeader>
      <CardContent>
        <div aria-hidden="true" className="grid grid-flow-col grid-rows-7 gap-1">
          {SAMPLE_DAYS.map(({ day, level }) => (
            <span key={day} className={cn('size-2.5 rounded-[2px]', SHADES[level])} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** Product preview on a bg-primary surface: the chain inside a mihrab arch,
    with the matn and the study heatmap floating beside it. `spread` pushes
    the side cards clear of the arch for wide heroes. Decorative: the page
    states everything shown here in text. */
export function Showcase({ spread = false }: { spread?: boolean }) {
  return (
    <div aria-hidden="true" className="relative mx-auto w-80 pt-28 select-none">
      <Arch className="-inset-x-12 top-0 -bottom-4" />
      <ChainCard className="relative" />
      <StudyDaysCard
        className={cn(
          'absolute -rotate-2',
          spread ? 'top-16 -start-64 hidden md:flex' : '-top-12 -start-36',
        )}
      />
      <MatnCard
        className={cn(
          'absolute w-60 rotate-2',
          spread ? 'top-52 -end-64 hidden md:flex' : '-bottom-10 -end-36',
        )}
      />
    </div>
  );
}
