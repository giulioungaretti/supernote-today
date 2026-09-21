import {lessonAt, type CursiveLesson} from '../domain/curriculum';
import {describeDate, type LocalDate} from '../domain/localDate';
import {PAGE_COMPONENT_IDS} from '../domain/pageLayout';
import {
  completeAssignment,
  notePathForDate,
  parseStateJson,
  reopenAssignment,
  reserveAssignment,
  serializeState,
  type DailyAssignment,
  type TodayState,
} from '../domain/progress';
import {err, ok, type Result} from '../domain/result';
import type {Clock} from '../ports/clock';
import type {DeviceFailure, DevicePort} from '../ports/devicePort';
import type {StateStore, StorageFailure} from '../ports/stateStore';

export type EnsureTodayStep =
  | 'permissions'
  | 'load-state'
  | 'decode-state'
  | 'resolve-path'
  | 'check-note'
  | 'reserve-assignment'
  | 'persist-pending'
  | 'ensure-directory'
  | 'create-note'
  | 'inspect-page'
  | 'render-page'
  | 'verify-page'
  | 'persist-complete'
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
      assignment: DailyAssignment | null;
    }>
  | Readonly<{
      kind: 'generated';
      date: LocalDate;
      notePath: string;
      lesson: CursiveLesson;
    }>;

export interface EnsureTodayDependencies {
  readonly clock: Clock;
  readonly stateStore: StateStore;
  readonly device: DevicePort;
}

const fromStorage = (
  step: EnsureTodayStep,
  failure: StorageFailure,
): EnsureTodayFailure => ({
  kind: 'ensure-today-failure',
  step,
  message: failure.message,
});

const fromDevice = (
  step: EnsureTodayStep,
  failure: DeviceFailure,
): EnsureTodayFailure =>
  failure.code === undefined
    ? {
        kind: 'ensure-today-failure',
        step,
        message: failure.message,
      }
    : {
        kind: 'ensure-today-failure',
        step,
        message: failure.message,
        code: failure.code,
      };

const directoryOf = (notePath: string): string => {
  const separator = notePath.lastIndexOf('/');
  return separator > 0 ? notePath.slice(0, separator) : '';
};

const persistState = async (
  stateStore: StateStore,
  state: TodayState,
  step: 'persist-pending' | 'persist-complete',
): Promise<Result<void, EnsureTodayFailure>> => {
  const written = await stateStore.writeState(serializeState(state));
  return written.ok ? written : err(fromStorage(step, written.error));
};

const missingIds = (
  expected: readonly string[],
  actual: ReadonlySet<string>,
): ReadonlySet<string> =>
  new Set(expected.filter(componentId => !actual.has(componentId)));

const hasAllIds = (
  expected: readonly string[],
  actual: ReadonlySet<string>,
): boolean => expected.every(componentId => actual.has(componentId));

const handoffExisting = async (
  dependencies: EnsureTodayDependencies,
  date: LocalDate,
  notePath: string,
  assignment: DailyAssignment | null,
): Promise<Result<EnsureTodayOutcome, EnsureTodayFailure>> => {
  const handedOff = await dependencies.device.handoffExistingNote(notePath);
  return handedOff.ok
    ? ok({kind: 'opened-existing', date, notePath, assignment})
    : err(fromDevice('handoff', handedOff.error));
};

const completeAndHandoff = async (input: {
  readonly dependencies: EnsureTodayDependencies;
  readonly state: TodayState;
  readonly date: LocalDate;
  readonly notePath: string;
  readonly lesson: CursiveLesson;
  readonly renderedThisRun: boolean;
}): Promise<Result<EnsureTodayOutcome, EnsureTodayFailure>> => {
  const completed = completeAssignment(
    input.state,
    input.date,
    input.dependencies.clock.now().toISOString(),
  );
  const persisted = await persistState(
    input.dependencies.stateStore,
    completed,
    'persist-complete',
  );
  if (!persisted.ok) {
    return persisted;
  }

  const handedOff = input.renderedThisRun
    ? await input.dependencies.device.handoffGeneratedNote(input.notePath)
    : await input.dependencies.device.handoffExistingNote(input.notePath);
  return handedOff.ok
    ? ok({
        kind: 'generated',
        date: input.date,
        notePath: input.notePath,
        lesson: input.lesson,
      })
    : err(fromDevice('handoff', handedOff.error));
};

