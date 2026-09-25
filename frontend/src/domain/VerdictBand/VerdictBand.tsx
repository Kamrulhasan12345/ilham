import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export type VerdictWord = 'strong' | 'mixed' | 'weak' | 'none';

/** The plain sentence about the chain: a word first, the number second,
    never a bare number. The disclaimer stands beside every verdict:
    Ilham reports grades that classical scholars wrote centuries ago. */
export function VerdictBand({
  word,
  strength,
  children,
}: {
  word: VerdictWord;
  strength: number | null;
  children: React.ReactNode;
}) {
  return (
    <Alert>
      <AlertTitle>
        {word === 'none' ? (
          'This hadith carries no recorded chain.'
        ) : (
          <>
            This chain is <b>{word}</b>.{' '}
            {strength !== null ? (
              <span className="font-mono tabular-nums">[wt {strength.toFixed(2)}]</span>
            ) : null}
          </>
        )}
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-1">
        <span>{children}</span>
        <span>
          Ilham reports grades that classical scholars wrote centuries ago. It does not judge
          whether a hadith is authentic, and a number here is never Ilham&rsquo;s own opinion.
        </span>
      </AlertDescription>
    </Alert>
  );
}
