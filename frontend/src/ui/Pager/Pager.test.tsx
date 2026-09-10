import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Pager } from './Pager';

describe('Pager', () => {
  it('shows the current range and the "not counted" note', () => {
    render(<Pager offset={20} limit={20} count={20} onPrev={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByText('Showing 21–40')).toBeInTheDocument();
    expect(screen.getByText(/total is not counted/i)).toBeInTheDocument();
  });

  it('disables Previous on the first page (offset 0)', () => {
    render(<Pager offset={0} limit={20} count={20} onPrev={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
  });

  it('enables Previous once offset is past zero, and calls onPrev', () => {
    const onPrev = vi.fn();
    render(<Pager offset={20} limit={20} count={20} onPrev={onPrev} onNext={vi.fn()} />);
    const prev = screen.getByRole('button', { name: /previous/i });
    expect(prev).toBeEnabled();
    prev.click();
    expect(onPrev).toHaveBeenCalledOnce();
  });

  it('disables Next when this page returned fewer rows than limit (the last page)', () => {
    render(<Pager offset={40} limit={20} count={7} onPrev={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
    expect(screen.getByText('Showing 41–47')).toBeInTheDocument();
  });

  it('enables Next and calls onNext when the page is full', () => {
    const onNext = vi.fn();
    render(<Pager offset={0} limit={20} count={20} onPrev={vi.fn()} onNext={onNext} />);
    const next = screen.getByRole('button', { name: /next/i });
    expect(next).toBeEnabled();
    next.click();
    expect(onNext).toHaveBeenCalledOnce();
  });
});
