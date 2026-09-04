import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'default' | 'primary';
  size?: 'default' | 'small';
}

export function Button({
  children,
  variant = 'default',
  size = 'default',
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    variant === 'primary' ? styles.primary : null,
    size === 'small' ? styles.small : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}
