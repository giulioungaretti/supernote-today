import {CURRICULUM_LENGTH, lessonAt, lessonIndex} from './curriculum';
import {parseLocalDate, type LocalDate} from './localDate';
import {err, ok, type Result} from './result';

export const STATE_SCHEMA_VERSION = 1;
export const DEFAULT_JOURNAL_ROOT = '/storage/emulated/0/Note/Today';

export interface TodaySettings {
  readonly journalRoot: string;
}

interface AssignmentBase {
  readonly date: LocalDate;
  readonly notePath: string;
  readonly sequence: number;
  readonly exerciseId: string;
  readonly expectedElementIds: readonly string[];
  readonly assignedAt: string;
}

export interface PendingAssignment extends AssignmentBase {
  readonly status: 'pending';
}

export interface CompletedAssignment extends AssignmentBase {
  readonly status: 'complete';
  readonly completedAt: string;
}

export type DailyAssignment = PendingAssignment | CompletedAssignment;

export interface TodayState {
  readonly schemaVersion: typeof STATE_SCHEMA_VERSION;
  readonly settings: TodaySettings;
  readonly nextSequence: number;
  readonly assignments: Readonly<Record<string, DailyAssignment>>;
}

export type StateDecodeError = Readonly<{
  kind: 'invalid-state';
  message: string;
}>;

export type JournalRootError = Readonly<{
  kind: 'invalid-journal-root';
  value: string;
}>;

