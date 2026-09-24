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

/** One card per hadith: the number as a badge, the English translation
    first when one exists, the Arabic snippet second, and the chain strength
    as a meter and a figure. A hadith with no chain shows "no chain" and no
    meter. A hadith with no translation shows Arabic only. */
export function HadithList({ items }: { items: HadithListItem[] }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((hadith) => (
        <Card key={hadith.hadith_id}>
          <CardContent>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono tabular-nums">
                  {hadith.hadith_num}
                </Badge>
                {hadith.chain_strength === null ? (
                  <span className="text-sm text-muted-foreground">no chain</span>
                ) : (
                  <span className="flex flex-1 items-center gap-2">
                    <Progress
                      value={Math.round(hadith.chain_strength * 100)}
                      className="max-w-40"
                      aria-label={`Chain strength ${hadith.chain_strength.toFixed(2)}`}
                    />
                    <span className="font-mono text-sm tabular-nums text-muted-foreground">
                      {hadith.chain_strength.toFixed(2)}
                    </span>
                  </span>
                )}
              </div>
              <Link
                to="/hadiths/$hadithId"
                params={{ hadithId: String(hadith.hadith_id) }}
                className="flex flex-col gap-1 hover:underline"
              >
                {hadith.text_en ? <span>{truncate(hadith.text_en, 180)}</span> : null}
                <span dir="rtl" lang="ar" className="text-right font-arabic text-lg">
                  {truncate(hadith.text_plain, 180)}
                </span>
              </Link>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
