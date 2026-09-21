import {
  FileUtils,
  PluginCommAPI,
  PluginFileAPI,
  PluginManager,
} from 'sn-plugin-lib';

import {err, ok, type Result} from '../../domain/result';
import type {
  DeviceDiagnostics,
  DeviceFailure,
  DevicePort,
  NotePageInspection,
} from '../../ports/devicePort';
import {ensureFileAccess} from './permissions';
import {
  readGeneratedComponentIds,
  renderMissingPageComponents,
} from './noteRenderer';
import {
  isRecordValue,
  readSdkBoolean,
  readSdkResult,
  sdkException,
  type SdkFailure,
} from './sdkResponse';

interface TemplateCandidate {
  readonly name: string;
  readonly vUri: string;
}

const normalizePath = (value: string): string =>
  value.replace(/\\/g, '/').replace(/\/+$/g, '');

const toDeviceFailure = (
  step: DeviceFailure['step'],
  failure: SdkFailure,
): DeviceFailure =>
  failure.code === undefined
    ? {kind: 'device-failure', step, message: failure.message}
    : {
        kind: 'device-failure',
        step,
        message: failure.message,
        code: failure.code,
      };

const isString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

const templateFromUnknown = (value: unknown): TemplateCandidate | null => {
  if (!isRecordValue(value) || typeof value.name !== 'string') {
    return null;
  }

  return {
    name: value.name,
    vUri: typeof value.vUri === 'string' ? value.vUri : '',
  };
};

const extractTemplates = (value: unknown): readonly TemplateCandidate[] => {
  const direct = Array.isArray(value) ? value : null;
  const wrapped =
    isRecordValue(value) && value.success === true && Array.isArray(value.result)
      ? value.result
      : null;
  const source = direct ?? wrapped ?? [];

  return source
    .map(templateFromUnknown)
    .filter((template): template is TemplateCandidate => template !== null);
};

const blankTemplateCandidates = async (): Promise<readonly string[]> => {
  const candidates = ['style_white'];
  const raw = await PluginCommAPI.getNoteSystemTemplates();
  const discovered = extractTemplates(raw).filter(template =>
    /white|blank|plain/i.test(`${template.name} ${template.vUri}`),
  );

  for (const template of discovered) {
    candidates.push(template.name);
    if (template.vUri.length > 0) {
      candidates.push(template.vUri);
    }
  }

  return [...new Set(candidates)];
};

const createNote = async (
  notePath: string,
): Promise<Result<void, DeviceFailure>> => {
  let candidates: readonly string[];
  try {
    candidates = await blankTemplateCandidates();
  } catch (error: unknown) {
    return err(
      toDeviceFailure(
        'templates',
        sdkException('getNoteSystemTemplates', error),
      ),
    );
  }

  let lastFailure: DeviceFailure = {
    kind: 'device-failure',
    step: 'create-note',
    message: 'No blank note template was accepted by the device',
  };

  for (const template of candidates) {
    try {
      const parsed = readSdkBoolean(
        'createNote',
        await PluginFileAPI.createNote({
          notePath,
          template,
          mode: 0,
          isPortrait: true,
        }),
      );
      if (parsed.ok) {
        return parsed;
      }
      lastFailure = toDeviceFailure('create-note', parsed.error);
    } catch (error: unknown) {
      lastFailure = toDeviceFailure(
        'create-note',
        sdkException('createNote', error),
      );
    }
  }

  return err(lastFailure);
};

const ensureNoteDirectory = async (
  absolutePath: string,
): Promise<Result<void, DeviceFailure>> => {
  try {
    if (await FileUtils.exists(absolutePath)) {
      return ok(undefined);
    }
    const created = await FileUtils.makeDir(absolutePath);
    return created
      ? ok(undefined)
      : err({
          kind: 'device-failure',
          step: 'create-note',
          message: `Could not create journal directory: ${absolutePath}`,
        });
  } catch (error: unknown) {
    return err({
      kind: 'device-failure',
      step: 'create-note',
      message:
        error instanceof Error
          ? error.message
          : 'Could not create the journal directory',
    });
  }
};

const noteExists = async (
  absolutePath: string,
): Promise<Result<boolean, DeviceFailure>> => {
  try {
    return ok(await FileUtils.exists(absolutePath));
  } catch (error: unknown) {
    return err({
      kind: 'device-failure',
      step: 'read-elements',
      message:
        error instanceof Error
          ? error.message
          : 'Could not check whether the dated note exists',
    });
  }
};

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 0;

