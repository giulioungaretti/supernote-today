import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

export function OpeningScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Opening today...</Text>
      <Text style={styles.detail}>
        Checking the dated native note and cursive lesson.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 40,
  },
  title: {
    color: '#111111',
    fontSize: 30,
    fontWeight: '700',
    textAlign: 'center',
  },
  detail: {
    maxWidth: 620,
    marginTop: 18,
    color: '#333333',
    fontSize: 19,
    lineHeight: 28,
    textAlign: 'center',
  },
});
