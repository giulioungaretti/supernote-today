import type {CursiveLesson} from '../domain/curriculum';
import type {LocalDate} from '../domain/localDate';
import type {NoteInspection} from '../domain/noteDecision';
import type {Result} from '../domain/result';

export type DeviceStep =
  | 'permission-read'
  | 'permission-write'
  | 'check-note'
  | 'ensure-directory'
  | 'template'
  | 'create-note'
  | 'inspect-note'
  | 'insert-page'
  | 'page-size'
  | 'create-element'
  | 'insert-text'
  | 'verify-text'
  | 'remove-empty-pages'
  | 'close-view'
  | 'open-note'
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
    path: string,
  ) => Promise<Result<void, DeviceFailure>>;
  readonly noteExists: (
    path: string,
  ) => Promise<Result<boolean, DeviceFailure>>;
  readonly resolveTemplate: () => Promise<Result<string, DeviceFailure>>;
  readonly createNote: (
    path: string,
    template: string,
  ) => Promise<Result<void, DeviceFailure>>;
  readonly inspectNote: (
    path: string,
  ) => Promise<Result<NoteInspection, DeviceFailure>>;
  readonly insertTemplatePage: (
    path: string,
    template: string,
    originalPageCount: number,
  ) => Promise<Result<void, DeviceFailure>>;
  readonly insertTodayText: (
    content: TodayPageContent,
  ) => Promise<Result<void, DeviceFailure>>;
  readonly removeEmptySeedPages: (
    path: string,
    originalPageCount: number,
  ) => Promise<Result<void, DeviceFailure>>;
  readonly closePluginView: () => Promise<Result<void, DeviceFailure>>;
  readonly openNote: (path: string) => Promise<Result<void, DeviceFailure>>;
  readonly showPluginView: () => Promise<Result<void, DeviceFailure>>;
  readonly diagnostics: () => Promise<Result<DeviceDiagnostics, DeviceFailure>>;
}
