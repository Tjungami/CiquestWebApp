import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import colors from '../theme/colors';

export default function QuestClearProcessingScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.skyDeep} />
      <Text style={styles.text}>クリア処理中...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  text: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
});