export interface Reservation {
  readonly state: TodayState;
  readonly assignment: DailyAssignment;
  readonly created: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isSafeInteger(value) &&
  value >= 0;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(isNonEmptyString);

const invalidState = (message: string): Result<never, StateDecodeError> =>
  err({kind: 'invalid-state', message});

export const normalizeJournalRoot = (
  value: string,
): Result<string, JournalRootError> => {
  const normalized = value.trim().replace(/\\/g, '/').replace(/\/+/g, '/');
  const withoutTrailingSlash =
    normalized.length > 1 ? normalized.replace(/\/+$/g, '') : normalized;
  const noteRoot = '/storage/emulated/0/Note';
  const isInsideNoteRoot =
    withoutTrailingSlash === noteRoot ||
    withoutTrailingSlash.startsWith(`${noteRoot}/`);

  if (
    !isInsideNoteRoot ||
    withoutTrailingSlash.includes('/../') ||
    withoutTrailingSlash.endsWith('/..') ||
    withoutTrailingSlash.toLowerCase().endsWith('.note')
  ) {
    return err({kind: 'invalid-journal-root', value});
  }

  return ok(withoutTrailingSlash);
};

export const notePathForDate = (
  journalRoot: string,
  date: LocalDate,
): Result<string, JournalRootError> => {
  const normalized = normalizeJournalRoot(journalRoot);
  return normalized.ok
    ? ok(`${normalized.value}/${date}.note`)
    : normalized;
};

export const defaultState = (): TodayState => ({
  schemaVersion: STATE_SCHEMA_VERSION,
  settings: {journalRoot: DEFAULT_JOURNAL_ROOT},
  nextSequence: 0,
  assignments: {},
});

const decodeAssignment = (
  key: string,
  value: unknown,
): Result<DailyAssignment, StateDecodeError> => {
  if (!isRecord(value)) {
    return invalidState(`Assignment ${key} is not an object`);
  }

  const parsedDate = parseLocalDate(String(value.date ?? ''));
  if (!parsedDate.ok || parsedDate.value !== key) {
    return invalidState(`Assignment ${key} has an invalid date`);
  }

  if (
    !isNonEmptyString(value.notePath) ||
    !value.notePath.startsWith('/storage/emulated/0/Note/') ||
    !value.notePath.endsWith('.note') ||
    value.notePath.includes('..')
  ) {
    return invalidState(`Assignment ${key} has an invalid note path`);
  }

  if (
    !isNonNegativeInteger(value.sequence) ||
    !isNonEmptyString(value.exerciseId) ||
    lessonAt(value.sequence).id !== value.exerciseId
  ) {
    return invalidState(`Assignment ${key} has an invalid exercise`);
  }

  if (
    !isStringArray(value.expectedElementIds) ||
    new Set(value.expectedElementIds).size !== value.expectedElementIds.length ||
    !isNonEmptyString(value.assignedAt)
  ) {
    return invalidState(`Assignment ${key} has invalid generation metadata`);
  }

  const base: AssignmentBase = {
    date: parsedDate.value,
    notePath: value.notePath,
    sequence: value.sequence,
    exerciseId: value.exerciseId,
    expectedElementIds: [...value.expectedElementIds],
    assignedAt: value.assignedAt,
  };

  if (value.status === 'pending') {
    return ok({...base, status: 'pending'});
  }

  if (value.status === 'complete' && isNonEmptyString(value.completedAt)) {
    return ok({...base, status: 'complete', completedAt: value.completedAt});
  }

  return invalidState(`Assignment ${key} has an invalid status`);
};

export const decodeState = (
  value: unknown,
): Result<TodayState, StateDecodeError> => {
  if (!isRecord(value)) {
    return invalidState('State is not an object');
  }

  if (value.schemaVersion !== STATE_SCHEMA_VERSION) {
    return invalidState('State schema version is not supported');
  }

  if (!isRecord(value.settings) || !isNonEmptyString(value.settings.journalRoot)) {
    return invalidState('Settings are invalid');
  }

  const journalRoot = normalizeJournalRoot(value.settings.journalRoot);
  if (!journalRoot.ok) {
    return invalidState('Journal root is invalid');
  }

  if (!isNonNegativeInteger(value.nextSequence)) {
    return invalidState('Next sequence is invalid');
  }

  if (!isRecord(value.assignments)) {
    return invalidState('Assignments are invalid');
  }

  const assignments: Record<string, DailyAssignment> = {};
  for (const [key, assignmentValue] of Object.entries(value.assignments)) {
    const decoded = decodeAssignment(key, assignmentValue);
    if (!decoded.ok) {
      return decoded;
    }
    assignments[key] = decoded.value;
  }

  return ok({
    schemaVersion: STATE_SCHEMA_VERSION,
    settings: {journalRoot: journalRoot.value},
    nextSequence: value.nextSequence,
    assignments,
  });
};

export const parseStateJson = (
  json: string | null,
): Result<TodayState, StateDecodeError> => {
  if (json === null || json.trim().length === 0) {
    return ok(defaultState());
  }

  try {
    return decodeState(JSON.parse(json) as unknown);
  } catch (error: unknown) {
    return invalidState(
      error instanceof Error ? error.message : 'State JSON is malformed',
    );
  }
};

export const serializeState = (state: TodayState): string =>
  `${JSON.stringify(state, null, 2)}\n`;

export const reserveAssignment = (input: {
  readonly state: TodayState;
  readonly date: LocalDate;
  readonly notePath: string;
  readonly expectedElementIds: readonly string[];
  readonly assignedAt: string;
}): Reservation => {
  const existing = input.state.assignments[input.date];
  if (existing !== undefined) {
    return {state: input.state, assignment: existing, created: false};
  }

  const selectedLesson = lessonAt(input.state.nextSequence);
  const assignment: PendingAssignment = {
    date: input.date,
    notePath: input.notePath,
    sequence: input.state.nextSequence,
    exerciseId: selectedLesson.id,
    expectedElementIds: [...input.expectedElementIds],
    assignedAt: input.assignedAt,
    status: 'pending',
  };

  return {
    created: true,
    assignment,
    state: {
      ...input.state,
      assignments: {
        ...input.state.assignments,
        [input.date]: assignment,
      },
    },
  };
};

export const reopenAssignment = (
  state: TodayState,
  date: LocalDate,
): TodayState => {
  const assignment = state.assignments[date];
  if (assignment === undefined || assignment.status === 'pending') {
    return state;
  }

  const pending: PendingAssignment = {
    date: assignment.date,
    notePath: assignment.notePath,
    sequence: assignment.sequence,
    exerciseId: assignment.exerciseId,
    expectedElementIds: assignment.expectedElementIds,
    assignedAt: assignment.assignedAt,
    status: 'pending',
  };

  return {
    ...state,
    assignments: {...state.assignments, [date]: pending},
  };
};

export const completeAssignment = (
  state: TodayState,
  date: LocalDate,
  completedAt: string,
): TodayState => {
  const assignment = state.assignments[date];
  if (assignment === undefined || assignment.status === 'complete') {
    return state;
  }

  const completed: CompletedAssignment = {
    ...assignment,
    status: 'complete',
    completedAt,
  };

  return {
    ...state,
    nextSequence: Math.max(state.nextSequence, assignment.sequence + 1),
    assignments: {...state.assignments, [date]: completed},
  };
};

export const updateJournalRoot = (
  state: TodayState,
  value: string,
): Result<TodayState, JournalRootError> => {
  const normalized = normalizeJournalRoot(value);
  return normalized.ok
    ? ok({
        ...state,
        settings: {...state.settings, journalRoot: normalized.value},
      })
    : normalized;
};

export const resetPractice = (state: TodayState): TodayState => ({
  ...state,
  nextSequence: 0,
});

export const startPracticeAt = (
  state: TodayState,
  lessonId: string,
): Result<TodayState, Readonly<{kind: 'unknown-lesson'; lessonId: string}>> => {
  const index = lessonIndex(lessonId);
  return index >= 0 && index < CURRICULUM_LENGTH
    ? ok({...state, nextSequence: index})
    : err({kind: 'unknown-lesson', lessonId});
};
