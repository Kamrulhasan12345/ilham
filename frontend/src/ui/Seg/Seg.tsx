import styles from './Seg.module.css';

export interface SegOption<T extends string> {
  value: T;
  label: string;
}

/** A segmented control: one choice among few, always visible. Pressed is
    an ink fill — position, not colour. The vocalisation toggle and the
    chain switch render through this. */
export function Seg<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly SegOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className={styles.seg}>
      <legend className="vh">{label}</legend>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === null ? false : value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}