const generatePendingAssignment = async (input: {
  readonly dependencies: EnsureTodayDependencies;
  readonly state: TodayState;
  readonly assignment: DailyAssignment;
  readonly fileExists: boolean;
  readonly fullDate: string;
}): Promise<Result<EnsureTodayOutcome, EnsureTodayFailure>> => {
  const {dependencies, assignment} = input;
  let fileExists = input.fileExists;

  if (!fileExists) {
    const directory = directoryOf(assignment.notePath);
    if (directory.length === 0) {
      return err({
        kind: 'ensure-today-failure',
        step: 'resolve-path',
        message: 'The dated note path has no parent directory',
      });
    }

    const directoryReady = await dependencies.stateStore.ensureDirectory(
      directory,
    );
    if (!directoryReady.ok) {
      return err(fromStorage('ensure-directory', directoryReady.error));
    }

    const created = await dependencies.device.createNote(assignment.notePath);
    if (!created.ok) {
      return err(fromDevice('create-note', created.error));
    }
    fileExists = true;
  }

  if (!fileExists) {
    return err({
      kind: 'ensure-today-failure',
      step: 'create-note',
      message: 'The dated note does not exist after creation',
    });
  }

  const existingIds = await dependencies.device.readGeneratedComponentIds(
    assignment.notePath,
    assignment.date,
  );
  if (!existingIds.ok) {
    return err(fromDevice('inspect-page', existingIds.error));
  }

  const expected =
    assignment.expectedElementIds.length > 0
      ? assignment.expectedElementIds
      : PAGE_COMPONENT_IDS;
  const missing = missingIds(expected, existingIds.value);
  let renderedThisRun = false;

  if (missing.size > 0) {
    const lesson = lessonAt(assignment.sequence);
    const rendered = await dependencies.device.renderMissingPageComponents(
      {
        notePath: assignment.notePath,
        date: assignment.date,
        fullDate: input.fullDate,
        lesson,
      },
      missing,
    );
    if (!rendered.ok) {
      return err(fromDevice('render-page', rendered.error));
    }
    renderedThisRun = true;
  }

  const verifiedIds = await dependencies.device.readGeneratedComponentIds(
    assignment.notePath,
    assignment.date,
  );
  if (!verifiedIds.ok) {
    return err(fromDevice('verify-page', verifiedIds.error));
  }
  if (!hasAllIds(expected, verifiedIds.value)) {
    return err({
      kind: 'ensure-today-failure',
      step: 'verify-page',
      message: 'The generated page is missing one or more required elements',
    });
  }

  return completeAndHandoff({
    dependencies,
    state: input.state,
    date: assignment.date,
    notePath: assignment.notePath,
    lesson: lessonAt(assignment.sequence),
    renderedThisRun,
  });
};

export const ensureTodayNote = async (
  dependencies: EnsureTodayDependencies,
): Promise<Result<EnsureTodayOutcome, EnsureTodayFailure>> => {
  const access = await dependencies.device.ensureFileAccess();
  if (!access.ok) {
    return err(fromDevice('permissions', access.error));
  }

  const stored = await dependencies.stateStore.readState();
  if (!stored.ok) {
    return err(fromStorage('load-state', stored.error));
  }

  const decoded = parseStateJson(stored.value);
  if (!decoded.ok) {
    return err({
      kind: 'ensure-today-failure',
      step: 'decode-state',
      message: decoded.error.message,
    });
  }

  const descriptor = describeDate(dependencies.clock.now());
  let state = decoded.value;
  let assignment = state.assignments[descriptor.date];
  const resolvedPath =
    assignment === undefined
      ? notePathForDate(state.settings.journalRoot, descriptor.date)
      : ok(assignment.notePath);
  if (!resolvedPath.ok) {
    return err({
      kind: 'ensure-today-failure',
      step: 'resolve-path',
      message: `Invalid journal root: ${resolvedPath.error.value}`,
    });
  }

  const notePath = resolvedPath.value;
  const exists = await dependencies.stateStore.exists(notePath);
  if (!exists.ok) {
    return err(fromStorage('check-note', exists.error));
  }

  if (assignment === undefined && exists.value) {
    return handoffExisting(
      dependencies,
      descriptor.date,
      notePath,
      null,
    );
  }

  if (assignment?.status === 'complete' && exists.value) {
    return handoffExisting(
      dependencies,
      descriptor.date,
      assignment.notePath,
      assignment,
    );
  }

  if (assignment?.status === 'complete' && !exists.value) {
    state = reopenAssignment(state, descriptor.date);
    assignment = state.assignments[descriptor.date];
    const persisted = await persistState(
      dependencies.stateStore,
      state,
      'persist-pending',
    );
    if (!persisted.ok) {
      return persisted;
    }
  }

  if (assignment === undefined) {
    const reservation = reserveAssignment({
      state,
      date: descriptor.date,
      notePath,
      expectedElementIds: PAGE_COMPONENT_IDS,
      assignedAt: dependencies.clock.now().toISOString(),
    });
    state = reservation.state;
    assignment = reservation.assignment;

    const persisted = await persistState(
      dependencies.stateStore,
      state,
      'persist-pending',
    );
    if (!persisted.ok) {
      return persisted;
    }
  }

  return generatePendingAssignment({
    dependencies,
    state,
    assignment,
    fileExists: exists.value,
    fullDate: descriptor.fullDate,
  });
};
