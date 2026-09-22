import {Image} from 'react-native';
import {
  Element,
  FileUtils,
  PluginCommAPI,
  PluginFileAPI,
  PluginManager,
  TextBox,
} from 'sn-plugin-lib';

import {
  decideExistingNote,
  type NoteInspection,
} from '../../domain/noteDecision';
import {
  buildTodayPageLayout,
  TEMPLATE_FILES,
  type Size,
} from '../../domain/pageLayout';
import {err, ok, type Result} from '../../domain/result';
import type {
  DeviceFailure,
  DevicePort,
  DeviceStep,
  TodayPageContent,
} from '../../ports/devicePort';
import {ensureFileAccess} from './permissions';
import {
  isRecordValue,
  readSdkBoolean,
  readSdkResult,
  sdkException,
  type SdkFailure,
} from './sdkResponse';
import {templatePathCandidates} from './templatePaths';

const failure = (step: DeviceStep, message: string): DeviceFailure => ({
  kind: 'device-failure',
  step,
  message,
});

const fromSdk = (step: DeviceStep, problem: SdkFailure): DeviceFailure => ({
  kind: 'device-failure',
  step,
  message: `${problem.operation}: ${problem.message}`,
  ...(problem.code === undefined ? {} : {code: problem.code}),
});

const sdkValue = async <Value>(
  step: DeviceStep,
  operation: string,
  action: () => Promise<unknown>,
  guard: (value: unknown) => value is Value,
): Promise<Result<Value, DeviceFailure>> => {
  try {
    const result = readSdkResult(operation, await action(), guard);
    return result.ok ? result : err(fromSdk(step, result.error));
  } catch (error: unknown) {
    return err(fromSdk(step, sdkException(operation, error)));
  }
};

const sdkBoolean = async (
  step: DeviceStep,
  operation: string,
  action: () => Promise<unknown>,
): Promise<Result<void, DeviceFailure>> => {
  try {
    const result = readSdkBoolean(operation, await action());
    return result.ok ? result : err(fromSdk(step, result.error));
  } catch (error: unknown) {
    return err(fromSdk(step, sdkException(operation, error)));
  }
};

const directBoolean = async (
  step: DeviceStep,
  operation: string,
  action: () => Promise<unknown>,
): Promise<Result<void, DeviceFailure>> => {
  try {
    return (await action()) === true
      ? ok(undefined)
      : err(
          failure(
            step,
            `${operation} did not succeed. Check Plugin Preview firmware and file permissions.`,
          ),
        );
  } catch (error: unknown) {
    return err(fromSdk(step, sdkException(operation, error)));
  }
};

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const isPageCount = (value: unknown): value is number =>
  isCount(value) && value > 0;
const isSize = (value: unknown): value is Size =>
  isRecordValue(value) &&
  typeof value.width === 'number' &&
  typeof value.height === 'number';

const pageCount = (path: string): Promise<Result<number, DeviceFailure>> =>
  sdkValue(
    'inspect-note',
    'getNoteTotalPageNum',
    () => PluginFileAPI.getNoteTotalPageNum(path),
    isPageCount,
  );

const elementCount = (
  path: string,
  page: number,
): Promise<Result<number, DeviceFailure>> =>
  sdkValue(
    'inspect-note',
    `getElementCounts(page ${page})`,
    () => PluginFileAPI.getElementCounts(path, page),
    isCount,
  );

const noteExists: DevicePort['noteExists'] = async path => {
  try {
    const exists: unknown = await FileUtils.exists(path);
    return typeof exists === 'boolean'
      ? ok(exists)
      : err(
          failure(
            'check-note',
            'FileUtils.exists returned an invalid result. No note was changed.',
          ),
        );
  } catch (error: unknown) {
    return err(fromSdk('check-note', sdkException('FileUtils.exists', error)));
  }
};

const inspectNote = async (
  path: string,
): Promise<Result<NoteInspection, DeviceFailure>> => {
  const count = await pageCount(path);
  if (!count.ok) {
    return count;
  }
  const counts: number[] = [];
  if (count.value <= 2) {
    for (let page = 0; page < count.value; page += 1) {
      const elements = await elementCount(path, page);
      if (!elements.ok) {
        return elements;
      }
      counts.push(elements.value);
    }
  }
  return ok({pageCount: count.value, elementCounts: counts});
};

