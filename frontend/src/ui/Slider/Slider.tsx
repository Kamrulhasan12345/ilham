import { useId } from 'react';
import styles from './Slider.module.css';

export interface SliderProps {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
  readout: string;
}

/** The fill and the readout are the same value in two forms — a bar to
    see, a number to quote. The number is the accessible truth; the bar
    is the affordance. Ticks name the live range. */
export function Slider({ label, min, max, step, value, onChange, readout }: SliderProps) {
  const inputId = useId();
  const span = max - min;
  const fill = span === 0 ? 100 : ((value - min) / span) * 100;

  return (
    <div className={styles.slider}>
      <div className={styles.top}>
        <label className={styles.label} htmlFor={inputId}>
          {label}
        </label>
        <span className={styles.val}>{readout}</span>
      </div>
      <div className={styles.track}>
        <span className={styles.rail} aria-hidden="true" />
        <span className={styles.fill} aria-hidden="true" style={{ inlineSize: `${fill}%` }} />
        <input
          id={inputId}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </div>
      <div className={styles.ticks} aria-hidden="true">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
