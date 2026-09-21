import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';

export interface ActionButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly emphasis?: 'primary' | 'secondary' | 'danger';
  readonly disabled?: boolean;
}

export function ActionButton({
  label,
  onPress,
  emphasis = 'secondary',
  disabled = false,
}: ActionButtonProps): React.JSX.Element {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.button,
        emphasis === 'primary' ? styles.primary : null,
        emphasis === 'danger' ? styles.danger : null,
        pressed ? styles.pressed : null,
        disabled ? styles.disabled : null,
      ]}>
      <Text
        style={[
          styles.label,
          emphasis === 'primary' ? styles.primaryLabel : null,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    minWidth: 132,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#111111',
    backgroundColor: '#ffffff',
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  primary: {
    backgroundColor: '#111111',
  },
  danger: {
    borderStyle: 'dashed',
  },
  pressed: {
    opacity: 0.55,
  },
  disabled: {
    opacity: 0.35,
  },
  label: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryLabel: {
    color: '#ffffff',
  },
});
