import type {CursiveLesson} from '../domain/curriculum';
import type {LocalDate} from '../domain/localDate';
import type {Result} from '../domain/result';

export type DeviceStep =
  | 'permission-read'
  | 'permission-write'
  | 'templates'
  | 'create-note'
  | 'read-elements'
  | 'open-target'
  | 'current-file'
  | 'current-page'
  | 'page-size'
  | 'create-element'
  | 'insert-elements'
  | 'save-note'
  | 'reload-note'
  | 'verify-elements'
  | 'close-view'
  | 'open-existing'
  | 'show-view'
  | 'device-info';

export interface DeviceFailure {
  readonly kind: 'device-failure';
  readonly step: DeviceStep;
  readonly message: string;
  readonly code?: number;
}

export interface TodayPageContent {
  readonly notePath: string;
  readonly date: LocalDate;
  readonly fullDate: string;
  readonly lesson: CursiveLesson;
}

export interface DeviceDiagnostics {
  readonly deviceType: number;
  readonly deviceName: string;
}

export interface DevicePort {
  readonly ensureFileAccess: () => Promise<Result<void, DeviceFailure>>;
  readonly ensureNoteDirectory: (
    absolutePath: string,
  ) => Promise<Result<void, DeviceFailure>>;
  readonly noteExists: (
    absolutePath: string,
  ) => Promise<Result<boolean, DeviceFailure>>;
  readonly createNote: (
    notePath: string,
  ) => Promise<Result<void, DeviceFailure>>;
  readonly readGeneratedComponentIds: (
    notePath: string,
    date: LocalDate,
  ) => Promise<Result<ReadonlySet<string>, DeviceFailure>>;
  readonly renderMissingPageComponents: (
    content: TodayPageContent,
    missingComponentIds: ReadonlySet<string>,
  ) => Promise<Result<void, DeviceFailure>>;
  readonly handoffGeneratedNote: (
    notePath: string,
  ) => Promise<Result<void, DeviceFailure>>;
  readonly handoffExistingNote: (
    notePath: string,
  ) => Promise<Result<void, DeviceFailure>>;
  readonly closePluginView: () => Promise<Result<void, DeviceFailure>>;
  readonly showPluginView: () => Promise<Result<void, DeviceFailure>>;
  readonly diagnostics: () => Promise<Result<DeviceDiagnostics, DeviceFailure>>;
}
