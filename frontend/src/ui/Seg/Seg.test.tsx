import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Seg } from './Seg';

describe('Seg', () => {
  const options = [
    { value: 'a', label: 'First' },
    { value: 'b', label: 'Second' },
  ] as const;

  it('marks exactly the chosen option pressed', () => {
    render(<Seg label="Pick" options={options} value="a" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'First' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Second' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks nothing pressed when the value is null', () => {
    render(<Seg label="Pick" options={options} value={null} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'First' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Second' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('reports the choice by name', () => {
    let chosen: string | null = null;
    render(<Seg label="Pick" options={options} value={null} onChange={(next) => (chosen = next)} />);
    fireEvent.click(screen.getByRole('button', { name: 'Second' }));
    expect(chosen).toBe('b');
  });
});
