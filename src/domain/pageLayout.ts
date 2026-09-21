import {err, ok, type Result} from './result';

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface TextSpec {
  readonly kind: 'text';
  readonly id: string;
  readonly rect: Rect;
  readonly text: string;
  readonly fontSize: number;
  readonly bold: boolean;
  readonly align: 'left' | 'center';
}

export interface LineSpec {
  readonly kind: 'line';
  readonly id: string;
  readonly from: Point;
  readonly to: Point;
  readonly width: number;
}

export interface BoxSpec {
  readonly kind: 'box';
  readonly id: string;
  readonly rect: Rect;
  readonly width: number;
}

export type PageElementSpec = TextSpec | LineSpec | BoxSpec;

export interface TodayPageLayout {
  readonly pageSize: Size;
  readonly sections: Readonly<{
    header: Rect;
    plan: Rect;
    journal: Rect;
    practice: Rect;
  }>;
  readonly elements: readonly PageElementSpec[];
}

export type PageLayoutError =
  | Readonly<{kind: 'invalid-size'; size: Size}>
  | Readonly<{kind: 'content-overflow'; size: Size}>;

export interface PageLayoutInput {
  readonly pageSize: Size;
  readonly fullDate: string;
  readonly lessonTitle: string;
  readonly lessonInstruction: string;
  readonly lessonSample: string;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const rect = (
  left: number,
  top: number,
  right: number,
  bottom: number,
): Rect => ({left, top, right, bottom});

const rectHeight = (value: Rect): number => value.bottom - value.top;
const rectWidth = (value: Rect): number => value.right - value.left;

const text = (
  id: string,
  bounds: Rect,
  value: string,
  fontSize: number,
  bold = false,
  align: 'left' | 'center' = 'left',
): TextSpec => ({
  kind: 'text',
  id,
  rect: bounds,
  text: value,
  fontSize,
  bold,
  align,
});

const line = (
  id: string,
  from: Point,
  to: Point,
  width: number,
): LineSpec => ({
  kind: 'line',
  id,
  from,
  to,
  width,
});

const box = (id: string, bounds: Rect, width: number): BoxSpec => ({
  kind: 'box',
  id,
  rect: bounds,
  width,
});

const journalRuleIds = Array.from(
  {length: 10},
  (_, index) => `journal-rule-${index + 1}`,
);
const practiceRuleIds = Array.from(
  {length: 4},
  (_, index) => `practice-rule-${index + 1}`,
);
const planRowIds = Array.from({length: 3}, (_, index) => index + 1).flatMap(
  row => [`plan-checkbox-${row}`, `plan-line-${row}`],
);

export const PAGE_COMPONENT_IDS: readonly string[] = [
  'title',
  'plan-heading',
  ...planRowIds,
  'journal-heading',
  ...journalRuleIds,
  'practice-heading',
  'practice-instruction',
  'practice-sample',
  ...practiceRuleIds,
] as const;

export const markerForComponent = (
  date: string,
  componentId: string,
): string => `supernote-today:v1:${date}:${componentId}`;

export const buildTodayPageLayout = (
  input: PageLayoutInput,
): Result<TodayPageLayout, PageLayoutError> => {
  const {width, height} = input.pageSize;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return err({kind: 'invalid-size', size: input.pageSize});
  }

  const left = clamp(width * 0.08, 96, 160);
  const right = width - clamp(width * 0.045, 56, 104);
  const top = clamp(height * 0.03, 48, 84);
  const bottom = height - clamp(height * 0.03, 48, 84);
  const gap = clamp(height * 0.012, 18, 32);
  const headerHeight = clamp(height * 0.07, 104, 172);
  const planHeight = clamp(height * 0.16, 260, 396);
  const practiceHeight = clamp(height * 0.22, 372, 568);

  const header = rect(left, top, right, top + headerHeight);
  const plan = rect(
    left,
    header.bottom + gap,
    right,
    header.bottom + gap + planHeight,
  );
  const practice = rect(
    left,
    bottom - practiceHeight,
    right,
    bottom,
  );
  const journal = rect(left, plan.bottom + gap, right, practice.top - gap);

