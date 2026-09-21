import {CURRICULUM_LENGTH, lessonAt, type CursiveLesson} from './curriculum';
import {parseLocalDate, type LocalDate} from './localDate';

export const LESSON_EPOCH = '2026-01-01';

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;

const toUtcDay = (date: LocalDate): number => {
  const [yearText, monthText, dayText] = date.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MILLISECONDS);
};

const epoch = (() => {
  const parsed = parseLocalDate(LESSON_EPOCH);
  if (!parsed.ok) {
    throw new Error('Lesson epoch is invalid');
  }
  return parsed.value;
})();

export const lessonSequenceForDate = (date: LocalDate): number => {
  const elapsedDays = toUtcDay(date) - toUtcDay(epoch);
  return ((elapsedDays % CURRICULUM_LENGTH) + CURRICULUM_LENGTH) %
    CURRICULUM_LENGTH;
};

export const lessonForDate = (date: LocalDate): CursiveLesson =>
  lessonAt(lessonSequenceForDate(date));
