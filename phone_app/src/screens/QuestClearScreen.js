import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import AeroBackground from '../components/AeroBackground';

export default function QuestClearScreen({ navigation, route }) {
  const challenge = route?.params?.challenge ?? {};
  const title = challenge.title || 'クエスト';
  const storeName = challenge.storeName || '';
  const pointsRaw = challenge.rewardPoints ?? challenge.reward_points ?? challenge.points ?? null;
  const points =
    typeof pointsRaw === 'number'
      ? Number.isFinite(pointsRaw)
        ? pointsRaw
        : null
      : typeof pointsRaw === 'string' && pointsRaw.trim() !== ''
        ? Number.isFinite(Number(pointsRaw))
          ? Number(pointsRaw)
          : null
        : null;
  const reward = challenge.reward || challenge.reward_detail || '';
  const rewardType = challenge.rewardType || challenge.reward_type || '';
  const couponTitle =
    challenge.rewardCouponTitle || challenge.reward_coupon_title || reward || '';
  let rewardMessage = '';
  if (rewardType === 'coupon') {
    rewardMessage = couponTitle ? `クーポン「${couponTitle}」を獲得しました` : 'クーポンを獲得しました';
  } else if (rewardType === 'service') {
    rewardMessage = 'サービス特典を獲得しました';
  }

  return (
    <AeroBackground style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="sparkles" size={26} color="#fff" />
        </View>
        <Text style={styles.title}>{title}クエストをクリアしました</Text>
        {!!storeName && <Text style={styles.meta}>{storeName}</Text>}
        {!!reward && <Text style={styles.meta}>{reward}</Text>}
        {points !== null && <Text style={styles.points}>{points} pt 獲得</Text>}
      </View>

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => navigation.navigate('Tabs', { screen: 'Scan' })}
      >
        <Text style={styles.primaryText}>スキャンへ戻る</Text>
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
    gap: 8,
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
  },
  questName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  points: {
    marginTop: 4,
    color: colors.skyDeep,
    fontWeight: '700',
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
