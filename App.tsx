import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {StatusBar, StyleSheet, Text, View} from 'react-native';

import {
  ensureTodayNote,
  type EnsureTodayFailure,
} from './src/application/ensureTodayNote';
import {
  loadSettings,
  resetFuturePractice,
  saveJournalRoot,
  startFuturePracticeAt,
  type SettingsSnapshot,
} from './src/application/settingsService';
import {lessonAt} from './src/domain/curriculum';
import {supernoteDeviceAdapter} from './src/adapters/supernote/supernoteDeviceAdapter';
import {nativeStateStore} from './src/adapters/storage/nativeStateStore';
import {systemClock} from './src/ports/clock';
import {
  getEntryIntent,
  subscribeEntryIntent,
} from './src/runtime/entryState';
import {ErrorScreen} from './src/ui/ErrorScreen';
import {OpeningScreen} from './src/ui/OpeningScreen';
import {
  SettingsScreen,
  type PendingSettingsAction,
  type PhaseChoice,
} from './src/ui/SettingsScreen';

type ScreenState =
  | Readonly<{kind: 'idle'}>
  | Readonly<{kind: 'opening'}>
  | Readonly<{kind: 'error'; failure: EnsureTodayFailure}>
  | Readonly<{kind: 'settings-loading'}>
  | Readonly<{
      kind: 'settings';
      snapshot: SettingsSnapshot;
      deviceName: string;
      diagnosticsMessage: string | null;
    }>;

type PendingAction =
  | Readonly<{kind: 'reset'; label: string}>
  | Readonly<{kind: 'phase'; lessonId: string; label: string}>;

const dependencies = {
  clock: systemClock,
  stateStore: nativeStateStore,
  device: supernoteDeviceAdapter,
};

const refreshSnapshotState = (
  snapshot: SettingsSnapshot,
  state: SettingsSnapshot['state'],
): SettingsSnapshot => {
  const lesson = lessonAt(state.nextSequence);
  return {
    ...snapshot,
    state,
    nextLessonTitle: lesson.title,
    nextLessonPhase: lesson.phase,
  };
};

