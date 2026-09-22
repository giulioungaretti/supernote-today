import {lessonForDate} from '../src/domain/lessonSchedule';
import {describeDate} from '../src/domain/localDate';
import {CURRICULUM_LENGTH} from '../src/domain/curriculum';
import {previewPage} from './model';

test('preview uses the same dated exercise as the plugin', () => {
  const date = new Date(2026, 8, 21);
  expect(previewPage(date, 0, 'nomad').lesson).toEqual(
    lessonForDate(describeDate(date).date),
  );
  expect(previewPage(date, 0, 'nomad').layout.pageSize).toEqual({
    width: 1404,
    height: 1872,
  });
});

test('lesson controls wrap in both directions without changing the date', () => {
  const date = new Date(2026, 8, 21);
  expect(previewPage(date, CURRICULUM_LENGTH, 'nomad').lesson).toEqual(
    previewPage(date, 0, 'nomad').lesson,
  );
  expect(previewPage(date, -1, 'nomad').index).toBe(
    (previewPage(date, 0, 'nomad').index + CURRICULUM_LENGTH - 1) %
      CURRICULUM_LENGTH,
  );
  expect(previewPage(date, 1, 'manta').descriptor.date).toBe(
    describeDate(date).date,
  );
});
