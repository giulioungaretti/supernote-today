import {CURRICULUM, CURRICULUM_LENGTH} from '../src/domain/curriculum';
import {describeDate} from '../src/domain/localDate';
import {lessonSequenceForDate} from '../src/domain/lessonSchedule';
import {
  buildTodayPageLayout,
  PAGE_SIZES,
  type TemplateId,
} from '../src/domain/pageLayout';

export const previewPage = (
  date: Date,
  lessonOffset: number,
  device: TemplateId,
) => {
  const descriptor = describeDate(date);
  const index =
    (((lessonSequenceForDate(descriptor.date) + lessonOffset) %
      CURRICULUM_LENGTH) +
      CURRICULUM_LENGTH) %
    CURRICULUM_LENGTH;
  const lesson = CURRICULUM[index];
  if (!lesson) {
    throw new Error('The selected preview lesson does not exist.');
  }
  const layout = buildTodayPageLayout({
    pageSize: PAGE_SIZES[device],
    fullDate: descriptor.fullDate,
    lessonTitle: lesson.title,
    lessonInstruction: lesson.instruction,
    lessonSample: lesson.sample,
  });
  if (!layout.ok) {
    throw new Error(`Preview layout failed: ${layout.error.kind}`);
  }
  return {descriptor, index, lesson, layout: layout.value};
};
