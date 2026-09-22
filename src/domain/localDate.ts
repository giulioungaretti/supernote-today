import {err, ok, type Result} from './result';

declare const localDateBrand: unique symbol;

export type LocalDate = string & {
  readonly [localDateBrand]: 'LocalDate';
};

export type LocalDateError =
  | Readonly<{kind: 'invalid-format'; value: string}>
  | Readonly<{kind: 'invalid-date'; value: string}>;

export interface DateDescriptor {
  readonly date: LocalDate;
  readonly fullDate: string;
}

const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const padTwo = (value: number): string => value.toString().padStart(2, '0');

export const parseLocalDate = (
  value: string,
): Result<LocalDate, LocalDateError> => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return err({kind: 'invalid-format', value});
  }

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const candidate = new Date(year, month - 1, day);

  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return err({kind: 'invalid-date', value});
  }

  return ok(value as LocalDate);
};

export const localDateFromDate = (date: Date): LocalDate =>
  `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(
    date.getDate(),
  )}` as LocalDate;

export const fullDateFromDate = (date: Date): string => {
  const weekday = WEEKDAYS[date.getDay()];
  const month = MONTHS[date.getMonth()];

  if (weekday === undefined || month === undefined) {
    throw new Error('Date contains an unsupported weekday or month');
  }

  return `${weekday}, ${month} ${date.getDate()}, ${date.getFullYear()}`;
};

export const describeDate = (date: Date): DateDescriptor => ({
  date: localDateFromDate(date),
  fullDate: fullDateFromDate(date),
});
