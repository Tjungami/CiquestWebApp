import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import NfcManager, { Ndef, NfcTech } from 'react-native-nfc-manager';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import colors from '../theme/colors';
import LockedOverlay from '../components/LockedOverlay';
import { useAuth } from '../contexts/AuthContext';
import { useChallenges } from '../contexts/ChallengeContext';
import { clearUserChallenge } from '../api/challenges';
import AeroBackground from '../components/AeroBackground';

export default function ScanScreen({ navigation, route }) {
  const { loggedIn, updateUser, addUserCoupon } = useAuth();
  const { activeChallenges, clearChallengeByQr, retireChallenge } = useChallenges();
  const [message, setMessage] = useState('');
  const [nfcSupported, setNfcSupported] = useState(null);
  const [nfcBusy, setNfcBusy] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const isWeb = Platform.OS === 'web';
  const inProgressChallenges = activeChallenges.filter(
    (challenge) => challenge.status === 'in_progress'
  );

  const handleQrResult = async (qrValue, sourceLabel) => {
    const trimmed = typeof qrValue === 'string' ? qrValue.trim() : '';
    if (!trimmed) {
      setMessage('コードを入力してください。');
      return;
    }
    const targetChallenge = activeChallenges.find((challenge) => challenge.qrCode === trimmed);
    if (!targetChallenge) {
      if (sourceLabel) {
        setMessage(`スキャン結果 (${sourceLabel}): ${trimmed} / 対象のクエストがありません。`);
        return;
      }
      setMessage(`QRコードを検知: ${trimmed} / 対象のクエストがありません。`);
      return;
    }
    setMessage('クリア処理中...');
    navigation.navigate('QuestClearProcessing');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setMessage('位置情報の許可が必要です。');
        navigation.goBack();
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      const lat = location?.coords?.latitude;
      const lon = location?.coords?.longitude;
      if (typeof lat !== 'number' || typeof lon !== 'number') {
        setMessage('位置情報を取得できませんでした。');
        navigation.goBack();
        return;
      }
      const payload = {
        challenge_id: targetChallenge.id,
        qr_code: trimmed,
        lat,
        lon,
      };
      const response = await clearUserChallenge(payload);
      const result = clearChallengeByQr(trimmed);
      if (result.cleared) {
        const rewardPoints =
          response?.reward_points ?? response?.rewardPoints ?? result.challenge?.rewardPoints;
        const rewardDetail =
          response?.reward_detail ?? response?.rewardDetail ?? result.challenge?.reward;
        const clearedChallenge = {
          ...result.challenge,
          rewardPoints,
          reward: rewardDetail,
          rewardType: response?.reward_type ?? result.challenge?.rewardType,
          rewardCouponId: response?.reward_coupon_id ?? result.challenge?.rewardCouponId,
          rewardCouponTitle: response?.reward_coupon_title ?? result.challenge?.rewardCouponTitle,
        };
        if (typeof response?.user_points === 'number') {
          updateUser({ points: response.user_points });
        }
        if (response?.reward_type === 'coupon' && response?.reward_coupon_id) {
          addUserCoupon({
            id: String(response.reward_coupon_id),
            title: response.reward_coupon_title || rewardDetail || '',
            desc: rewardDetail || '',
            used: false,
          });
        }
        setMessage(`「${clearedChallenge.title}」をクリアしました！`);
        const nextRoute = response?.rank_up ? 'RankUp' : 'QuestClear';
        const nextParams = response?.rank_up
          ? {
              challenge: clearedChallenge,
              rank: response.rank,
              previousRank: response.previous_rank,
              rankMultiplier: response.rank_multiplier,
            }
          : { challenge: clearedChallenge };
        if (Array.isArray(response?.new_badges) && response.new_badges.length > 0) {
          navigation.replace('BadgeUnlock', {
            badges: response.new_badges,
            nextRoute,
            nextParams,
          });
          return;
        }
        navigation.replace(nextRoute, nextParams);
        return;
      }
      setMessage('クエストのクリアに失敗しました。');
      navigation.goBack();
    } catch (err) {
      setMessage(err?.message || 'クエストのクリアに失敗しました。');
      navigation.goBack();
    }
  };

  const startScan = () => {
    navigation.navigate('FullScan');
  };
  const startNfcScan = async () => {
    if (nfcSupported === false) {
      Alert.alert('NFCスキャン', 'この端末はNFCに対応していません。');
      return;
    }
    try {
      setNfcBusy(true);
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();
      const textPayload = getNdefText(tag);
      if (textPayload) {
        await handleQrResult(textPayload, 'nfc');
      } else if (tag?.id) {
        await handleQrResult(tag.id, 'nfc');
      } else {
        setMessage('NFCタグからデータを取得できませんでした。');
      }
    } catch (err) {
      if (!String(err?.message || '').includes('cancel')) {
        setMessage('NFC読み取りに失敗しました。');
      }
    } finally {
      setNfcBusy(false);
      NfcManager.cancelTechnologyRequest().catch(() => {});
    }
  };

  const handleRetire = (challenge) => {
    Alert.alert('リタイアしますか？', `${challenge.title}をチャレンジ中クエストから外します。`, [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'リタイア',
        style: 'destructive',
        onPress: () => {
          retireChallenge(challenge.id);
        },
      },
    ]);
  };

  const handleChallengePress = (challenge) => {
    setSelectedChallenge(challenge);
  };

  const closeChallengeModal = () => {
    setSelectedChallenge(null);
  };

  useEffect(() => {
    if (isWeb) {
      return;
    }
    let mounted = true;
    const prepare = async () => {
      try {
        const supported = await NfcManager.isSupported();
        if (!mounted) return;
        setNfcSupported(supported);
        if (supported) {
          await NfcManager.start();
        }
      } catch (err) {
        if (mounted) setNfcSupported(false);
      }
    };
    prepare();
    return () => {
      mounted = false;
      NfcManager.cancelTechnologyRequest().catch(() => {});
    };
  }, [isWeb]);

  useEffect(() => {
    const scannedData = route?.params?.scannedData;
    if (!scannedData) return;
    const scannedType = route?.params?.scannedType || 'qr';
    void handleQrResult(scannedData, scannedType);
    navigation.setParams({ scannedData: undefined, scannedType: undefined });
  }, [navigation, route?.params?.scannedData, route?.params?.scannedType]);

  if (!loggedIn) {
    return (
      <LockedOverlay
        title="ログインが必要です"
        description="スキャン機能を使うにはログインしてください。"
        onLogin={() => navigation.navigate('Login')}
      />
    );
  }

  return (
    <AeroBackground style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>スキャン</Text>
          <Text style={styles.subtitle}>QRコードをカメラで読み取ります。</Text>
        </View>

        <View style={styles.frame}>
          <View style={styles.frameInner}>
            <Ionicons name="qr-code-outline" size={56} color={colors.navy} />
            <Text style={styles.frameText}>QRコードをスキャンします</Text>
            <Text style={styles.frameHint}>ボタンを押すと全画面カメラが開きます。</Text>
            <TouchableOpacity style={styles.scanBtn} onPress={startScan}>
              <Text style={styles.scanText}>スキャンする</Text>
            </TouchableOpacity>
          </View>
        </View>

        {!isWeb && (
          <View style={styles.nfcSection}>
            <Text style={styles.nfcLabel}>NFCスキャン</Text>
            <Text style={styles.nfcHint}>
              {nfcSupported === false
                ? 'この端末はNFCに対応していません。'
                : 'タグをスマホに近づけてください。'}
            </Text>
            <TouchableOpacity style={styles.nfcBtn} onPress={startNfcScan} disabled={nfcBusy}>
              <Text style={styles.nfcText}>{nfcBusy ? 'スキャン中...' : 'NFCスキャンを開始'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.challengeSection}>
          <Text style={styles.challengeTitle}>チャレンジ中クエスト</Text>
          {inProgressChallenges.length === 0 ? (
            <Text style={styles.challengeEmpty}>チャレンジ中のクエストはありません。</Text>
          ) : (
            inProgressChallenges.map((challenge) => (
              <TouchableOpacity
                key={challenge.id}
                style={styles.challengeCard}
                onPress={() => handleChallengePress(challenge)}
              >
                <View style={styles.challengeRow}>
                  <View style={styles.challengeDetails}>
                    <Text style={styles.challengeName}>{challenge.title}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.retireBtn}
                    onPress={() => handleRetire(challenge)}
                  >
                    <Text style={styles.retireText}>リタイア</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.challengeMeta}>
                  <Text style={styles.challengeMetaText}>{challenge.storeName || '店舗'}</Text>
                  <Text style={styles.challengeMetaText}>受注中</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      <Modal
        visible={Boolean(selectedChallenge)}
        transparent
        animationType="fade"
        onRequestClose={closeChallengeModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{selectedChallenge?.title || ''}</Text>
            <Text style={styles.modalText}>
              {selectedChallenge?.description || '詳細情報はありません。'}
            </Text>
            <View style={styles.modalMeta}>
              <Text style={styles.modalMetaText}>{selectedChallenge?.storeName || '店舗'}</Text>
              <Text style={styles.modalMetaText}>受注中</Text>
            </View>
            <TouchableOpacity style={styles.modalButton} onPress={closeChallengeModal}>
              <Text style={styles.modalButtonText}>閉じる</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </AeroBackground>
  );
}

function getNdefText(tag) {
  const message = tag?.ndefMessage;
  if (!Array.isArray(message)) return '';
  for (const record of message) {
    try {
      const text = Ndef.text.decodePayload(record.payload);
      if (text) return text;
    } catch (err) {
      continue;
    }
  }
  return '';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  subtitle: {
    marginTop: 6,
    color: colors.textSecondary,
  },
  frame: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    backgroundColor: colors.glass,
  },
  frameInner: {
    height: 240,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.sky,
    backgroundColor: colors.glassStrong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  frameText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  frameHint: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  nfcSection: {
    marginTop: 18,
    gap: 6,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nfcLabel: {
    color: colors.textPrimary,
    fontWeight: '800',
  },
  nfcHint: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  nfcBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    backgroundColor: colors.skyDeep,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: colors.shadow,
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 5,
  },
  nfcText: {
    color: '#fff',
    fontWeight: '700',
  },
  scanBtn: {
    marginTop: 8,
    backgroundColor: colors.skyDeep,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: colors.shadow,
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 5,
  },
  scanText: {
    color: '#fff',
    fontWeight: '700',
  },
  challengeSection: {
    marginTop: 8,
    gap: 8,
  },
  challengeTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  challengeEmpty: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  challengeCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 9,
    elevation: 4,
    gap: 6,
  },
  challengeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  challengeDetails: {
    flex: 1,
    gap: 4,
  },
  challengeName: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  retireBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.glassStrong,
  },
  retireText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  challengeMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  challengeMetaText: {
    color: colors.skyDeep,
    fontWeight: '700',
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(12,45,68,0.12)',
    gap: 10,
    shadowColor: colors.shadow,
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  modalMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalMetaText: {
    color: colors.skyDeep,
    fontWeight: '700',
    fontSize: 12,
  },
  modalButton: {
    marginTop: 4,
    backgroundColor: colors.skyDeep,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});