const inspectNotePage = async (
  notePath: string,
): Promise<Result<NotePageInspection, DeviceFailure>> => {
  try {
    const pageCount = readSdkResult(
      'getNoteTotalPageNum',
      await PluginFileAPI.getNoteTotalPageNum(notePath),
      isNonNegativeInteger,
    );
    if (!pageCount.ok) {
      return err(toDeviceFailure('read-elements', pageCount.error));
    }

    const elementCount = readSdkResult(
      'getElementCounts',
      await PluginFileAPI.getElementCounts(notePath, 0),
      isNonNegativeInteger,
    );
    if (!elementCount.ok) {
      return err(toDeviceFailure('read-elements', elementCount.error));
    }

    return ok({
      pageCount: pageCount.value,
      pageZeroElementCount: elementCount.value,
    });
  } catch (error: unknown) {
    return err(
      toDeviceFailure(
        'read-elements',
        sdkException('inspectNotePage', error),
      ),
    );
  }
};

const closePluginView = async (): Promise<Result<void, DeviceFailure>> => {
  try {
    return (await PluginManager.closePluginView())
      ? ok(undefined)
      : err({
          kind: 'device-failure',
          step: 'close-view',
          message: 'Supernote did not close the plugin view',
        });
  } catch (error: unknown) {
    return err({
      kind: 'device-failure',
      step: 'close-view',
      message:
        error instanceof Error ? error.message : 'Closing the plugin view failed',
    });
  }
};

const showPluginView = async (): Promise<Result<void, DeviceFailure>> => {
  try {
    return (await PluginManager.showPluginView())
      ? ok(undefined)
      : err({
          kind: 'device-failure',
          step: 'show-view',
          message: 'Supernote did not show the plugin view',
        });
  } catch (error: unknown) {
    return err({
      kind: 'device-failure',
      step: 'show-view',
      message:
        error instanceof Error ? error.message : 'Showing the plugin view failed',
    });
  }
};

const currentFilePath = async (): Promise<Result<string, DeviceFailure>> => {
  try {
    const parsed = readSdkResult(
      'getCurrentFilePath',
      await PluginCommAPI.getCurrentFilePath(),
      isString,
    );
    return parsed.ok
      ? parsed
      : err(toDeviceFailure('current-file', parsed.error));
  } catch (error: unknown) {
    return err(
      toDeviceFailure(
        'current-file',
        sdkException('getCurrentFilePath', error),
      ),
    );
  }
};

const handoffGeneratedNote = async (
  notePath: string,
): Promise<Result<void, DeviceFailure>> => {
  const current = await currentFilePath();
  if (!current.ok) {
    return current;
  }
  if (normalizePath(current.value) !== normalizePath(notePath)) {
    return err({
      kind: 'device-failure',
      step: 'current-file',
      message: 'The generated note is not the current native NOTE file',
    });
  }

  return closePluginView();
};

const handoffExistingNote = async (
  notePath: string,
): Promise<Result<void, DeviceFailure>> => {
  const current = await currentFilePath();
  if (current.ok && normalizePath(current.value) === normalizePath(notePath)) {
    return closePluginView();
  }

  const closed = await closePluginView();
  if (!closed.ok) {
    return closed;
  }

  try {
    const opened = readSdkBoolean(
      'openFile',
      await PluginFileAPI.openFile(notePath, 0),
    );
    if (opened.ok) {
      return opened;
    }

    await showPluginView();
    return err(toDeviceFailure('open-existing', opened.error));
  } catch (error: unknown) {
    await showPluginView();
    return err(
      toDeviceFailure('open-existing', sdkException('openFile', error)),
    );
  }
};

const DEVICE_NAMES: Readonly<Record<number, string>> = {
  0: 'A5',
  1: 'A6',
  2: 'A6 X',
  3: 'A5 X',
  4: 'Nomad',
  5: 'Manta',
};

const diagnostics = async (): Promise<
  Result<DeviceDiagnostics, DeviceFailure>
> => {
  try {
    const deviceType = await PluginManager.getDeviceType();
    if (!Number.isInteger(deviceType)) {
      return err({
        kind: 'device-failure',
        step: 'device-info',
        message: 'Supernote returned an invalid device type',
      });
    }

    return ok({
      deviceType,
      deviceName: DEVICE_NAMES[deviceType] ?? `Unknown (${deviceType})`,
    });
  } catch (error: unknown) {
    return err({
      kind: 'device-failure',
      step: 'device-info',
      message:
        error instanceof Error
          ? error.message
          : 'Could not read device information',
    });
  }
};

export const supernoteDeviceAdapter: DevicePort = {
  ensureFileAccess,
  ensureNoteDirectory,
  noteExists,
  createNote,
  readGeneratedComponentIds,
  inspectNotePage,
  renderMissingPageComponents,
  handoffGeneratedNote,
  handoffExistingNote,
  closePluginView,
  showPluginView,
  diagnostics,
};