const resolveTemplate: DevicePort['resolveTemplate'] = async () => {
  try {
    const device = await PluginManager.getDeviceType();
    if (device !== 4 && device !== 5) {
      return err(
        failure(
          'template',
          `Device type ${device} has no bundled template. v0.2 supports Nomad and Manta portrait notes.`,
        ),
      );
    }
    const template = TEMPLATE_FILES[device === 4 ? 'nomad' : 'manta'];
    const uri =
      device === 4
        ? Image.resolveAssetSource(require('../../../assets/today_nomad.png'))
            ?.uri
        : Image.resolveAssetSource(require('../../../assets/today_manta.png'))
            ?.uri;
    const issues: string[] = [];
    let directory: string | null | undefined;
    try {
      directory = await PluginManager.getPluginDirPath();
    } catch (error: unknown) {
      issues.push(sdkException('getPluginDirPath', error).message);
    }
    const candidates = templatePathCandidates(
      uri,
      directory,
      template.packaged,
    );
    for (const candidate of candidates) {
      const exists = await noteExists(candidate);
      if (exists.ok && exists.value) {
        return ok(candidate);
      }
      issues.push(
        `${candidate}: ${exists.ok ? 'not found' : exists.error.message}`,
      );
    }
    return err(
      failure(
        'template',
        `Bundled PNG not found. Reinstall the complete v0.2 .snplg. Checked the resolved local image and installation directory. ${
          issues.join('; ') ||
          `Image URI: ${uri ?? 'unavailable'}; plugin directory unavailable.`
        }`,
      ),
    );
  } catch (error: unknown) {
    return err(fromSdk('template', sdkException('resolve bundled PNG', error)));
  }
};

const createNote: DevicePort['createNote'] = async (path, template) => {
  const exists = await noteExists(path);
  if (!exists.ok) {
    return exists;
  }
  if (exists.value) {
    return err(
      failure(
        'create-note',
        'The dated note appeared during creation. It was not overwritten. Retry to open it.',
      ),
    );
  }
  const created = await sdkBoolean('create-note', 'createNote', () =>
    PluginFileAPI.createNote({
      notePath: path,
      template,
      mode: 0,
      isPortrait: true,
    }),
  );
  if (!created.ok) {
    return created;
  }
  const count = await pageCount(path);
  return count.ok && count.value === 1
    ? ok(undefined)
    : count.ok
    ? err(
        failure(
          'create-note',
          'The new note did not contain exactly one page. No text was inserted.',
        ),
      )
    : count;
};

const insertTemplatePage: DevicePort['insertTemplatePage'] = async (
  path,
  template,
  originalPageCount,
) => {
  const inspection = await inspectNote(path);
  if (!inspection.ok) {
    return inspection;
  }
  const decision = decideExistingNote(inspection.value);
  if (
    !decision.ok ||
    decision.value !== 'repair-empty' ||
    inspection.value.pageCount !== originalPageCount
  ) {
    return err(
      failure(
        'insert-page',
        'The note changed or contains content. Repair stopped without changing it.',
      ),
    );
  }
  const inserted = await sdkBoolean('insert-page', 'insertNotePage', () =>
    PluginFileAPI.insertNotePage({notePath: path, page: 0, template}),
  );
  if (!inserted.ok) {
    return inserted;
  }
  const count = await pageCount(path);
  return count.ok && count.value === originalPageCount + 1
    ? ok(undefined)
    : count.ok
    ? err(
        failure(
          'insert-page',
          'The template page count could not be verified. No old pages were removed.',
        ),
      )
    : count;
};

interface CachedTextElement extends Record<string, unknown> {
  uuid: string;
  type: number;
  pageNum?: number;
  layerNum?: number;
  textBox?: TextBox;
}

const isCachedElement = (value: unknown): value is CachedTextElement =>
  isRecordValue(value) &&
  typeof value.uuid === 'string' &&
  value.uuid.length > 0 &&
  typeof value.type === 'number';

