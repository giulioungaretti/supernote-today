import {
  describeDate,
  fullDateFromDate,
  localDateFromDate,
  parseLocalDate,
} from './localDate';

describe('localDate', () => {
  it('formats the local calendar date without UTC conversion', () => {
    const value = new Date(2026, 8, 21, 23, 45);

    expect(localDateFromDate(value)).toBe('2026-09-21');
    expect(fullDateFromDate(value)).toBe('Monday, September 21, 2026');
    expect(describeDate(value)).toEqual({
      date: '2026-09-21',
      fullDate: 'Monday, September 21, 2026',
    });
  });

  it('rejects malformed and impossible dates', () => {
    expect(parseLocalDate('2026-9-21').ok).toBe(false);
    expect(parseLocalDate('2026-02-30').ok).toBe(false);
    expect(parseLocalDate('2024-02-29').ok).toBe(true);
  });
});
