import { Card, CardContent } from '@/components/ui/card';
import type { ReactNode } from 'react';

/** The metadata rail: whatever English the current object needs, beside
    the content on wide screens and stacked above it on narrow ones. */
export function Rail({ side, children }: { side: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <Card className="h-fit">
        <CardContent className="flex flex-col gap-3">{side}</CardContent>
      </Card>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </div>
  );
}

export interface RailRowProps {
  label: string;
  children: ReactNode;
  /** Arabic values take the Arabic grade size, right aligned. */
  arabic?: boolean;
}

/** One metadata row: a label and a value. A field with no value says so
    in words through `absent` — no colour reports absence, and an empty
    label is never printed. */
export function RailRow({ label, children, arabic }: RailRowProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span className={arabic ? 'text-right font-arabic text-xl' : undefined}>{children}</span>
    </div>
  );
}

/** The absent value: words, never a blank and never a colour. */
export function Absent({ children }: { children: ReactNode }) {
  return <span className="text-muted-foreground">{children}</span>;
}
