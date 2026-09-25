import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Heatmap, bucketSessionsByDay } from './Heatmap';

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

function localKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

describe('bucketSessionsByDay', () => {
  it('opens on a Sunday, ends today, and zero-fills quiet days', () => {
    const days = bucketSessionsByDay([daysAgo(3), daysAgo(3)], 2);
    const today = new Date();
    expect(days).toHaveLength(7 + today.getDay() + 1);
    const [y, m, d] = days[0].date.split('-').map(Number);
    expect(new Date(y, m - 1, d).getDay()).toBe(0);
    expect(days.at(-1)?.date).toBe(localKey(today));
    const three = new Date();
    three.setDate(three.getDate() - 3);
    expect(days.find((day) => day.date === localKey(three))?.count).toBe(2);
    expect(days.filter((day) => day.count > 0)).toHaveLength(1);
  });

  it('buckets by the local date, not the UTC date', () => {
    const justAfterMidnight = new Date();
    justAfterMidnight.setHours(0, 30, 0, 0);
    const days = bucketSessionsByDay([justAfterMidnight.toISOString()], 1);
    expect(days.at(-1)?.count).toBe(1);
  });

  it('ignores timestamps outside the window', () => {
    const days = bucketSessionsByDay(['2020-01-01T00:00:00Z'], 2);
    expect(days.every((d) => d.count === 0)).toBe(true);
  });
});

describe('Heatmap', () => {
  it('renders one cell per day with a text summary of the total', () => {
    const days = bucketSessionsByDay([daysAgo(3)], 2);
    render(<Heatmap days={days} label="Study activity" />);

    const grid = screen.getByRole('img', { name: 'Study activity' });
    expect(grid.children).toHaveLength(14);
    expect(screen.getByText('1 sitting in the last 2 weeks.')).toBeInTheDocument();
  });

  it('paints cells from the heat scale and shows the Less-to-More key', () => {
    const days = bucketSessionsByDay([daysAgo(1), daysAgo(1), daysAgo(1)], 2);
    const { container } = render(<Heatmap days={days} label="Study activity" />);

    const grid = screen.getByRole('img', { name: 'Study activity' });
    const hot = [...grid.children].filter((el) =>
      (el as HTMLElement).className.includes('bg-heat-3'),
    );
    expect(hot).toHaveLength(1);
    expect(screen.getByText('Less')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
    expect(container.querySelectorAll('.bg-heat-0').length).toBeGreaterThan(0);
  });
});
