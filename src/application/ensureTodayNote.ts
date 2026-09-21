import {describeDate, type LocalDate} from '../domain/localDate';
import {lessonForDate} from '../domain/lessonSchedule';
import {PAGE_COMPONENT_IDS} from '../domain/pageLayout';
import {err, ok, type Result} from '../domain/result';
import type {Clock} from '../ports/clock';
import type {DeviceFailure, DevicePort} from '../ports/devicePort';

export const DEFAULT_JOURNAL_ROOT = '/storage/emulated/0/Note/Today';

export type EnsureTodayStep =
  | 'permissions'
  | 'check-note'
  | 'ensure-directory'
  | 'create-note'
  | 'inspect-page'
  | 'render-page'
  | 'verify-page'
  | 'handoff';

export interface EnsureTodayFailure {
  readonly kind: 'ensure-today-failure';
  readonly step: EnsureTodayStep;
  readonly message: string;
  readonly code?: number;
}

export type EnsureTodayOutcome =
  | Readonly<{
      kind: 'opened-existing';
      date: LocalDate;
      notePath: string;
    }>
  | Readonly<{
      kind: 'generated';
      date: LocalDate;
      notePath: string;
      exerciseId: string;
    }>;

export interface EnsureTodayDependencies {
  readonly clock: Clock;
  readonly device: DevicePort;
}

const fromDevice = (
  step: EnsureTodayStep,
  failure: DeviceFailure,
): EnsureTodayFailure =>
  failure.code === undefined
    ? {kind: 'ensure-today-failure', step, message: failure.message}
    : {
        kind: 'ensure-today-failure',
        step,
        message: failure.message,
        code: failure.code,
      };

const notePathForDate = (date: LocalDate): string =>
  `${DEFAULT_JOURNAL_ROOT}/${date}.note`;

const missingIds = (actual: ReadonlySet<string>): ReadonlySet<string> =>
  new Set(PAGE_COMPONENT_IDS.filter(componentId => !actual.has(componentId)));

const hasAllIds = (actual: ReadonlySet<string>): boolean =>
  PAGE_COMPONENT_IDS.every(componentId => actual.has(componentId));

export const ensureTodayNote = async (
  dependencies: EnsureTodayDependencies,
): Promise<Result<EnsureTodayOutcome, EnsureTodayFailure>> => {
  const access = await dependencies.device.ensureFileAccess();
  if (!access.ok) {
    return err(fromDevice('permissions', access.error));
  }

  const descriptor = describeDate(dependencies.clock.now());
  const lesson = lessonForDate(descriptor.date);
  const notePath = notePathForDate(descriptor.date);
  const exists = await dependencies.device.noteExists(notePath);
  if (!exists.ok) {
    return err(fromDevice('check-note', exists.error));
  }

  if (exists.value) {
    const markers = await dependencies.device.readGeneratedComponentIds(
      notePath,
      descriptor.date,
    );
    if (!markers.ok) {
      return err(fromDevice('inspect-page', markers.error));
    }

    const hasPluginContent = PAGE_COMPONENT_IDS.some(componentId =>
      markers.value.has(componentId),
    );
    if (!hasPluginContent || hasAllIds(markers.value)) {
      const handedOff = await dependencies.device.handoffExistingNote(notePath);
      return handedOff.ok
        ? ok({kind: 'opened-existing', date: descriptor.date, notePath})
        : err(fromDevice('handoff', handedOff.error));
    }

    const repaired = await dependencies.device.renderMissingPageComponents(
      {
        notePath,
        date: descriptor.date,
        fullDate: descriptor.fullDate,
        lesson,
      },
      missingIds(markers.value),
    );
    if (!repaired.ok) {
      return err(fromDevice('render-page', repaired.error));
    }

    const handedOff = await dependencies.device.handoffGeneratedNote(notePath);
    return handedOff.ok
      ? ok({
          kind: 'generated',
          date: descriptor.date,
          notePath,
          exerciseId: lesson.id,
        })
      : err(fromDevice('handoff', handedOff.error));
  }

  const directory = await dependencies.device.ensureNoteDirectory(
    DEFAULT_JOURNAL_ROOT,
  );
  if (!directory.ok) {
    return err(fromDevice('ensure-directory', directory.error));
  }

  const created = await dependencies.device.createNote(notePath);
  if (!created.ok) {
    return err(fromDevice('create-note', created.error));
  }

  const rendered = await dependencies.device.renderMissingPageComponents(
    {
      notePath,
      date: descriptor.date,
      fullDate: descriptor.fullDate,
      lesson,
    },
    new Set(PAGE_COMPONENT_IDS),
  );
  if (!rendered.ok) {
    return err(fromDevice('render-page', rendered.error));
  }

  const verified = await dependencies.device.readGeneratedComponentIds(
    notePath,
    descriptor.date,
  );
  if (!verified.ok) {
    return err(fromDevice('verify-page', verified.error));
  }
  if (!hasAllIds(verified.value)) {
    return err({
      kind: 'ensure-today-failure',
      step: 'verify-page',
      message: 'The generated page is missing one or more required elements',
    });
  }

  const handedOff = await dependencies.device.handoffGeneratedNote(notePath);
  return handedOff.ok
    ? ok({
        kind: 'generated',
        date: descriptor.date,
        notePath,
        exerciseId: lesson.id,
      })
    : err(fromDevice('handoff', handedOff.error));
};
