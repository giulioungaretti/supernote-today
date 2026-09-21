import {CURRICULUM, lessonAt} from '../domain/curriculum';
import {
  parseStateJson,
  resetPractice,
  serializeState,
  startPracticeAt,
  updateJournalRoot,
  type TodayState,
} from '../domain/progress';
import {err, ok, type Result} from '../domain/result';
import type {DevicePort} from '../ports/devicePort';
import type {StateStore} from '../ports/stateStore';

export interface SettingsFailure {
  readonly kind: 'settings-failure';
  readonly message: string;
}

export interface SettingsSnapshot {
  readonly state: TodayState;
  readonly nextLessonTitle: string;
  readonly nextLessonPhase: string;
  readonly lessonChoices: readonly Readonly<{
    id: string;
    title: string;
    phase: string;
  }>[];
}

export interface SettingsDependencies {
  readonly device: DevicePort;
  readonly stateStore: StateStore;
}

const failure = (message: string): SettingsFailure => ({
  kind: 'settings-failure',
  message,
});

const persist = async (
  stateStore: StateStore,
  state: TodayState,
): Promise<Result<TodayState, SettingsFailure>> => {
  const written = await stateStore.writeState(serializeState(state));
  return written.ok ? ok(state) : err(failure(written.error.message));
};

export const loadSettings = async (
  dependencies: SettingsDependencies,
): Promise<Result<SettingsSnapshot, SettingsFailure>> => {
  const access = await dependencies.device.ensureFileAccess();
  if (!access.ok) {
    return err(failure(access.error.message));
  }

  const stored = await dependencies.stateStore.readState();
  if (!stored.ok) {
    return err(failure(stored.error.message));
  }

  const decoded = parseStateJson(stored.value);
  if (!decoded.ok) {
    return err(failure(decoded.error.message));
  }

  const next = lessonAt(decoded.value.nextSequence);
  return ok({
    state: decoded.value,
    nextLessonTitle: next.title,
    nextLessonPhase: next.phase,
    lessonChoices: CURRICULUM.map(lesson => ({
      id: lesson.id,
      title: lesson.title,
      phase: lesson.phase,
    })),
  });
};

export const saveJournalRoot = async (
  dependencies: SettingsDependencies,
  state: TodayState,
  journalRoot: string,
): Promise<Result<TodayState, SettingsFailure>> => {
  const updated = updateJournalRoot(state, journalRoot);
  return updated.ok
    ? persist(dependencies.stateStore, updated.value)
    : err(failure('Journal root must stay inside /storage/emulated/0/Note'));
};

export const resetFuturePractice = (
  dependencies: SettingsDependencies,
  state: TodayState,
): Promise<Result<TodayState, SettingsFailure>> =>
  persist(dependencies.stateStore, resetPractice(state));

export const startFuturePracticeAt = async (
  dependencies: SettingsDependencies,
  state: TodayState,
  lessonId: string,
): Promise<Result<TodayState, SettingsFailure>> => {
  const updated = startPracticeAt(state, lessonId);
  return updated.ok
    ? persist(dependencies.stateStore, updated.value)
    : err(failure(`Unknown lesson: ${lessonId}`));
};
