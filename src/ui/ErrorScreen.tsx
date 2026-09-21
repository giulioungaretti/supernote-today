import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

import type {EnsureTodayFailure} from '../application/ensureTodayNote';
import {ActionButton} from './ActionButton';

export interface ErrorScreenProps {
  readonly failure: EnsureTodayFailure;
  readonly onRetry: () => void;
  readonly onSettings: () => void;
  readonly onClose: () => void;
}

export function ErrorScreen({
  failure,
  onRetry,
  onSettings,
  onClose,
}: ErrorScreenProps): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>TODAY COULD NOT OPEN</Text>
      <Text style={styles.title}>{failure.step.replace(/-/g, ' ')}</Text>
      <Text style={styles.message}>{failure.message}</Text>
      {failure.code === undefined ? null : (
        <Text style={styles.code}>Supernote error {failure.code}</Text>
      )}
      <View style={styles.actions}>
        <ActionButton
          label="Retry"
          onPress={onRetry}
          emphasis="primary"
        />
        <ActionButton label="Settings" onPress={onSettings} />
        <ActionButton label="Close" onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 64,
    paddingVertical: 48,
  },
  eyebrow: {
    color: '#333333',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  title: {
    marginTop: 12,
    color: '#111111',
    fontSize: 34,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  message: {
    maxWidth: 760,
    marginTop: 18,
    color: '#111111',
    fontSize: 21,
    lineHeight: 31,
  },
  code: {
    marginTop: 12,
    color: '#555555',
    fontSize: 17,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 32,
  },
});
