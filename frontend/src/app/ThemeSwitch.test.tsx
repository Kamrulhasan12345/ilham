import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeSwitch } from './ThemeSwitch';

describe('ThemeSwitch', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('marks 1c pressed by default and persists a click on 2a', () => {
    render(<ThemeSwitch />);
    const light = screen.getByRole('button', { name: '1c' });
    const dark = screen.getByRole('button', { name: '2a' });
    expect(light).toHaveAttribute('aria-pressed', 'true');
    expect(dark).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(dark);

    expect(dark).toHaveAttribute('aria-pressed', 'true');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(window.localStorage.getItem('ilham-theme')).toBe('dark');
  });

  it('is a labelled group of two buttons, not a checkbox', () => {
    render(<ThemeSwitch />);
    expect(screen.getByRole('group', { name: 'Ground' })).toBeInTheDocument();
  });
});
