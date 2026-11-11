import { describe, expect, it } from 'vitest';
import { formatDeadline, isOverdue, percent } from './format';

describe('percent', () => {
  it('rounds done ÷ total to whole percent', () => {
    expect(percent({ done: 1, total: 3 })).toBe(33);
    expect(percent({ done: 2, total: 3 })).toBe(67);
  });

  it('is 0 for an empty line', () => {
    expect(percent({ done: 0, total: 0 })).toBe(0);
  });
});

describe('isOverdue', () => {
  it('is true only for a deadline before today', () => {
    expect(isOverdue('2026-11-10', '2026-11-11')).toBe(true);
    expect(isOverdue('2026-11-11', '2026-11-11')).toBe(false);
    expect(isOverdue('2026-12-01', '2026-11-11')).toBe(false);
    expect(isOverdue(null, '2026-11-11')).toBe(false);
  });
});

describe('formatDeadline', () => {
  it('shows day and month, and the year only when it is not the current one', () => {
    expect(formatDeadline('2026-05-01', '2026-11-11')).toBe('1 мая');
    expect(formatDeadline('2027-05-01', '2026-11-11')).toBe('1 мая 2027 г.');
  });
});
