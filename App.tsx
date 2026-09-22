import React, {useSyncExternalStore} from 'react';
import {StatusBar, StyleSheet, Text, View} from 'react-native';

import {DEFAULT_JOURNAL_ROOT} from './src/application/ensureTodayNote';
import {todayController} from './src/runtime/pluginRuntime';
import {ErrorScreen} from './src/ui/ErrorScreen';
import {SettingsScreen} from './src/ui/SettingsScreen';

function App(): React.JSX.Element {
  const state = useSyncExternalStore(
    todayController.subscribe,
    todayController.getSnapshot,
    todayController.getSnapshot,
  );
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      {state.kind === 'error' ? (
        <ErrorScreen
          failure={state.failure}
          onRetry={todayController.openToday}
          onSettings={todayController.showSettings}
          onClose={todayController.close}
        />
      ) : state.kind === 'settings' ? (
        <SettingsScreen
          journalRoot={DEFAULT_JOURNAL_ROOT}
          {...state}
          onClose={todayController.close}
        />
      ) : (
        <Text style={styles.message}>
          {state.kind === 'opening'
            ? 'Opening native note...'
            : state.kind === 'settings-loading'
            ? 'Loading status...'
            : 'Today is ready.'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#ffffff'},
  message: {padding: 40, color: '#111111', fontSize: 24},
});

export default App;
