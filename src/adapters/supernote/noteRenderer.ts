import {
  Element,
  Geometry,
  PluginCommAPI,
  PluginFileAPI,
  PluginNoteAPI,
  TextBox,
  type Rect as NativeRect,
} from 'sn-plugin-lib';

import {
  PAGE_COMPONENT_IDS,
  buildTodayPageLayout,
  markerForComponent,
  type BoxSpec,
  type LineSpec,
  type PageElementSpec,
  type TextSpec,
} from '../../domain/pageLayout';
import {err, ok, type Result} from '../../domain/result';
import type {
  DeviceFailure,
  TodayPageContent,
} from '../../ports/devicePort';
import {
  isRecordValue,
  readSdkBoolean,
  readSdkResult,
  sdkException,
  type SdkFailure,
} from './sdkResponse';

const PAGE_INDEX = 0;
const TEXT_CHUNK_SIZE = 6;
const GEOMETRY_CHUNK_SIZE = 12;

const normalizePath = (value: string): string =>
  value.replace(/\\/g, '/').replace(/\/+$/g, '');

const isElement = (value: unknown): value is Element =>
  isRecordValue(value) &&
  typeof value.uuid === 'string' &&
  typeof value.type === 'number';

const isElementArray = (value: unknown): value is Element[] =>
  Array.isArray(value) && value.every(isElement);

const isSize = (
  value: unknown,
): value is Readonly<{width: number; height: number}> =>
  isRecordValue(value) &&
  typeof value.width === 'number' &&
  Number.isFinite(value.width) &&
  typeof value.height === 'number' &&
  Number.isFinite(value.height);

const isString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const toDeviceFailure = (
  step: DeviceFailure['step'],
  failure: SdkFailure,
): DeviceFailure =>
  failure.code === undefined
    ? {
        kind: 'device-failure',
        step,
        message: failure.message,
      }
    : {
        kind: 'device-failure',
        step,
        message: failure.message,
        code: failure.code,
      };

const sanitizeText = (value: string): string =>
  value
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const createElement = async (
  type: number,
): Promise<Result<Element, DeviceFailure>> => {
  try {
    const response = await PluginCommAPI.createElement(type);
    const parsed = readSdkResult('createElement', response, isElement);
    return parsed.ok
      ? parsed
      : err(toDeviceFailure('create-element', parsed.error));
  } catch (error: unknown) {
    return err(
      toDeviceFailure('create-element', sdkException('createElement', error)),
    );
  }
};

const prepareTextElement = async (
  spec: TextSpec,
  marker: string,
): Promise<Result<Element, DeviceFailure>> => {
  const created = await createElement(Element.TYPE_TEXT);
  if (!created.ok) {
    return created;
  }

  const element = created.value;
  const textBox = new TextBox();
  textBox.fontSize = spec.fontSize;
  textBox.fontPath = null;
  textBox.textContentFull = sanitizeText(spec.text);
  textBox.textRect = spec.rect as NativeRect;
  textBox.textDigestData = null;
  textBox.textAlign = spec.align === 'center' ? 1 : 0;
  textBox.textBold = spec.bold ? 1 : 0;
  textBox.textItalics = 0;
  textBox.textFrameWidthType = 0;
  textBox.textFrameStyle = 0;
  textBox.textEditable = 1;

  element.pageNum = PAGE_INDEX;
  element.userData = marker;
  element.textBox = textBox;
  return ok(element);
};

const geometryWidth = (width: number): number =>
  Math.max(100, Math.round(width * 100));

const configureGeometry = (
  element: Element,
  marker: string,
  penWidth: number,
): Geometry => {
  const geometry = new Geometry();
  geometry.showLassoAfterInsert = false;
  geometry.penColor = 157;
  geometry.penType = 10;
  geometry.penWidth = penWidth;

  element.pageNum = PAGE_INDEX;
  element.userData = marker;
  element.thickness = penWidth;
  element.geometry = geometry;
  return geometry;
};

const prepareLineElement = async (
  spec: LineSpec,
  marker: string,
): Promise<Result<Element, DeviceFailure>> => {
  const created = await createElement(Element.TYPE_GEO);
  if (!created.ok) {
    return created;
  }

  const element = created.value;
  const geometry = configureGeometry(
    element,
    marker,
    geometryWidth(spec.width),
  );
  geometry.type = Geometry.TYPE_STRAIGHT_LINE;
  geometry.points = [spec.from, spec.to];
  return ok(element);
};