  if (
    rectWidth(journal) <= 0 ||
    rectHeight(journal) <= 0 ||
    journal.bottom <= journal.top
  ) {
    return err({kind: 'content-overflow', size: input.pageSize});
  }

  const contentWidth = right - left;
  const titleFont = clamp(width * 0.03, 34, 54);
  const headingFont = clamp(width * 0.019, 24, 36);
  const bodyFont = clamp(width * 0.016, 20, 31);
  const fineLineWidth = clamp(width * 0.00125, 1.5, 2.8);

  const elements: PageElementSpec[] = [
    text('title', header, input.fullDate, titleFont, true),
  ];

  const planHeadingHeight = clamp(rectHeight(plan) * 0.19, 48, 70);
  elements.push(
    text(
      'plan-heading',
      rect(plan.left, plan.top, plan.right, plan.top + planHeadingHeight),
      'Daily plan',
      headingFont,
      true,
    ),
  );

  const planRowsTop = plan.top + planHeadingHeight;
  const planRowHeight = (plan.bottom - planRowsTop) / 3;
  const checkboxSize = clamp(planRowHeight * 0.36, 30, 48);
  for (let index = 0; index < 3; index += 1) {
    const centerY = planRowsTop + planRowHeight * (index + 0.5);
    const checkboxTop = centerY - checkboxSize / 2;
    const checkboxLeft = plan.left + contentWidth * 0.012;
    const row = index + 1;
    elements.push(
      box(
        `plan-checkbox-${row}`,
        rect(
          checkboxLeft,
          checkboxTop,
          checkboxLeft + checkboxSize,
          checkboxTop + checkboxSize,
        ),
        fineLineWidth,
      ),
      line(
        `plan-line-${row}`,
        {
          x: checkboxLeft + checkboxSize + contentWidth * 0.025,
          y: centerY + checkboxSize * 0.2,
        },
        {x: plan.right, y: centerY + checkboxSize * 0.2},
        fineLineWidth,
      ),
    );
  }

  const journalHeadingHeight = clamp(rectHeight(journal) * 0.08, 48, 68);
  elements.push(
    text(
      'journal-heading',
      rect(
        journal.left,
        journal.top,
        journal.right,
        journal.top + journalHeadingHeight,
      ),
      'Journal',
      headingFont,
      true,
    ),
  );

  const journalRulesTop = journal.top + journalHeadingHeight;
  const journalRuleGap =
    (journal.bottom - journalRulesTop) / journalRuleIds.length;
  journalRuleIds.forEach((id, index) => {
    const y = journalRulesTop + journalRuleGap * (index + 1);
    elements.push(
      line(id, {x: journal.left, y}, {x: journal.right, y}, fineLineWidth),
    );
  });

  const practiceHeadingHeight = clamp(rectHeight(practice) * 0.14, 52, 76);
  const instructionHeight = clamp(rectHeight(practice) * 0.17, 62, 96);
  const sampleHeight = clamp(rectHeight(practice) * 0.16, 58, 90);
  const practiceHeadingBottom = practice.top + practiceHeadingHeight;
  const instructionBottom = practiceHeadingBottom + instructionHeight;
  const sampleBottom = instructionBottom + sampleHeight;

  elements.push(
    text(
      'practice-heading',
      rect(
        practice.left,
        practice.top,
        practice.right,
        practiceHeadingBottom,
      ),
      `10-minute cursive: ${input.lessonTitle}`,
      headingFont,
      true,
    ),
    text(
      'practice-instruction',
      rect(
        practice.left,
        practiceHeadingBottom,
        practice.right,
        instructionBottom,
      ),
      input.lessonInstruction,
      bodyFont,
    ),
    text(
      'practice-sample',
      rect(
        practice.left,
        instructionBottom,
        practice.right,
        sampleBottom,
      ),
      input.lessonSample,
      bodyFont,
    ),
  );

  const practiceRuleGap =
    (practice.bottom - sampleBottom) / practiceRuleIds.length;
  practiceRuleIds.forEach((id, index) => {
    const y = sampleBottom + practiceRuleGap * (index + 1);
    elements.push(
      line(id, {x: practice.left, y}, {x: practice.right, y}, fineLineWidth),
    );
  });

  return ok({
    pageSize: input.pageSize,
    sections: {header, plan, journal, practice},
    elements,
  });
};