function App(): React.JSX.Element {
  const intent = useSyncExternalStore(
    subscribeEntryIntent,
    getEntryIntent,
    getEntryIntent,
  );
  const [screen, setScreen] = useState<ScreenState>({kind: 'idle'});
  const [journalRootDraft, setJournalRootDraft] = useState('');
  const [settingsStatus, setSettingsStatus] = useState<string | null>(null);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const openingInFlight = useRef(false);

  const reportUnexpected = useCallback((error: unknown): void => {
    setScreen({
      kind: 'error',
      failure: {
        kind: 'ensure-today-failure',
        step: 'handoff',
        message:
          error instanceof Error
            ? error.message
            : 'An unexpected plugin error occurred',
      },
    });
  }, []);

  const launch = useCallback(
    (task: Promise<void>): void => {
      task.catch(reportUnexpected);
    },
    [reportUnexpected],
  );

  const runOpening = useCallback(async (): Promise<void> => {
    if (openingInFlight.current) {
      return;
    }

    openingInFlight.current = true;
    setScreen({kind: 'opening'});
    const result = await ensureTodayNote(dependencies);
    openingInFlight.current = false;

    if (!result.ok) {
      setScreen({kind: 'error', failure: result.error});
    }
  }, []);

  const runSettings = useCallback(async (): Promise<void> => {
    setScreen({kind: 'settings-loading'});
    setSettingsStatus(null);
    setPendingAction(null);

    const [loaded, diagnostics] = await Promise.all([
      loadSettings(dependencies),
      dependencies.device.diagnostics(),
    ]);

    if (!loaded.ok) {
      setScreen({
        kind: 'error',
        failure: {
          kind: 'ensure-today-failure',
          step: 'load-state',
          message: loaded.error.message,
        },
      });
      return;
    }

    setJournalRootDraft(loaded.value.state.settings.journalRoot);
    setScreen({
      kind: 'settings',
      snapshot: loaded.value,
      deviceName: diagnostics.ok ? diagnostics.value.deviceName : 'Unavailable',
      diagnosticsMessage: diagnostics.ok ? null : diagnostics.error.message,
    });
  }, []);

  useEffect(() => {
    if (intent.route === 'opening') {
      launch(runOpening());
    } else if (intent.route === 'settings') {
      launch(runSettings());
    }
  }, [intent.route, intent.sequence, launch, runOpening, runSettings]);

  const phaseChoices = useMemo<readonly PhaseChoice[]>(() => {
    if (screen.kind !== 'settings') {
      return [];
    }

    const seen = new Set<string>();
    return screen.snapshot.lessonChoices.flatMap(choice => {
      if (seen.has(choice.phase)) {
        return [];
      }
      seen.add(choice.phase);
      return [
        {
          id: choice.id,
          label: choice.phase
            .split('-')
            .map(word => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
            .join(' '),
        },
      ];
    });
  }, [screen]);

  const updateSettingsState = useCallback(
    (state: SettingsSnapshot['state'], message: string): void => {
      setScreen(current =>
        current.kind === 'settings'
          ? {
              ...current,
              snapshot: refreshSnapshotState(current.snapshot, state),
            }
          : current,
      );
      setSettingsStatus(message);
    },
    [],
  );

  const saveRoot = useCallback(async (): Promise<void> => {
    if (screen.kind !== 'settings' || settingsBusy) {
      return;
    }

    setSettingsBusy(true);
    const result = await saveJournalRoot(
      dependencies,
      screen.snapshot.state,
      journalRootDraft,
    );
    setSettingsBusy(false);

    if (result.ok) {
      setJournalRootDraft(result.value.settings.journalRoot);
      updateSettingsState(result.value, 'Journal root saved.');
    } else {
      setSettingsStatus(result.error.message);
    }
  }, [
    journalRootDraft,
    screen,
    settingsBusy,
    updateSettingsState,
  ]);

  const confirmPendingAction = useCallback(async (): Promise<void> => {
    if (
      screen.kind !== 'settings' ||
      pendingAction === null ||
      settingsBusy
    ) {
      return;
    }

    setSettingsBusy(true);
    const result =
      pendingAction.kind === 'reset'
        ? await resetFuturePractice(dependencies, screen.snapshot.state)
        : await startFuturePracticeAt(
            dependencies,
            screen.snapshot.state,
            pendingAction.lessonId,
          );
    setSettingsBusy(false);
    setPendingAction(null);

    if (result.ok) {
      updateSettingsState(
        result.value,
        pendingAction.kind === 'reset'
          ? 'Future practice reset to lesson 1.'
          : 'Future practice starting point updated.',
      );
    } else {
      setSettingsStatus(result.error.message);
    }
  }, [
    pendingAction,
    screen,
    settingsBusy,
    updateSettingsState,
  ]);

  const close = useCallback((): void => {
    dependencies.device
      .closePluginView()
      .then(result => {
        if (!result.ok) {
          setScreen({
            kind: 'error',
            failure: {
              kind: 'ensure-today-failure',
              step: 'handoff',
              message: result.error.message,
              ...(result.error.code === undefined
                ? {}
                : {code: result.error.code}),
            },
          });
        }
      })
      .catch(reportUnexpected);
  }, [reportUnexpected]);

  const content = (() => {
    switch (screen.kind) {
      case 'idle':
        return (
          <View style={styles.idle}>
            <Text style={styles.idleText}>Today is ready.</Text>
          </View>
        );
      case 'opening':
        return <OpeningScreen />;
      case 'settings-loading':
        return (
          <View style={styles.idle}>
            <Text style={styles.idleText}>Loading settings...</Text>
          </View>
        );
      case 'error':
        return (
          <ErrorScreen
            failure={screen.failure}
            onRetry={() => {
              launch(runOpening());
            }}
            onSettings={() => {
              launch(runSettings());
            }}
            onClose={close}
          />
        );
      case 'settings': {
        const visiblePendingAction: PendingSettingsAction | null =
          pendingAction === null ? null : {label: pendingAction.label};
        return (
          <SettingsScreen
            snapshot={screen.snapshot}
            deviceName={screen.deviceName}
            diagnosticsMessage={screen.diagnosticsMessage}
            journalRootDraft={journalRootDraft}
            statusMessage={settingsStatus}
            busy={settingsBusy}
            phaseChoices={phaseChoices}
            pendingAction={visiblePendingAction}
            onJournalRootChange={setJournalRootDraft}
            onSaveJournalRoot={() => {
              launch(saveRoot());
            }}
            onRequestReset={() =>
              setPendingAction({
                kind: 'reset',
                label:
                  'Reset future practice to lesson 1? Existing dated assignments stay unchanged.',
              })
            }
            onRequestPhase={choice =>
              setPendingAction({
                kind: 'phase',
                lessonId: choice.id,
                label: `Start future practice at ${choice.label}? Existing dated assignments stay unchanged.`,
              })
            }
            onConfirmAction={() => {
              launch(confirmPendingAction());
            }}
            onCancelAction={() => setPendingAction(null)}
            onClose={close}
          />
        );
      }
    }
  })();

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#ffffff"
      />
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  idle: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  idleText: {
    color: '#111111',
    fontSize: 24,
    fontWeight: '600',
  },
});

export default App;
