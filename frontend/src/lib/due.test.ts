import { describe, expect, it } from 'vitest';
import { dueStateFor } from './due';

const NOW = new Date('2026-09-25T12:00:00');

describe('dueStateFor', () => {
  it('marks past days overdue, near days due soon, the rest upcoming', () => {
    expect(dueStateFor('2026-09-24', NOW)).toBe('overdue');
    expect(dueStateFor('2026-09-25', NOW)).toBe('due soon');
    expect(dueStateFor('2026-10-01', NOW)).toBe('due soon');
    expect(dueStateFor('2026-10-02', NOW)).toBe('upcoming');
  });
});
