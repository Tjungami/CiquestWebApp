import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import AeroBackground from '../components/AeroBackground';

export default function RankUpScreen({ navigation, route }) {
  const challenge = route?.params?.challenge ?? {};
  const rank = route?.params?.rank || 'ブロンズ';
  const previousRank = route?.params?.previousRank || '';
  const rankMultiplier = route?.params?.rankMultiplier ?? 1.0;
  const title = challenge.title || 'クエスト';

  return (
    <AeroBackground style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="trophy-outline" size={28} color="#fff" />
        </View>
        <Text style={styles.title}>おめでとうございます！</Text>
        <Text style={styles.rankText}>
          {previousRank ? `${previousRank} → ` : ''}
          {rank}にランクアップしました
        </Text>
        <View style={styles.benefit}>
          <Text style={styles.benefitTitle}>ランク特典</Text>
          <Text style={styles.benefitText}>
            クエストの報酬ポイントが{rankMultiplier}倍になります。
          </Text>
          <Text style={styles.benefitText}>
            さらにクエストをクリアしてポイントを増やしましょう。
          </Text>
        </View>
        <Text style={styles.clearText}>{title}クエストをクリアしました</Text>
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => navigation.replace('QuestClear', { challenge })}
      >
        <Text style={styles.primaryText}>クエストクリア詳細へ</Text>
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
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.skyDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  rankText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  benefit: {
    width: '100%',
    backgroundColor: colors.glassStrong,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  benefitText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  clearText: {
    fontSize: 13,
    color: colors.textSecondary,
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
