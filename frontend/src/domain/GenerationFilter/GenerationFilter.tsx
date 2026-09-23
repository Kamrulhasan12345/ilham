import { Button } from '../../ui/Button';
import { Slider } from '../../ui/Slider';
import styles from './GenerationFilter.module.css';

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
    readout as text beside ± step buttons, and removes a filtered row at
    micro duration. */
export function GenerationFilter({
  maxGeneration,
  value,
  onChange,
  visibleCount,
  totalCount,
  alwaysShown,
}: GenerationFilterProps) {
  return (
    <section aria-label="Filter the chain by generation" className={styles.filter}>
      <h2 className={styles.title}>Filter the chain by generation</h2>
      <p className={styles.note}>
        {`Generation is a database value: 1 is the Companions, ${maxGeneration} is the latest generation in this chain. Hiding narrators is your act, not a judgement — nothing is scored here.${
          alwaysShown > 0
            ? ` ${alwaysShown} of ${totalCount} ${alwaysShown === 1 ? 'narrator carries' : 'narrators carry'} no recorded generation and always ${alwaysShown === 1 ? 'shows' : 'show'}.`
            : ''
        }`}
      </p>
      <div className={styles.controls}>
        <div className={styles.slider}>
          <Slider
            label="Latest generation shown"
            min={1}
            max={maxGeneration}
            step={1}
            value={value}
            onChange={onChange}
            readout={`Showing ${visibleCount} of ${totalCount} narrators — generations 1 to ${value}`}
          />
        </div>
        <div className={styles.steps}>
          <Button
            size="small"
            onClick={() => onChange(Math.max(1, value - 1))}
            disabled={value <= 1}
            aria-label="Show one fewer generation"
          >
            −
          </Button>
          <Button
            size="small"
            onClick={() => onChange(Math.min(maxGeneration, value + 1))}
            disabled={value >= maxGeneration}
            aria-label="Show one more generation"
          >
            +
          </Button>
        </div>
      </div>
    </section>
  );
}
