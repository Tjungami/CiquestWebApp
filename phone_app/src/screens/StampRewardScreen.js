import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import AeroBackground from '../components/AeroBackground';

export default function StampRewardScreen({ navigation, route }) {
  const storeName = route?.params?.storeName || '店舗';
  const rewardDetail = route?.params?.rewardDetail || 'サービス';

  return (
    <AeroBackground style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="gift-outline" size={26} color="#fff" />
        </View>
        <Text style={styles.title}>スタンプ特典を獲得しました</Text>
        <Text style={styles.reward}>{rewardDetail}</Text>
        <Text style={styles.note}>
          この画面を店員に見せてください。
        </Text>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => navigation.goBack()}
      >
        <Text style={styles.primaryText}>閉じる</Text>
      </TouchableOpacity>
    </AeroBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  card: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 10,
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 6,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.skyDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  reward: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  note: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: colors.skyDeep,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 6,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
  },
});
