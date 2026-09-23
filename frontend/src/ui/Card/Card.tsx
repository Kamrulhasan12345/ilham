import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Card.module.css';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

/** A bordered block for one item in a list: one collection, one chapter,
    one circle, one note group. Replaces a bare <li> wherever a list of
    cards reads better than a table. Adjacent cards share a border. */
export function Card({ children, className, ...rest }: CardProps) {
  return (
    <div className={[styles.card, className].filter(Boolean).join(' ')} {...rest}>
      {children}
    </div>
  );
}
