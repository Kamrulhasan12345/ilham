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

// One 120px period of the 8-fold rosette on the octagon-and-square (4.8.8)
// tiling, drawn by Hankin's method at a 67.5 degree contact angle. Level one:
// an 8-point star at each corner. Level two: its edges run on past the points
// and interlock with the neighbours, so a ring of eight petals frames each
// star and a small 4-point star sits between rosettes. Generated, not drawn by
// hand: edit the construction, not the numbers.
const GIRIH =
  'M60 0L30 12.4M30 12.4L42.4 42.4M42.4 42.4L12.4 30M12.4 30L0 60M0 60L-12.4 30M30 -12.4L60 0M132.4 30L120 60M120 60L107.6 30M107.6 30L77.6 42.4M77.6 42.4L90 12.4M90 12.4L60 0M60 0L90 -12.4M60 120L30 132.4M-12.4 90L0 60M0 60L12.4 90M12.4 90L42.4 77.6M42.4 77.6L30 107.6M30 107.6L60 120M90 132.4L60 120M60 120L90 107.6M90 107.6L77.6 77.6M77.6 77.6L107.6 90M107.6 90L120 60M120 60L132.4 90M77.6 77.6L60 70.3M60 70.3L42.4 77.6M42.4 77.6L49.7 60M49.7 60L42.4 42.4M42.4 42.4L60 49.7M60 49.7L77.6 42.4M77.6 42.4L70.3 60M70.3 60L77.6 77.6';
// The khatam (two squares at 45 degrees) carved inside each large star.
const KHATAM =
  'M22.8 0L0 22.8L-22.8 0L0 -22.8ZM16.1 16.1L-16.1 16.1L-16.1 -16.1L16.1 -16.1ZM142.8 0L120 22.8L97.2 0L120 -22.8ZM136.1 16.1L103.9 16.1L103.9 -16.1L136.1 -16.1ZM22.8 120L0 142.8L-22.8 120L0 97.2ZM16.1 136.1L-16.1 136.1L-16.1 103.9L16.1 103.9ZM142.8 120L120 142.8L97.2 120L120 97.2ZM136.1 136.1L103.9 136.1L103.9 103.9L136.1 103.9Z';

/** Eight-point star rosette tiling, drawn in currentColor so the preset
    colours it. Set the colour and opacity with a text-* class. */
export function GeoPattern({ className }: { className?: string }) {
  const id = `geo${useId().replace(/:/g, '')}`;
  return (
    <svg
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 size-full', className)}
    >
      <defs>
        <pattern id={id} width="120" height="120" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round">
            <path d={GIRIH} />
            <path d={KHATAM} strokeOpacity="0.7" />
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
