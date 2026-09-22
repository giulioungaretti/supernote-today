import {CURRICULUM} from './curriculum';
import {
  buildTemplateLayout,
  buildTodayPageLayout,
  estimatedTextWidth,
  PAGE_SIZES,
} from './pageLayout';

describe.each(Object.values(PAGE_SIZES))(
  'layout at $width x $height',
  pageSize => {
    test('reserves more than half the page height for journaling', () => {
      const layout = buildTemplateLayout(pageSize);
      expect(layout.ok).toBe(true);
      if (!layout.ok) {
        throw new Error(layout.error.kind);
      }
      expect(
        layout.value.journal.bottom - layout.value.journal.top,
      ).toBeGreaterThan(pageSize.height * 0.5);
      expect(layout.value.labels.map(label => label.text)).toEqual([
        'PLAN',
        'JOURNAL',
        'CURSIVE - 10 MIN',
      ]);
      for (const rect of layout.value.ink) {
        expect(rect.left).toBeGreaterThanOrEqual(0);
        expect(rect.right).toBeLessThanOrEqual(pageSize.width);
        expect(rect.bottom).toBeLessThanOrEqual(pageSize.height);
        expect(rect.right).toBeGreaterThan(rect.left);
        expect(rect.bottom).toBeGreaterThan(rect.top);
      }
    });

    test.each(CURRICULUM)(
      'fits four single-line text boxes for $id without touching the ruled areas',
      lesson => {
        const result = buildTodayPageLayout({
          pageSize,
          fullDate: 'Wednesday, September 30, 2026',
          lessonTitle: lesson.title,
          lessonInstruction: lesson.instruction,
          lessonSample: lesson.sample,
        });
        expect(result.ok).toBe(true);
        if (!result.ok) {
          throw new Error(JSON.stringify(result.error));
        }
        expect(result.value.texts).toHaveLength(4);
        for (const spec of result.value.texts) {
          expect(estimatedTextWidth(spec.text, spec.fontSize)).toBeLessThan(
            spec.rect.right - spec.rect.left,
          );
          expect(spec.fontSize * 1.35).toBeLessThan(
            spec.rect.bottom - spec.rect.top,
          );
          expect(spec.rect.bottom).toBeLessThan(pageSize.height);
          expect(spec.text).not.toContain('\n');
        }
        const date = result.value.texts[0];
        const sample = result.value.texts[3];
        expect(date?.rect.bottom).toBeLessThan(pageSize.height * 0.085);
        expect(sample?.rect.bottom).toBeLessThan(
          pageSize.height * (1620 / 1872),
        );
      },
    );
  },
);

test.each([
  {width: 0, height: 0},
  {width: NaN, height: 1872},
  {width: 1872, height: 1404},
  {width: 1404, height: Infinity},
])('rejects unsupported page size %j', pageSize => {
  expect(buildTemplateLayout(pageSize).ok).toBe(false);
});

test('fails explicitly on text overflow, not truncation or silent wrapping', () => {
  const result = buildTodayPageLayout({
    pageSize: PAGE_SIZES.nomad,
    fullDate: 'Today',
    lessonTitle: 'Lesson',
    lessonInstruction: 'W'.repeat(1000),
    lessonSample: 'sample',
  });
  expect(result).toEqual({
    ok: false,
    error: {kind: 'text-overflow', field: 'lesson-instruction'},
  });
});
