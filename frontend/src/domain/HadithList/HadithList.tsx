import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Link } from '@tanstack/react-router';

export interface HadithListItem {
  hadith_id: number;
  hadith_num: string;
  text_plain: string;
  text_en: string | null;
  chain_strength: number | null;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** One card per hadith: the number and the chain strength on top, then the
    English translation first when one exists (English-first, per the
    2026-09-24 redesign spec) and the Arabic snippet second. The text is the
    single link into the hadith. A hadith with no chain shows "no chain". */
export function HadithList({ items }: { items: HadithListItem[] }) {
  return (
    <div className="flex flex-col gap-4">
      {items.map((hadith) => (
        <Card key={hadith.hadith_id} className="transition-shadow hover:shadow-md">
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="tabular-nums">
                {hadith.hadith_num}
              </Badge>
              <span className="flex-1" />
              {hadith.chain_strength === null ? (
                <span className="text-sm text-muted-foreground">no chain</span>
              ) : (
                <span className="flex w-44 items-center gap-2">
                  <span className="text-xs text-muted-foreground">Chain</span>
                  <Progress
                    value={Math.round(hadith.chain_strength * 100)}
                    aria-label={`Chain strength ${hadith.chain_strength.toFixed(2)}`}
                  />
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {hadith.chain_strength.toFixed(2)}
                  </span>
                </span>
              )}
            </div>
            <Link
              to="/hadiths/$hadithId"
              params={{ hadithId: String(hadith.hadith_id) }}
              className="group flex flex-col gap-2 hover:no-underline"
            >
              {hadith.text_en ? (
                <span className="line-clamp-3 transition-colors group-hover:text-primary">
                  {hadith.text_en}
                </span>
              ) : null}
              <span
                dir="rtl"
                lang="ar"
                className={
                  hadith.text_en
                    ? 'font-arabic text-lg leading-loose text-muted-foreground'
                    : 'font-arabic text-xl leading-loose transition-colors group-hover:text-primary'
                }
              >
                {truncate(hadith.text_plain, 180)}
              </span>
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
