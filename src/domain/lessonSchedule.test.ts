import {parseLocalDate} from './localDate';
import {
  lessonForDate,
  lessonSequenceForDate,
} from './lessonSchedule';

const date = (value: string) => {
  const parsed = parseLocalDate(value);
  if (!parsed.ok) {
    throw new Error(`Invalid test date: ${value}`);
  }
  return parsed.value;
};

describe('lessonSchedule', () => {
  it('assigns the same lesson every time for a date', () => {
    const today = date('2026-09-21');
    expect(lessonForDate(today)).toEqual(lessonForDate(today));
  });

  it('advances by one for consecutive calendar dates', () => {
    expect(lessonSequenceForDate(date('2026-01-01'))).toBe(0);
    expect(lessonSequenceForDate(date('2026-01-02'))).toBe(1);
  });

  it('cycles after the 56-lesson sequence', () => {
    expect(lessonSequenceForDate(date('2026-02-26'))).toBe(0);
  });
});
