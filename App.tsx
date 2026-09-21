import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {StatusBar, StyleSheet, Text, View} from 'react-native';

import {
  DEFAULT_JOURNAL_ROOT,
  ensureTodayNote,
  type EnsureTodayFailure,
} from './src/application/ensureTodayNote';
import {supernoteDeviceAdapter} from './src/adapters/supernote/supernoteDeviceAdapter';
import {describeDate} from './src/domain/localDate';
import {lessonForDate} from './src/domain/lessonSchedule';
import {systemClock} from './src/ports/clock';
import {
  getEntryIntent,
  subscribeEntryIntent,
} from './src/runtime/entryState';
import {ErrorScreen} from './src/ui/ErrorScreen';
import {OpeningScreen} from './src/ui/OpeningScreen';
import {SettingsScreen} from './src/ui/SettingsScreen';

type ScreenState =
  | Readonly<{kind: 'idle'}>
  | Readonly<{kind: 'opening'}>
  | Readonly<{kind: 'error'; failure: EnsureTodayFailure}>
  | Readonly<{kind: 'settings-loading'}>
  | Readonly<{
      kind: 'settings';
      date: string;
      lessonTitle: string;
      lessonPhase: string;
      deviceName: string;
      diagnosticsMessage: string | null;
    }>;

const dependencies = {
  clock: systemClock,
  device: supernoteDeviceAdapter,
};

function App(): React.JSX.Element {
  const intent = useSyncExternalStore(
    subscribeEntryIntent,
    getEntryIntent,
    getEntryIntent,
  );
  const [screen, setScreen] = useState<ScreenState>({kind: 'idle'});
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
    const descriptor = describeDate(systemClock.now());
    const lesson = lessonForDate(descriptor.date);
    const diagnostics = await dependencies.device.diagnostics();

    setScreen({
      kind: 'settings',
      date: descriptor.date,
      lessonTitle: lesson.title,
      lessonPhase: lesson.phase,
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
            <Text style={styles.idleText}>Loading status...</Text>
          </View>
        );
      case 'error':
        return (
          <ErrorScreen
            failure={screen.failure}
            onRetry={() => launch(runOpening())}
            onSettings={() => launch(runSettings())}
            onClose={close}
          />
        );
      case 'settings':
        return (
          <SettingsScreen
            journalRoot={DEFAULT_JOURNAL_ROOT}
            date={screen.date}
            lessonTitle={screen.lessonTitle}
            lessonPhase={screen.lessonPhase}
            deviceName={screen.deviceName}
            diagnosticsMessage={screen.diagnosticsMessage}
            onClose={close}
          />
        );
    }
  })();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
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
