import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AeroBackground from '../components/AeroBackground';
import colors from '../theme/colors';

export default function LocationRequiredScreen({ status, onRequestPermission }) {
  const denied = status === 'denied';
  return (
    <AeroBackground style={styles.container}>
      <View style={styles.card}>
        <Ionicons name="location-outline" size={46} color={colors.skyDeep} />
        <Text style={styles.title}>位置情報の許可が必要です</Text>
        <Text style={styles.description}>
          不正対策のため、位置情報の権限が許可されない場合はアプリを利用できません。
        </Text>
        <TouchableOpacity style={styles.button} onPress={onRequestPermission}>
          <Text style={styles.buttonText}>
            {denied ? '再試行' : '位置情報を許可する'}
          </Text>
        </TouchableOpacity>
        {denied ? (
          <Text style={styles.hint}>端末の設定で位置情報の許可を有効にしてください。</Text>
        ) : null}
      </View>
    </AeroBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.glassStrong,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  title: {
    marginTop: 12,
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  description: {
    marginTop: 12,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  button: {
    marginTop: 20,
    backgroundColor: colors.skyDeep,
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: 999,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  hint: {
    marginTop: 14,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