const prepareBoxElement = async (
  spec: BoxSpec,
  marker: string,
): Promise<Result<Element, DeviceFailure>> => {
  const created = await createElement(Element.TYPE_GEO);
  if (!created.ok) {
    return created;
  }

  const element = created.value;
  const geometry = configureGeometry(
    element,
    marker,
    geometryWidth(spec.width),
  );
  geometry.type = Geometry.TYPE_POLYGON;
  geometry.points = [
    {x: spec.rect.left, y: spec.rect.top},
    {x: spec.rect.right, y: spec.rect.top},
    {x: spec.rect.right, y: spec.rect.bottom},
    {x: spec.rect.left, y: spec.rect.bottom},
    {x: spec.rect.left, y: spec.rect.top},
  ];
  return ok(element);
};

const prepareElement = (
  spec: PageElementSpec,
  marker: string,
): Promise<Result<Element, DeviceFailure>> => {
  switch (spec.kind) {
    case 'text':
      return prepareTextElement(spec, marker);
    case 'line':
      return prepareLineElement(spec, marker);
    case 'box':
      return prepareBoxElement(spec, marker);
  }
};

const chunk = <Value>(
  values: readonly Value[],
  size: number,
): readonly (readonly Value[])[] => {
  const chunks: Value[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

const insertChunk = async (
  elements: readonly Element[],
): Promise<Result<void, DeviceFailure>> => {
  const attempt = async (): Promise<Result<void, DeviceFailure>> => {
    try {
      const response = await PluginCommAPI.insertPageElements(
        [...elements],
        PAGE_INDEX,
        null,
      );
      const parsed = readSdkBoolean('insertPageElements', response);
      return parsed.ok
        ? parsed
        : err(toDeviceFailure('insert-elements', parsed.error));
    } catch (error: unknown) {
      return err(
        toDeviceFailure(
          'insert-elements',
          sdkException('insertPageElements', error),
        ),
      );
    }
  };

  const first = await attempt();
  return first.ok ? first : attempt();
};

const markerPrefix = (date: string): string =>
  `supernote-today:v1:${date}:`;

export const readGeneratedComponentIds = async (
  notePath: string,
  date: string,
): Promise<Result<ReadonlySet<string>, DeviceFailure>> => {
  try {
    const response = await PluginFileAPI.getElements(PAGE_INDEX, notePath);
    const parsed = readSdkResult('getElements', response, isElementArray);
    if (!parsed.ok) {
      return err(toDeviceFailure('read-elements', parsed.error));
    }

    const prefix = markerPrefix(date);
    return ok(
      new Set(
        parsed.value
          .flatMap(element =>
            typeof element.userData === 'string' ? [element.userData] : [],
          )
          .filter(userData => userData.startsWith(prefix))
          .map(userData => userData.slice(prefix.length))
          .filter(componentId => componentId.length > 0),
      ),
    );
  } catch (error: unknown) {
    return err(
      toDeviceFailure('read-elements', sdkException('getElements', error)),
    );
  }
};

const ensureCurrentTarget = async (
  notePath: string,
): Promise<Result<void, DeviceFailure>> => {
  try {
    const opened = readSdkBoolean(
      'openFile',
      await PluginFileAPI.openFile(notePath, PAGE_INDEX),
    );
    if (!opened.ok) {
      return err(toDeviceFailure('open-target', opened.error));
    }

    const currentPath = readSdkResult(
      'getCurrentFilePath',
      await PluginCommAPI.getCurrentFilePath(),
      isString,
    );
    if (!currentPath.ok) {
      return err(toDeviceFailure('current-file', currentPath.error));
    }
    if (normalizePath(currentPath.value) !== normalizePath(notePath)) {
      return err({
        kind: 'device-failure',
        step: 'current-file',
        message: 'Supernote opened a different file than the dated note',
      });
    }

    const currentPage = readSdkResult(
      'getCurrentPageNum',
      await PluginCommAPI.getCurrentPageNum(),
      isNumber,
    );
    if (!currentPage.ok) {
      return err(toDeviceFailure('current-page', currentPage.error));
    }
    if (currentPage.value !== PAGE_INDEX) {
      const jumped = readSdkBoolean(
        'jumpToPage',
        await PluginCommAPI.jumpToPage(PAGE_INDEX),
      );
      if (!jumped.ok) {
        return err(toDeviceFailure('current-page', jumped.error));
      }
    }

    return ok(undefined);
  } catch (error: unknown) {
    return err(toDeviceFailure('open-target', sdkException('openFile', error)));
  }
};

export const renderMissingPageComponents = async (
  content: TodayPageContent,
  missingComponentIds: ReadonlySet<string>,
  insertGeneratedPage: boolean,
): Promise<Result<void, DeviceFailure>> => {
  const unknownIds = [...missingComponentIds].filter(
    componentId => !PAGE_COMPONENT_IDS.includes(componentId),
  );
  if (unknownIds.length > 0) {
    return err({
      kind: 'device-failure',
      step: 'verify-elements',
      message: `Unknown page components: ${unknownIds.join(', ')}`,
    });
  }

  const current = await ensureCurrentTarget(content.notePath);
  if (!current.ok) {
    return current;
  }

  if (insertGeneratedPage) {
    try {
      const insertedPage = readSdkBoolean(
        'insertNotePage',
        await PluginFileAPI.insertNotePage({
          notePath: content.notePath,
          page: PAGE_INDEX,
          template: 'style_white',
        }),
      );
      if (!insertedPage.ok) {
        return err(toDeviceFailure('create-note', insertedPage.error));
      }

      const jumped = readSdkBoolean(
        'jumpToPage',
        await PluginCommAPI.jumpToPage(PAGE_INDEX),
      );
      if (!jumped.ok) {
        return err(toDeviceFailure('current-page', jumped.error));
      }
    } catch (error: unknown) {
      return err(
        toDeviceFailure(
          'create-note',
          sdkException('insertNotePage', error),
        ),
      );
    }
  }

  let displaySize: Result<
    Readonly<{width: number; height: number}>,
    SdkFailure
  >;
  try {
    displaySize = readSdkResult(
      'getPageDisplaySize',
      await PluginCommAPI.getPageDisplaySize(),
      isSize,
    );
  } catch (error: unknown) {
    displaySize = err(sdkException('getPageDisplaySize', error));
  }
  if (!displaySize.ok) {
    return err(toDeviceFailure('page-size', displaySize.error));
  }

  const layout = buildTodayPageLayout({
    pageSize: displaySize.value,
    fullDate: content.fullDate,
    lessonTitle: content.lesson.title,
    lessonInstruction: content.lesson.instruction,
    lessonSample: content.lesson.sample,
  });
  if (!layout.ok) {
    return err({
      kind: 'device-failure',
      step: 'page-size',
      message: `Page layout failed: ${layout.error.kind}`,
    });
  }

  const selectedSpecs = layout.value.elements.filter(spec =>
    missingComponentIds.has(spec.id),
  );
  const prepared: Element[] = [];
  for (const spec of selectedSpecs) {
    const element = await prepareElement(
      spec,
      markerForComponent(content.date, spec.id),
    );
    if (!element.ok) {
      return element;
    }
    prepared.push(element.value);
  }

  const geometries = prepared.filter(
    element => element.type === Element.TYPE_GEO,
  );
  const texts = prepared.filter(element => element.type === Element.TYPE_TEXT);

  for (const elements of [
    ...chunk(geometries, GEOMETRY_CHUNK_SIZE),
    ...chunk(texts, TEXT_CHUNK_SIZE),
  ]) {
    const inserted = await insertChunk(elements);
    if (!inserted.ok) {
      return inserted;
    }
  }

  try {
    const saved = readSdkBoolean(
      'saveCurrentNote',
      await PluginNoteAPI.saveCurrentNote(),
    );
    if (!saved.ok) {
      return err(toDeviceFailure('save-note', saved.error));
    }

    const reloaded = readSdkBoolean(
      'reloadFile',
      await PluginCommAPI.reloadFile(),
    );
    if (!reloaded.ok) {
      return err(toDeviceFailure('reload-note', reloaded.error));
    }
  } catch (error: unknown) {
    return err(
      toDeviceFailure('save-note', sdkException('saveCurrentNote', error)),
    );
  }

  const verified = await readGeneratedComponentIds(
    content.notePath,
    content.date,
  );
  if (!verified.ok) {
    return verified;
  }

  const stillMissing = PAGE_COMPONENT_IDS.filter(
    componentId => !verified.value.has(componentId),
  );
  return stillMissing.length === 0
    ? ok(undefined)
    : err({
        kind: 'device-failure',
        step: 'verify-elements',
        message: `The generated page is incomplete. Missing: ${stillMissing.join(
          ', ',
        )}`,
      });
};
