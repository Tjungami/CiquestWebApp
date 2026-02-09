import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused } from '@react-navigation/native';
import colors from '../theme/colors';
import { fetchChallenges, fetchStampSetting } from '../api/public';
import { useChallenges } from '../contexts/ChallengeContext';
import { useAuth } from '../contexts/AuthContext';
import AeroBackground from '../components/AeroBackground';

export default function StoreDetailScreen({ navigation, route }) {
  const isFocused = useIsFocused();
  const { loggedIn } = useAuth();
  const { startChallenge, clearedChallenges } = useChallenges();
  const store = route?.params?.store ?? {};
  const name = store.name || '店舗名未設定';
  const description = store.description || '説明はまだありません。';
  const tag = store.tag || '一般';
  const distanceLabel = typeof store.distance === 'number' ? `${store.distance}m` : '-';
  const hasCoords = typeof store.lat === 'number' && typeof store.lon === 'number';
  const storeId = store.storeId ?? store.store_id ?? store.id ?? null;
  const address = store.address || '未登録';
  const hours = store.hours || '未登録';
  const phone = store.phone || '';
  const website = store.website || '';
  const [challenges, setChallenges] = useState([]);
  const [challengeError, setChallengeError] = useState('');
  const [confirmChallenge, setConfirmChallenge] = useState(null);
  const [successChallenge, setSuccessChallenge] = useState(null);
  const [stampSetting, setStampSetting] = useState(null);
  const [stampError, setStampError] = useState('');
  const parseNumber = (value) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const doStartChallenge = (challenge) => {
    if (!loggedIn) {
      Alert.alert(
        'ログインが必要です',
        'クエストを受注するにはログインしてください。',
        [
          { text: 'キャンセル', style: 'cancel' },
          { text: 'ログイン', onPress: () => navigation.navigate('Login') },
        ]
      );
      return;
    }
    if (!challenge.qrCode) {
      Alert.alert('QRコード未設定', 'このクエストはQRコードが登録されていません。');
      return;
    }
    const result = startChallenge({
      ...challenge,
      storeName: store.name || challenge.storeName || '',
    });
    if (result.created) {
      setSuccessChallenge(challenge);
      return;
    }
    if (result.reason === 'already_active') {
      Alert.alert('確認', 'すでに受注中です。');
      return;
    }
    if (result.reason === 'already_cleared') {
      Alert.alert('確認', 'すでにクリア済みです。');
      return;
    }
    Alert.alert('エラー', 'クエストの受注に失敗しました。');
  };

  const handleStartChallenge = (challenge) => {
    if (!loggedIn) {
      Alert.alert(
        'ログインが必要です',
        'クエストを受注するにはログインしてください。',
        [
          { text: 'キャンセル', style: 'cancel' },
          { text: 'ログイン', onPress: () => navigation.navigate('Login') },
        ]
      );
      return;
    }
    if (!challenge.qrCode) {
      Alert.alert('QRコード未設定', 'このクエストはQRコードが登録されていません。');
      return;
    }
    setConfirmChallenge(challenge);
  };

  const details = useMemo(
    () => [
      { icon: 'pricetag-outline', label: 'カテゴリ', value: tag },
      { icon: 'navigate-outline', label: '距離', value: distanceLabel },
      { icon: 'time-outline', label: '営業時間', value: hours },
      { icon: 'call-outline', label: '電話', value: phone || '未登録' },
      { icon: 'location-outline', label: '住所', value: address },
    ],
    [tag, distanceLabel, hours, phone, address]
  );

  const handleDirections = () => {
    if (!hasCoords) {
      Alert.alert(
        '位置情報なし',
        'この店舗には地図位置が登録されていません。'
      );
      return;
    }
    const url = `https://www.google.com/maps?q=${store.lat},${store.lon}`;
    Linking.openURL(url);
  };

  const handleCall = () => {
    if (!phone) {
      Alert.alert(
        '電話番号なし',
        'この店舗には電話番号が登録されていません。'
      );
      return;
    }
    const phoneUrl = `tel:${phone.replace(/\s+/g, '')}`;
    Linking.openURL(phoneUrl);
  };

  const handleWebsite = () => {
    if (!website) {
      Alert.alert(
        'Webなし',
        'この店舗にはWebリンクが登録されていません。'
      );
      return;
    }
    Linking.openURL(website);
  };

  useEffect(() => {
    let active = true;

    const loadChallenges = async () => {
      if (!storeId) {
        setChallenges([]);
        setChallengeError('');
        return;
      }
      try {
        const data = await fetchChallenges({ store_id: storeId });
        if (!active) return;
        const normalized = data
          .filter((item) => {
            const itemStoreId = item.store_id ?? item.storeId ?? item.store?.id ?? null;
            return String(itemStoreId ?? '') === String(storeId);
          })
          .map((item) => ({
            id: String(item.challenge_id ?? item.id ?? item.title ?? Math.random()),
            title: item.title || 'クエスト',
            description: item.description || '',
            storeName: item.store_name || store.name || '',
            points:
              parseNumber(item.reward_points) ??
              parseNumber(item.rewardPoints) ??
              parseNumber(item.points),
            reward: item.reward_detail || item.reward || '',
            type: item.type || item.quest_type || '',
            qrCode: item.qr_code || item.qrCode || '',
          }));
        setChallenges(normalized);
        setChallengeError('');
      } catch (error) {
        if (!active) return;
        setChallengeError(
          error?.message || 'クエストの取得に失敗しました。'
        );
      }
    };

    loadChallenges();
    return () => {
      active = false;
    };
  }, [storeId]);

  useEffect(() => {
    let active = true;
    const loadStampSetting = async () => {
      if (!storeId) {
        setStampSetting(null);
        setStampError('');
        return;
      }
      try {
        const data = await fetchStampSetting({ store_id: storeId });
        if (!active) return;
        setStampSetting(data);
        setStampError('');
      } catch (error) {
        if (!active) return;
        setStampError(error?.message || 'スタンプカードの取得に失敗しました。');
      }
    };
    loadStampSetting();
    return () => {
      active = false;
    };
  }, [storeId, isFocused]);

  return (
    <AeroBackground style={styles.container}>
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>店舗詳細</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={[colors.glassStrong, colors.card]} style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroBadge}>
              <Ionicons name="star" size={12} color="#fff" />
              <Text style={styles.heroBadgeText}>注目</Text>
            </View>
            <Text style={styles.heroDistance}>{distanceLabel}</Text>
          </View>
          <Text style={styles.heroTitle}>{name}</Text>
          <Text style={styles.heroDesc}>{description}</Text>
          <View style={styles.heroTags}>
            <View style={styles.tagPill}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
            {!!website && (
              <TouchableOpacity style={styles.webPill} onPress={handleWebsite}>
                <Ionicons name="globe-outline" size={14} color={colors.skyDeep} />
                <Text style={styles.webText}>ウェブ</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.actionRow}>
            <ActionButton
              label="経路"
              icon="navigate-outline"
              onPress={handleDirections}
              variant="primary"
            />
            <ActionButton label="電話" icon="call-outline" onPress={handleCall} />
          </View>
        </LinearGradient>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>概要</Text>
          <Text style={styles.sectionBody}>{description}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>詳細</Text>
          <View style={styles.detailList}>
            {details.map((item) => (
              <View key={item.label} style={styles.detailRow}>
                <Ionicons name={item.icon} size={16} color={colors.skyDeep} />
                <Text style={styles.detailLabel}>{item.label}</Text>
                <Text style={styles.detailValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>スタンプカード</Text>
          {!!stampError && <Text style={styles.errorText}>{stampError}</Text>}
          {stampSetting?.exists ? (
            <View style={styles.stampCard}>
              <View style={styles.stampRow}>
                <Text style={styles.stampLabel}>最大</Text>
                <Text style={styles.stampValue}>{stampSetting.max_stamps}個</Text>
              </View>
              {stampSetting.user_stamps && (
                <View style={styles.stampRow}>
                  <Text style={styles.stampLabel}>現在</Text>
                  <Text style={styles.stampValue}>
                    {stampSetting.user_stamps.stamps_count}個
                  </Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.stampButton}
                onPress={() => {
                  if (!loggedIn) {
                    Alert.alert(
                      'ログインが必要です',
                      'スタンプをためるにはログインしてください。',
                      [
                        { text: 'キャンセル', style: 'cancel' },
                        { text: 'ログイン', onPress: () => navigation.navigate('Login') },
                      ]
                    );
                    return;
                  }
                  navigation.navigate('StampScan', {
                    storeId,
                    storeName: store.name || '店舗',
                  });
                }}
              >
                <Text style={styles.stampButtonText}>スタンプをためる</Text>
              </TouchableOpacity>
              {Array.isArray(stampSetting.rewards) && stampSetting.rewards.length > 0 && (
                <View style={styles.rewardList}>
                  {stampSetting.rewards.map((reward, index) => (
                    <View key={`${reward.stamp_threshold}-${index}`} style={styles.rewardPill}>
                      <Text style={styles.rewardText}>
                        {reward.stamp_threshold}個:{" "}
                        {reward.reward_type === 'coupon'
                          ? reward.reward_coupon_title || 'クーポン'
                          : reward.reward_service_desc || 'サービス'}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.emptyText}>この店舗のスタンプカードはありません。</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>クエスト</Text>
          {!!challengeError && <Text style={styles.errorText}>{challengeError}</Text>}
          {challenges.length === 0 ? (
            <Text style={styles.emptyText}>クエストはまだありません。</Text>
          ) : (
            <View style={styles.challengeList}>
              {challenges.map((challenge) => {
                const isCleared = clearedChallenges.some(
                  (item) => String(item.id) === String(challenge.id)
                );
                return (
                  <TouchableOpacity
                    key={challenge.id}
                    style={[styles.challengeCard, isCleared && styles.challengeCardDisabled]}
                    activeOpacity={0.85}
                    disabled={isCleared}
                    onPress={() => handleStartChallenge(challenge)}
                  >
                  <View style={styles.challengeHeader}>
                    <Text style={styles.challengeTitle}>{challenge.title}</Text>
                    {isCleared && (
                      <View style={styles.clearedPill}>
                        <Text style={styles.clearedText}>クリア済み</Text>
                      </View>
                    )}
                    {typeof challenge.points === 'number' && (
                      <View style={styles.pointsPill}>
                        <Ionicons name="sparkles" size={12} color="#fff" />
                        <Text style={styles.pointsText}>{challenge.points} pt</Text>
                      </View>
                    )}
                  </View>
                  {!!challenge.description && (
                    <Text style={styles.challengeDesc}>{challenge.description}</Text>
                  )}
                  <View style={styles.challengeMetaRow}>
                    {!!challenge.type && (
                      <View style={styles.metaPill}>
                        <Text style={styles.metaText}>{challenge.type}</Text>
                      </View>
                    )}
                    {!!challenge.reward && (
                      <View style={styles.metaPill}>
                        <Text style={styles.metaText}>{challenge.reward}</Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
      <Modal
        transparent
        visible={!!confirmChallenge}
        animationType="fade"
        onRequestClose={() => setConfirmChallenge(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>クエストを受注しますか？</Text>
            {!!confirmChallenge && (
              <Text style={styles.modalBody}>
                {confirmChallenge.title}をチャレンジ中クエストに追加します。
              </Text>
            )}
            <Text style={styles.modalWarning}>
              このクエストは
              {store.name || confirmChallenge?.storeName || '対象店舗'}
              店のみ有効です
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setConfirmChallenge(null)}
              >
                <Text style={styles.modalCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={() => {
                  if (confirmChallenge) {
                    doStartChallenge(confirmChallenge);
                  }
                  setConfirmChallenge(null);
                }}
              >
                <Text style={styles.modalConfirmText}>受注する</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <Modal
        transparent
        visible={!!successChallenge}
        animationType="fade"
        onRequestClose={() => setSuccessChallenge(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>受注しました</Text>
            {!!successChallenge && (
              <Text style={styles.modalBody}>
                {successChallenge.title}をチャレンジ中クエストに追加しました。
              </Text>
            )}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={() => setSuccessChallenge(null)}
              >
                <Text style={styles.modalConfirmText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AeroBackground>
  );
}

function ActionButton({ label, icon, onPress, variant }) {
  return (
    <TouchableOpacity
      style={[styles.actionButton, variant === 'primary' && styles.actionButtonPrimary]}
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={18}
        color={variant === 'primary' ? '#fff' : colors.skyDeep}
      />
      <Text
        style={[styles.actionButtonText, variant === 'primary' && styles.actionButtonTextPrimary]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  heroCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.skyDeep,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  heroBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  heroDistance: {
    color: colors.skyDeep,
    fontWeight: '700',
  },
  heroTitle: {
    marginTop: 12,
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  heroDesc: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  heroTags: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  tagPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.glassStrong,
  },
  tagText: {
    color: colors.skyDeep,
    fontWeight: '700',
    fontSize: 12,
  },
  webPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  webText: {
    color: colors.skyDeep,
    fontWeight: '700',
    fontSize: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.skyDeep,
    backgroundColor: colors.glassStrong,
  },
  actionButtonPrimary: {
    backgroundColor: colors.skyDeep,
  },
  actionButtonText: {
    fontWeight: '700',
    color: colors.skyDeep,
  },
  actionButtonTextPrimary: {
    color: '#fff',
  },
  section: {
    marginTop: 18,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  sectionBody: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  detailList: {
    marginTop: 10,
    gap: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailLabel: {
    width: 80,
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  detailValue: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
  },
  stampCard: {
    marginTop: 10,
    gap: 8,
  },
  stampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stampLabel: {
    width: 48,
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  stampValue: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  stampButton: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: colors.skyDeep,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  stampButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  rewardList: {
    marginTop: 6,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rewardPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rewardText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  errorText: {
    marginTop: 8,
    color: '#c0392b',
    fontSize: 12,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(12,45,68,0.12)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 8,
    gap: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  modalWarning: {
    color: '#c0392b',
    fontSize: 12,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  modalCancel: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  modalConfirm: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.skyDeep,
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: '700',
  },
  emptyText: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 13,
  },
  challengeList: {
    marginTop: 12,
    gap: 12,
  },
  challengeCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    backgroundColor: colors.card,
  },
  challengeCardDisabled: {
    opacity: 0.5,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  challengeTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  pointsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.skyDeep,
  },
  pointsText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  clearedPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  clearedText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  challengeDesc: {
    marginTop: 6,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  challengeMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  metaPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.glassStrong,
  },
  metaText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.skyDeep,
  },
});