const insertTodayText = async (
  content: TodayPageContent,
): Promise<Result<void, DeviceFailure>> => {
  const size = await sdkValue(
    'page-size',
    'getPageSize',
    () => PluginFileAPI.getPageSize(content.notePath, 0),
    isSize,
  );
  if (!size.ok) {
    return size;
  }
  const layout = buildTodayPageLayout({
    pageSize: size.value,
    fullDate: content.fullDate,
    lessonTitle: content.lesson.title,
    lessonInstruction: content.lesson.instruction,
    lessonSample: content.lesson.sample,
  });
  if (!layout.ok) {
    return err(
      failure(
        'page-size',
        `Text layout failed (${layout.error.kind}). Only portrait 3:4 notes are supported. No text was inserted.`,
      ),
    );
  }
  const before = await elementCount(content.notePath, 0);
  if (!before.ok) {
    return before;
  }
  if (before.value !== 0) {
    return err(
      failure(
        'insert-text',
        'Page 0 now contains content. It was not modified. Retry to open the existing note.',
      ),
    );
  }

  const elements: CachedTextElement[] = [];
  try {
    for (const spec of layout.value.texts) {
      const allocated = await sdkValue(
        'create-element',
        'createElement(TYPE_TEXT)',
        () => PluginCommAPI.createElement(Element.TYPE_TEXT),
        isCachedElement,
      );
      if (!allocated.ok) {
        return allocated;
      }
      const element = allocated.value;
      elements.push(element);
      const box = new TextBox();
      box.fontSize = spec.fontSize;
      box.fontPath = null;
      box.textContentFull = spec.text;
      box.textRect = {...spec.rect};
      box.textDigestData = null;
      box.textAlign = 0;
      box.textBold = spec.bold ? 1 : 0;
      box.textItalics = 0;
      box.textFrameWidthType = 0;
      box.textFrameStyle = 0;
      box.textEditable = 0;
      element.pageNum = 0;
      element.layerNum = 0;
      element.textBox = box;
    }
    const inserted = await sdkBoolean('insert-text', 'insertElements', () =>
      PluginFileAPI.insertElements(content.notePath, 0, elements),
    );
    if (!inserted.ok) {
      return inserted;
    }
    // File-level insertion is already persisted. Saving a current editor here could overwrite it.
    const after = await elementCount(content.notePath, 0);
    if (!after.ok) {
      return after;
    }
    return after.value === elements.length
      ? ok(undefined)
      : err(
          failure(
            'verify-text',
            `Text insertion was incomplete: expected ${elements.length} elements, found ${after.value}. No old pages were removed. Do not delete a note containing handwriting.`,
          ),
        );
  } finally {
    for (const element of elements) {
      PluginCommAPI.recycleElement(element.uuid);
    }
  }
};

const removeEmptySeedPages: DevicePort['removeEmptySeedPages'] = async (
  path,
  originalPageCount,
) => {
  if (originalPageCount !== 1 && originalPageCount !== 2) {
    return err(
      failure(
        'remove-empty-pages',
        'Only one or two verified empty seed pages may be removed.',
      ),
    );
  }
  for (let page = originalPageCount; page >= 1; page -= 1) {
    const count = await pageCount(path);
    if (!count.ok) {
      return count;
    }
    if (count.value !== page + 1) {
      return err(
        failure(
          'remove-empty-pages',
          'Page count changed during repair. Remaining pages were kept.',
        ),
      );
    }
    // Recheck all remaining seed pages before each destructive operation.
    for (let seed = 1; seed <= page; seed += 1) {
      const elements = await elementCount(path, seed);
      if (!elements.ok) {
        return elements;
      }
      if (elements.value !== 0) {
        return err(
          failure(
            'remove-empty-pages',
            `Page ${seed + 1} contains content. No further pages were removed.`,
          ),
        );
      }
    }
    const removed = await sdkBoolean(
      'remove-empty-pages',
      `removeNotePage(${page})`,
      () => PluginFileAPI.removeNotePage(path, page),
    );
    if (!removed.ok) {
      return err({
        ...removed.error,
        message: `${removed.error.message}. The new page is retained; inspect remaining blank pages in native Notes.`,
      });
    }
    const after = await pageCount(path);
    if (!after.ok) {
      return after;
    }
    if (after.value !== page) {
      return err(
        failure(
          'remove-empty-pages',
          'Page deletion could not be verified. No further pages were removed.',
        ),
      );
    }
  }
  return ok(undefined);
};

export const supernoteDeviceAdapter: DevicePort = {
  ensureFileAccess,
  noteExists,
  resolveTemplate,
  createNote,
  inspectNote,
  insertTemplatePage,
  insertTodayText,
  removeEmptySeedPages,
  ensureNoteDirectory: async path => {
    const exists = await noteExists(path);
    return !exists.ok
      ? exists
      : exists.value
      ? ok(undefined)
      : directBoolean('ensure-directory', 'Create journal directory', () =>
          FileUtils.makeDir(path),
        );
  },
  closePluginView: () =>
    directBoolean('close-view', 'Close plugin view', () =>
      PluginManager.closePluginView(),
    ),
  openNote: path =>
    sdkBoolean('open-note', 'openFile', () => PluginFileAPI.openFile(path, 0)),
  showPluginView: () =>
    directBoolean('show-view', 'Show plugin view', () =>
      PluginManager.showPluginView(),
    ),
  diagnostics: async () => {
    try {
      const deviceType = await PluginManager.getDeviceType();
      return Number.isInteger(deviceType)
        ? ok({
            deviceType,
            deviceName:
              deviceType === 4
                ? 'Nomad'
                : deviceType === 5
                ? 'Manta'
                : `Unsupported (${deviceType})`,
          })
        : err(
            failure(
              'device-info',
              'Supernote returned an invalid device type.',
            ),
          );
    } catch (error: unknown) {
      return err(fromSdk('device-info', sdkException('getDeviceType', error)));
    }
  },
};
