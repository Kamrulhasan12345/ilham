import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeSwitch } from './ThemeSwitch';

describe('ThemeSwitch', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('offers dark from a light system and persists the switch', () => {
    render(<ThemeSwitch />);
    const toggle = screen.getByRole('button', { name: 'Switch to dark theme' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(toggle);

    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(window.localStorage.getItem('ilham-theme')).toBe('dark');
  });

  it('is a single toggle button, not a checkbox or a ground picker', () => {
    render(<ThemeSwitch />);
    expect(screen.getByRole('button', { name: /switch to .* theme/i })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '1c' })).not.toBeInTheDocument();
  });

  it('restores a stored dark preference on mount, without a click', () => {
    window.localStorage.setItem('ilham-theme', 'dark');
    render(<ThemeSwitch />);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
