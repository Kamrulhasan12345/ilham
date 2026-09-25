import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Minus, Plus } from 'lucide-react';

export interface GenerationFilterProps {
  /** Highest generation present in this chain (Companions are 1). */
  maxGeneration: number;
  value: number;
  onChange: (value: number) => void;
  visibleCount: number;
  totalCount: number;
  /** Links with no recorded generation always show; say how many. */
  alwaysShown: number;
}

/** A slider that hides the later end of the chain by generation. It says
    what a generation is, says that filtering scores nothing, prints its
    readout as text beside ± step buttons. */
export function GenerationFilter({
  maxGeneration,
  value,
  onChange,
  visibleCount,
  totalCount,
  alwaysShown,
}: GenerationFilterProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Filter the chain by generation</CardTitle>
        <CardDescription>
          {`Generation is a database value: 1 is the Companions, ${maxGeneration} is the latest generation in this chain. Hiding narrators is your act, not a judgement — nothing is scored here.${
            alwaysShown > 0
              ? ` ${alwaysShown} of ${totalCount} ${alwaysShown === 1 ? 'narrator carries' : 'narrators carry'} no recorded generation and always ${alwaysShown === 1 ? 'shows' : 'show'}.`
              : ''
          }`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <Slider
            aria-label="Latest generation shown"
            min={1}
            max={maxGeneration}
            step={1}
            value={[value]}
            onValueChange={([next]) => next !== undefined && onChange(next)}
            className="flex-1"
          />
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onChange(Math.max(1, value - 1))}
            disabled={value <= 1}
            aria-label="Show one fewer generation"
          >
            <Minus />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onChange(Math.min(maxGeneration, value + 1))}
            disabled={value >= maxGeneration}
            aria-label="Show one more generation"
          >
            <Plus />
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {`Showing ${visibleCount} of ${totalCount} narrators — generations 1 to ${value}`}
        </p>
      </CardContent>
    </Card>
  );
}
