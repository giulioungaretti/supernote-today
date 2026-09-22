import {err, ok, type Result} from './result';

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export const PAGE_SIZES = {
  nomad: {width: 1404, height: 1872},
  manta: {width: 1920, height: 2560},
} as const;

export type TemplateId = keyof typeof PAGE_SIZES;

export const TEMPLATE_FILES: Readonly<
  Record<TemplateId, Readonly<{source: string; packaged: string}>>
> = {
  nomad: {
    source: 'assets/today_nomad.png',
    packaged: 'drawable-mdpi/assets_today_nomad.png',
  },
  manta: {
    source: 'assets/today_manta.png',
    packaged: 'drawable-mdpi/assets_today_manta.png',
  },
};

export interface TemplateLabel {
  readonly text: string;
  readonly left: number;
  readonly top: number;
  readonly pixelSize: number;
}

export interface TemplateLayout {
  readonly pageSize: Size;
  readonly ink: readonly Rect[];
  readonly labels: readonly TemplateLabel[];
  readonly journal: Rect;
}

export interface TextSpec {
  readonly id: 'date' | 'lesson-title' | 'lesson-instruction' | 'lesson-sample';
  readonly rect: Rect;
  readonly text: string;
  readonly fontSize: number;
  readonly bold: boolean;
}

export interface TodayPageLayout {
  readonly pageSize: Size;
  readonly texts: readonly TextSpec[];
}

export type PageLayoutError =
  | Readonly<{kind: 'unsupported-size'; size: Size}>
  | Readonly<{kind: 'invalid-text'; field: string}>
  | Readonly<{kind: 'text-overflow'; field: string}>;

export interface PageLayoutInput {
  readonly pageSize: Size;
  readonly fullDate: string;
  readonly lessonTitle: string;
  readonly lessonInstruction: string;
  readonly lessonSample: string;
}

const isPortraitPage = ({width, height}: Size): boolean =>
  Number.isFinite(width) &&
  Number.isFinite(height) &&
  width >= 700 &&
  height >= 900 &&
  Math.abs(width / height - 3 / 4) < 0.001;

const scaledRect = (
  size: Size,
  left: number,
  top: number,
  right: number,
  bottom: number,
): Rect => ({
  left: Math.round((left * size.width) / PAGE_SIZES.nomad.width),
  top: Math.round((top * size.height) / PAGE_SIZES.nomad.height),
  right: Math.round((right * size.width) / PAGE_SIZES.nomad.width),
  bottom: Math.round((bottom * size.height) / PAGE_SIZES.nomad.height),
});

// PNG generation, browser preview, and native TextBoxes share this coordinate grid.
export const buildTemplateLayout = (
  pageSize: Size,
): Result<TemplateLayout, PageLayoutError> => {
  if (!isPortraitPage(pageSize)) {
    return err({kind: 'unsupported-size', size: pageSize});
  }

  const ink: Rect[] = [];
  const fill = (
    left: number,
    top: number,
    right: number,
    bottom: number,
  ): void => {
    ink.push(scaledRect(pageSize, left, top, right, bottom));
  };

  for (const y of [224, 276, 328]) {
    fill(96, y - 24, 120, y - 22);
    fill(96, y - 2, 120, y);
    fill(96, y - 24, 98, y);
    fill(118, y - 24, 120, y);
    fill(148, y - 1, 1308, y + 1);
  }
  for (let row = 0; row < 12; row += 1) {
    fill(96, 448 + row * 80, 1308, 450 + row * 80);
  }
  for (const y of [1620, 1694, 1768, 1840]) {
    fill(96, y, 1308, y + 2);
  }

  const label = (text: string, top: number): TemplateLabel => ({
    text,
    left: Math.round((96 * pageSize.width) / PAGE_SIZES.nomad.width),
    top: Math.round((top * pageSize.height) / PAGE_SIZES.nomad.height),
    pixelSize: Math.max(
      1,
      Math.round((4 * pageSize.width) / PAGE_SIZES.nomad.width),
    ),
  });

  return ok({
    pageSize,
    ink,
    labels: [
      label('PLAN', 160),
      label('JOURNAL', 372),
      label('CURSIVE - 10 MIN', 1372),
    ],
    journal: scaledRect(pageSize, 96, 360, 1308, 1340),
  });
};

export const estimatedTextWidth = (text: string, fontSize: number): number =>
  [...text].reduce((width, character) => {
    const advance = /[MW@#%&]/.test(character)
      ? 1.05
      : /[ilI1.,'!:;| ]/.test(character)
      ? 0.4
      : /[A-Z]/.test(character)
      ? 0.82
      : 0.7;
    return width + advance * fontSize;
  }, 0);

export const buildTodayPageLayout = (
  input: PageLayoutInput,
): Result<TodayPageLayout, PageLayoutError> => {
  if (!isPortraitPage(input.pageSize)) {
    return err({kind: 'unsupported-size', size: input.pageSize});
  }

  const scale = input.pageSize.width / PAGE_SIZES.nomad.width;
  const slots = [
    {
      id: 'date',
      value: input.fullDate,
      top: 48,
      bottom: 132,
      font: 42,
      bold: true,
    },
    {
      id: 'lesson-title',
      value: input.lessonTitle,
      top: 1420,
      bottom: 1466,
      font: 28,
      bold: true,
    },
    {
      id: 'lesson-instruction',
      value: input.lessonInstruction,
      top: 1470,
      bottom: 1516,
      font: 24,
      bold: false,
    },
    {
      id: 'lesson-sample',
      value: input.lessonSample,
      top: 1520,
      bottom: 1570,
      font: 30,
      bold: false,
    },
  ] as const;
  const texts: TextSpec[] = [];

  for (const slot of slots) {
    if (!/^[\x20-\x7E]+$/.test(slot.value) || slot.value.trim().length === 0) {
      return err({kind: 'invalid-text', field: slot.id});
    }
    const rect = scaledRect(input.pageSize, 96, slot.top, 1308, slot.bottom);
    const availableWidth = rect.right - rect.left - 24 * scale;
    const fontSize = Math.floor(
      Math.min(
        slot.font * scale,
        availableWidth / estimatedTextWidth(slot.value, 1),
      ),
    );
    if (fontSize < 20 * scale) {
      return err({kind: 'text-overflow', field: slot.id});
    }
    texts.push({
      id: slot.id,
      rect,
      text: slot.value,
      fontSize,
      bold: slot.bold,
    });
  }

  return ok({pageSize: input.pageSize, texts});
};
