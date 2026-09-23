import {
  type ButtonHTMLAttributes,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import styles from './Menu.module.css';

export interface MenuProps {
  label: string;
  current?: boolean;
  children: ReactNode;
}

/** A trigger button plus a role="menu" popover: the shell's Corpus, Study,
    and Account dropdowns all reuse this. A child that should act as a menu
    item carries role="menuitem" itself — Menu renders children as given,
    it never clones or wraps them, so a plain <Link> works unmodified. */
export function Menu({ label, current, children }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onDocClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('click', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    rootRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  function onMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    const nextIndex =
      event.key === 'ArrowDown'
        ? (currentIndex + 1) % items.length
        : (currentIndex - 1 + items.length) % items.length;
    items[nextIndex]?.focus();
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={current ? `${styles.trigger} ${styles.current}` : styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </button>
      {open ? (
        // biome-ignore lint/a11y/useSemanticElements: role="menu" on a div is the ARIA menu pattern; no native element provides it.
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={styles.popover}
          onKeyDown={onMenuKeyDown}
          onClick={() => setOpen(false)}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function MenuButton({
  children,
  className,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      role="menuitem"
      className={[styles.item, className].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </button>
  );
}

export function MenuText({ children }: { children: ReactNode }) {
  return <div className={styles.text}>{children}</div>;
}
