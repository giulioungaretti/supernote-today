import {
  PAGE_COMPONENT_IDS,
  buildTodayPageLayout,
  type Rect,
  type Size,
} from './pageLayout';

const area = (value: Rect): number =>
  (value.right - value.left) * (value.bottom - value.top);

const expectLayoutInvariants = (size: Size): void => {
  const result = buildTodayPageLayout({
    pageSize: size,
    fullDate: 'Monday, September 21, 2026',
    lessonTitle: 'Entry and exit strokes',
    lessonInstruction: 'Keep each light stroke smooth and evenly spaced.',
    lessonSample: '////  ////  ////',
  });

  expect(result.ok).toBe(true);
  if (!result.ok) {
    return;
  }

  const {sections, elements} = result.value;
  expect(elements.map(element => element.id)).toEqual(PAGE_COMPONENT_IDS);
  expect(new Set(elements.map(element => element.id)).size).toBe(
    PAGE_COMPONENT_IDS.length,
  );

  for (const section of Object.values(sections)) {
    expect(section.left).toBeGreaterThanOrEqual(0);
    expect(section.top).toBeGreaterThanOrEqual(0);
    expect(section.right).toBeLessThanOrEqual(size.width);
    expect(section.bottom).toBeLessThanOrEqual(size.height);
    expect(section.right).toBeGreaterThan(section.left);
    expect(section.bottom).toBeGreaterThan(section.top);
  }

  expect(sections.header.bottom).toBeLessThan(sections.plan.top);
  expect(sections.plan.bottom).toBeLessThan(sections.journal.top);
  expect(sections.journal.bottom).toBeLessThan(sections.practice.top);
  expect(area(sections.journal)).toBeGreaterThan(area(sections.plan));
  expect(area(sections.journal)).toBeGreaterThan(area(sections.practice));

  for (const element of elements) {
    if (element.kind === 'line') {
      for (const point of [element.from, element.to]) {
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(size.width);
        expect(point.y).toBeLessThanOrEqual(size.height);
      }
    } else {
      expect(element.rect.left).toBeGreaterThanOrEqual(0);
      expect(element.rect.top).toBeGreaterThanOrEqual(0);
      expect(element.rect.right).toBeLessThanOrEqual(size.width);
      expect(element.rect.bottom).toBeLessThanOrEqual(size.height);
    }
  }
};

describe('pageLayout', () => {
  it.each([
    {width: 1404, height: 1872},
    {width: 1920, height: 2560},
    {width: 1600, height: 2200},
  ])('fits all content inside $width x $height', size => {
    expectLayoutInvariants(size);
  });

  it('rejects invalid page sizes', () => {
    expect(
      buildTodayPageLayout({
        pageSize: {width: 0, height: 1872},
        fullDate: 'Monday, September 21, 2026',
        lessonTitle: 'Entry and exit strokes',
        lessonInstruction: 'Keep each stroke smooth.',
        lessonSample: '////',
      }),
    ).toEqual({
      ok: false,
      error: {kind: 'invalid-size', size: {width: 0, height: 1872}},
    });
  });
});
