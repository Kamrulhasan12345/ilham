import { describe, expect, it } from 'vitest';
import { titleOf } from './corpus';

describe('titleOf', () => {
  it('prefers the English title', () => {
    expect(titleOf({ title_en: 'Belief', title_ar: 'كتاب الإيمان' })).toBe('Belief');
  });
  it('calls a bare باب, with or without harakat, an untitled chapter', () => {
    expect(titleOf({ title_en: null, title_ar: 'باب' })).toBe('Untitled chapter');
    expect(titleOf({ title_en: null, title_ar: 'بَابٌ ‏' })).toBe('Untitled chapter');
  });
  it('falls back to a real Arabic heading as it is', () => {
    expect(titleOf({ title_en: null, title_ar: 'باب الشفعة' })).toBe('باب الشفعة');
  });
});
