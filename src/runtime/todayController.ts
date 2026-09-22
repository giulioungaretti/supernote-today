import {
  ensureTodayNote,
  fromDeviceFailure,
  type EnsureTodayDependencies,
  type EnsureTodayFailure,
} from '../application/ensureTodayNote';
import {describeDate} from '../domain/localDate';
import {lessonForDate} from '../domain/lessonSchedule';

export type TodayViewState =
  | Readonly<{kind: 'idle' | 'opening' | 'settings-loading'}>
  | Readonly<{kind: 'error'; failure: EnsureTodayFailure}>
  | Readonly<{
      kind: 'settings';
      date: string;
      lessonTitle: string;
      lessonPhase: string;
      deviceName: string;
      diagnosticsMessage: string | null;
    }>;

export const createTodayController = (
  dependencies: EnsureTodayDependencies,
) => {
  let snapshot: TodayViewState = {kind: 'idle'};
  let inFlight: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const publish = (state: TodayViewState): void => {
    snapshot = state;
    listeners.forEach(listener => listener());
  };
  const showFailure = async (failure: EnsureTodayFailure): Promise<void> => {
    publish({kind: 'error', failure});
    console.error(`Today: ${failure.step}: ${failure.message}`);
    try {
      const shown = await dependencies.device.showPluginView();
      if (!shown.ok) {
        const message = `${failure.message} Error screen unavailable: ${shown.error.message}`;
        publish({kind: 'error', failure: {...failure, message}});
        console.error(message);
      }
    } catch (error: unknown) {
      const message = `${failure.message} Error screen unavailable: ${String(
        error,
      )}`;
      publish({kind: 'error', failure: {...failure, message}});
      console.error(message);
    }
  };
  const exclusive = (task: () => Promise<void>): Promise<void> => {
    if (inFlight !== null) {
      return inFlight;
    }
    inFlight = task()
      .catch((error: unknown) =>
        showFailure({
          kind: 'ensure-today-failure',
          step: 'unexpected',
          message: error instanceof Error ? error.message : String(error),
        }),
      )
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  };

  return {
    getSnapshot: (): TodayViewState => snapshot,
    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    openToday: (): Promise<void> =>
      exclusive(async () => {
        publish({kind: 'opening'});
        const result = await ensureTodayNote(dependencies);
        if (!result.ok) {
          await showFailure(result.error);
        } else {
          publish({kind: 'idle'});
        }
      }),
    showSettings: (): Promise<void> =>
      exclusive(async () => {
        publish({kind: 'settings-loading'});
        const descriptor = describeDate(dependencies.clock.now());
        const lesson = lessonForDate(descriptor.date);
        const diagnostic = await dependencies.device.diagnostics();
        publish({
          kind: 'settings',
          date: descriptor.date,
          lessonTitle: lesson.title,
          lessonPhase: lesson.phase,
          deviceName: diagnostic.ok
            ? diagnostic.value.deviceName
            : 'Unavailable',
          diagnosticsMessage: diagnostic.ok ? null : diagnostic.error.message,
        });
        const shown = await dependencies.device.showPluginView();
        if (!shown.ok) {
          publish({kind: 'error', failure: fromDeviceFailure(shown.error)});
          console.error(shown.error.message);
        }
      }),
    close: (): Promise<void> =>
      exclusive(async () => {
        const closed = await dependencies.device.closePluginView();
        if (!closed.ok) {
          await showFailure(fromDeviceFailure(closed.error));
        } else {
          publish({kind: 'idle'});
        }
      }),
    failInitialization: (error: unknown): Promise<void> =>
      showFailure({
        kind: 'ensure-today-failure',
        step: 'initialize',
        message: error instanceof Error ? error.message : String(error),
      }),
  };
};
