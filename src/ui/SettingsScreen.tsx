import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type {SettingsSnapshot} from '../application/settingsService';
import {ActionButton} from './ActionButton';

export interface PhaseChoice {
  readonly id: string;
  readonly label: string;
}

export interface PendingSettingsAction {
  readonly label: string;
}

export interface SettingsScreenProps {
  readonly snapshot: SettingsSnapshot;
  readonly deviceName: string;
  readonly diagnosticsMessage: string | null;
  readonly journalRootDraft: string;
  readonly statusMessage: string | null;
  readonly busy: boolean;
  readonly phaseChoices: readonly PhaseChoice[];
  readonly pendingAction: PendingSettingsAction | null;
  readonly onJournalRootChange: (value: string) => void;
  readonly onSaveJournalRoot: () => void;
  readonly onRequestReset: () => void;
  readonly onRequestPhase: (choice: PhaseChoice) => void;
  readonly onConfirmAction: () => void;
  readonly onCancelAction: () => void;
  readonly onClose: () => void;
}

export function SettingsScreen({
  snapshot,
  deviceName,
  diagnosticsMessage,
  journalRootDraft,
  statusMessage,
  busy,
  phaseChoices,
  pendingAction,
  onJournalRootChange,
  onSaveJournalRoot,
  onRequestReset,
  onRequestPhase,
  onConfirmAction,
  onCancelAction,
  onClose,
}: SettingsScreenProps): React.JSX.Element {
  const assignmentCount = Object.keys(snapshot.state.assignments).length;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>SUPERNOTE TODAY</Text>
          <Text style={styles.title}>Settings and status</Text>
        </View>
        <ActionButton label="Close" onPress={onClose} disabled={busy} />
      </View>

      <View style={styles.panel}>
        <Text style={styles.label}>Journal root</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          onChangeText={onJournalRootChange}
          style={styles.input}
          value={journalRootDraft}
        />
        <Text style={styles.help}>
          Future notes use YYYY-MM-DD.note inside this NOTE folder.
        </Text>
        <ActionButton
          label="Save journal root"
          onPress={onSaveJournalRoot}
          emphasis="primary"
          disabled={busy}
        />
      </View>

      <View style={styles.twoColumns}>
        <View style={[styles.panel, styles.column]}>
          <Text style={styles.label}>Next cursive lesson</Text>
          <Text style={styles.value}>{snapshot.nextLessonTitle}</Text>
          <Text style={styles.help}>
            Phase: {snapshot.nextLessonPhase.replace(/-/g, ' ')}
          </Text>
          <Text style={styles.help}>
            Recorded dated assignments: {assignmentCount}
          </Text>
          <ActionButton
            label="Reset to lesson 1"
            onPress={onRequestReset}
            disabled={busy}
            emphasis="danger"
          />
        </View>

        <View style={[styles.panel, styles.column]}>
          <Text style={styles.label}>Device</Text>
          <Text style={styles.value}>{deviceName}</Text>
          <Text style={styles.help}>
            State: Document/SupernoteToday/state.json
          </Text>
          {diagnosticsMessage === null ? null : (
            <Text style={styles.warning}>{diagnosticsMessage}</Text>
          )}
        </View>
      </View>

      <View style={styles.panel}>
        <Text style={styles.label}>Start future practice at a phase</Text>
        <Text style={styles.help}>
          Existing dated notes and their assigned exercises are not changed.
        </Text>
        <View style={styles.actions}>
          {phaseChoices.map(choice => (
            <ActionButton
              key={choice.id}
              label={choice.label}
              onPress={() => onRequestPhase(choice)}
              disabled={busy}
            />
          ))}
        </View>
      </View>

      {pendingAction === null ? null : (
        <View style={styles.confirmation}>
          <Text style={styles.confirmationText}>{pendingAction.label}</Text>
          <View style={styles.actions}>
            <ActionButton
              label="Confirm"
              onPress={onConfirmAction}
              emphasis="primary"
              disabled={busy}
            />
            <ActionButton
              label="Cancel"
              onPress={onCancelAction}
              disabled={busy}
            />
          </View>
        </View>
      )}

      {statusMessage === null ? null : (
        <Text style={styles.status}>{statusMessage}</Text>
      )}
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
    fontSize: 25,
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
  input: {
    minHeight: 56,
    borderWidth: 2,
    borderColor: '#222222',
    color: '#111111',
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    fontSize: 18,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  confirmation: {
    borderWidth: 3,
    borderColor: '#111111',
    borderStyle: 'dashed',
    padding: 22,
    gap: 16,
  },
  confirmationText: {
    color: '#111111',
    fontSize: 20,
    fontWeight: '600',
  },
  status: {
    color: '#111111',
    fontSize: 18,
    lineHeight: 27,
  },
});
