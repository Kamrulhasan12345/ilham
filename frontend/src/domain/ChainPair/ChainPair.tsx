import { Badge } from '@/components/ui/badge';

export interface PairChain {
  hadithId: number;
  hadithNum: string;
  names: string[];
}

/** Two chains side by side. Neither is reordered to make them line up —
    the transmission order is the data. A shared narrator carries the
    word, not colour alone. */
export function ChainPair({
  left,
  right,
  shared,
}: {
  left: PairChain;
  right: PairChain;
  shared: Set<string>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[left, right].map((chain) => (
        <div key={chain.hadithId} className="flex flex-col gap-1">
          <p className="text-sm font-semibold">
            Hadith <span className="font-mono tabular-nums">{chain.hadithNum}</span>
          </p>
          <ol className="flex flex-col gap-1">
            {chain.names.map((name) => (
              <li key={`${chain.hadithId}-${name}`} className="flex items-center gap-2">
                <span dir="rtl" lang="ar" className="font-arabic text-lg">
                  {name}
                </span>{' '}
                {shared.has(name) ? <Badge variant="secondary">shared</Badge> : null}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
