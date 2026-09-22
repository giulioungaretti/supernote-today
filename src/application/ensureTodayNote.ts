import {describeDate, type LocalDate} from '../domain/localDate';
import {lessonForDate} from '../domain/lessonSchedule';
import {decideExistingNote} from '../domain/noteDecision';
import {err, ok, type Result} from '../domain/result';
import type {Clock} from '../ports/clock';
import type {DeviceFailure, DevicePort} from '../ports/devicePort';

export const DEFAULT_JOURNAL_ROOT = '/storage/emulated/0/Note/Today';

export interface EnsureTodayFailure {
  readonly kind: 'ensure-today-failure';
  readonly step: DeviceFailure['step'] | 'initialize' | 'unexpected';
  readonly message: string;
  readonly code?: number;
}

export interface EnsureTodayOutcome {
  readonly kind: 'opened-existing' | 'generated' | 'repaired-empty';
  readonly date: LocalDate;
  readonly notePath: string;
}

export interface EnsureTodayDependencies {
  readonly clock: Clock;
  readonly device: DevicePort;
}

export const fromDeviceFailure = (
  failure: DeviceFailure,
): EnsureTodayFailure => ({
  ...failure,
  kind: 'ensure-today-failure',
});

export const ensureTodayNote = async ({
  clock,
  device,
}: EnsureTodayDependencies): Promise<
  Result<EnsureTodayOutcome, EnsureTodayFailure>
> => {
  const access = await device.ensureFileAccess();
  if (!access.ok) {
    return err(fromDeviceFailure(access.error));
  }

  const descriptor = describeDate(clock.now());
  const notePath = `${DEFAULT_JOURNAL_ROOT}/${descriptor.date}.note`;
  const exists = await device.noteExists(notePath);
  if (!exists.ok) {
    return err(fromDeviceFailure(exists.error));
  }

  let originalPageCount = 0;
  let kind: EnsureTodayOutcome['kind'] = 'generated';
  if (exists.value) {
    const inspection = await device.inspectNote(notePath);
    if (!inspection.ok) {
      return err(fromDeviceFailure(inspection.error));
    }
    const decision = decideExistingNote(inspection.value);
    if (!decision.ok) {
      return err({
        kind: 'ensure-today-failure',
        step: 'inspect-note',
        message: decision.error,
      });
    }
    kind =
      decision.value === 'open-existing' ? 'opened-existing' : 'repaired-empty';
    originalPageCount = inspection.value.pageCount;
  }

  if (kind !== 'opened-existing') {
    const template = await device.resolveTemplate();
    if (!template.ok) {
      return err(fromDeviceFailure(template.error));
    }
    if (kind === 'generated') {
      const directory = await device.ensureNoteDirectory(DEFAULT_JOURNAL_ROOT);
      if (!directory.ok) {
        return err(fromDeviceFailure(directory.error));
      }
    }
    const created =
      kind === 'generated'
        ? await device.createNote(notePath, template.value)
        : await device.insertTemplatePage(
            notePath,
            template.value,
            originalPageCount,
          );
    if (!created.ok) {
      return err(fromDeviceFailure(created.error));
    }

    const inserted = await device.insertTodayText({
      notePath,
      date: descriptor.date,
      fullDate: descriptor.fullDate,
      lesson: lessonForDate(descriptor.date),
    });
    if (!inserted.ok) {
      return err(fromDeviceFailure(inserted.error));
    }

    if (kind === 'repaired-empty') {
      const removed = await device.removeEmptySeedPages(
        notePath,
        originalPageCount,
      );
      if (!removed.ok) {
        return err(fromDeviceFailure(removed.error));
      }
    }
  }

  const closed = await device.closePluginView();
  if (!closed.ok) {
    return err(fromDeviceFailure(closed.error));
  }
  const opened = await device.openNote(notePath);
  return opened.ok
    ? ok({kind, date: descriptor.date, notePath})
    : err(fromDeviceFailure(opened.error));
};
