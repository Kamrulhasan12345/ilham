import { useEffect, useState } from 'react';
import styles from './Toast.module.css';

export interface ToastItem {
  id: number;
  message: string;
}

type Listener = (items: ToastItem[]) => void;

const listeners = new Set<Listener>();
let items: ToastItem[] = [];
let nextId = 1;

/** Tell every mounted region. A page never owns the region; it reports. */
export function toast(message: string): void {
  const id = nextId++;
  items = [...items, { id, message }];
  for (const listener of listeners) listener(items);
  window.setTimeout(() => {
    items = items.filter((item) => item.id !== id);
    for (const listener of listeners) listener(items);
  }, 6000);
}

/** One region per application, mounted in the shell. Polite: a screen
    reader announces a result without losing its place. */
export function ToastRegion() {
  const [visible, setVisible] = useState<ToastItem[]>(items);

  useEffect(() => {
    const listener = (next: ToastItem[]) => setVisible(next);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  if (visible.length === 0) return null;
  return (
    <output className={styles.region} aria-live="polite">
      {visible.map((item) => (
        <p key={item.id} className={styles.toast}>
          {item.message}
        </p>
      ))}
    </output>
  );
}
