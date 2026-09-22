import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';

import {ActionButton} from './ActionButton';

export interface SettingsScreenProps {
  readonly journalRoot: string;
  readonly date: string;
  readonly lessonTitle: string;
  readonly lessonPhase: string;
  readonly deviceName: string;
  readonly diagnosticsMessage: string | null;
  readonly onClose: () => void;
}

export function SettingsScreen({
  journalRoot,
  date,
  lessonTitle,
  lessonPhase,
  deviceName,
  diagnosticsMessage,
  onClose,
}: SettingsScreenProps): React.JSX.Element {
  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>SUPERNOTE TODAY</Text>
          <Text style={styles.title}>Status</Text>
        </View>
        <ActionButton label="Close" onPress={onClose} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.label}>Journal location</Text>
        <Text style={styles.value}>{journalRoot}</Text>
        <Text style={styles.help}>
          Notes use the filename YYYY-MM-DD.note. v0.2 keeps this location fixed
          so the plugin remains TypeScript-only.
        </Text>
      </View>

      <View style={styles.twoColumns}>
        <View style={[styles.panel, styles.column]}>
          <Text style={styles.label}>Lesson for {date}</Text>
          <Text style={styles.value}>{lessonTitle}</Text>
          <Text style={styles.help}>
            Phase: {lessonPhase.replace(/-/g, ' ')}
          </Text>
          <Text style={styles.help}>
            The lesson is derived deterministically from the date, so reopening
            the same day is idempotent without plugin storage.
          </Text>
        </View>

        <View style={[styles.panel, styles.column]}>
          <Text style={styles.label}>Device</Text>
          <Text style={styles.value}>{deviceName}</Text>
          <Text style={styles.help}>
            No custom APK, native module, network permission, or cloud service
            is used.
          </Text>
          {diagnosticsMessage === null ? null : (
            <Text style={styles.warning}>{diagnosticsMessage}</Text>
          )}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.label}>v0.2: static template, native ink</Text>
        <Text style={styles.help}>
          The PNG supplies the plan and ruled areas. Four native text boxes
          supply the date and lesson. The dated note archive is the history.
          Explicit practice progress, reset/start controls, and configurable
          roots require a documented TypeScript storage API and are deferred.
          Native note content remains the source of truth.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    padding: 40,
    gap: 22,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 20,
  },
  eyebrow: {
    color: '#444444',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  title: {
    marginTop: 8,
    color: '#111111',
    fontSize: 32,
    fontWeight: '700',
  },
  panel: {
    borderWidth: 2,
    borderColor: '#222222',
    backgroundColor: '#ffffff',
    padding: 22,
    gap: 14,
  },
  twoColumns: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 22,
  },
  column: {
    flex: 1,
  },
  label: {
    color: '#111111',
    fontSize: 19,
    fontWeight: '700',
  },
  value: {
    color: '#111111',
    fontSize: 24,
    fontWeight: '600',
  },
  help: {
    color: '#444444',
    fontSize: 17,
    lineHeight: 25,
  },
  warning: {
    color: '#111111',
    fontSize: 16,
    fontStyle: 'italic',
  },
});
