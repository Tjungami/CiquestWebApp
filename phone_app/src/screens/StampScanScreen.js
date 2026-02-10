import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import colors from '../theme/colors';
import { isStampCooldownError, scanStoreStamp } from '../api/stamps';
import { useAuth } from '../contexts/AuthContext';
import AeroBackground from '../components/AeroBackground';

export default function StampScanScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { loggedIn, addUserCoupon } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const handleClose = () => {
    navigation.goBack();
  };

  const handleBarcodeScanned = async ({ data }) => {
    if (scanned) return;
    setScanned(true);
    try {
      const storeId = route?.params?.storeId;
      const storeName = route?.params?.storeName || '店舗';
      const response = await scanStoreStamp({
        store_id: storeId,
        store_qr: data,
      });
      const newBadges = Array.isArray(response?.new_badges) ? response.new_badges : [];
      if (response?.reward_type === 'service' && response?.reward_detail) {
        if (newBadges.length > 0) {
          navigation.replace('BadgeUnlock', {
            badges: newBadges,
            nextRoute: 'StampReward',
            nextParams: {
              storeName,
              rewardDetail: response.reward_detail,
            },
          });
          return;
        }
        navigation.replace('StampReward', {
          storeName,
          rewardDetail: response.reward_detail,
        });
        return;
      }
      if (response?.reward_type === 'coupon' && response?.reward_coupon_id) {
        addUserCoupon({
          id: String(response.reward_coupon_id),
          title: response.reward_coupon_title || response.reward_detail || '',
          desc: response.reward_detail || '',
          used: false,
        });
        if (newBadges.length > 0) {
          navigation.replace('BadgeUnlock', {
            badges: newBadges,
            title: 'クーポン獲得',
            message: `${storeName}のクーポンを獲得しました。`,
          });
          return;
        }
        Alert.alert('クーポン獲得', `${storeName}のクーポンを獲得しました。`, [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
        return;
      }
      if (newBadges.length > 0) {
        navigation.replace('BadgeUnlock', {
          badges: newBadges,
          title: 'スタンプ獲得',
          message: `${storeName}のスタンプを獲得しました。`,
        });
        return;
      }
      Alert.alert('スタンプ獲得', `${storeName}のスタンプを獲得しました。`, [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
      return;
    } catch (err) {
      if (isStampCooldownError(err)) {
        navigation.replace('StampCooldown', {
          storeName,
        });
        return;
      }
      Alert.alert('スタンプ取得エラー', err?.message || 'スタンプの取得に失敗しました。');
      setScanned(false);
    }
  };

  if (!permission?.granted) {
    if (!loggedIn) {
      return (
        <AeroBackground style={styles.permissionContainer}>
          <Ionicons name="lock-closed-outline" size={64} color={colors.navy} />
          <Text style={styles.permissionTitle}>ログインが必要です</Text>
          <Text style={styles.permissionDesc}>
            スタンプをためるにはログインしてください。
          </Text>
          <TouchableOpacity style={styles.permissionBtn} onPress={() => navigation.navigate('Login')}>
            <Text style={styles.permissionText}>ログインする</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
            <Text style={styles.cancelText}>戻る</Text>
          </TouchableOpacity>
        </AeroBackground>
      );
    }
    return (
      <AeroBackground style={styles.permissionContainer}>
        <Ionicons name="qr-code-outline" size={64} color={colors.navy} />
        <Text style={styles.permissionTitle}>カメラ権限が必要です</Text>
        <Text style={styles.permissionDesc}>
          スタンプをためるため、カメラの使用を許可してください。
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionText}>カメラを許可</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
          <Text style={styles.cancelText}>戻る</Text>
        </TouchableOpacity>
      </AeroBackground>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleBarcodeScanned}
      />
      <View style={styles.overlay}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleClose}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>スタンプ取得</Text>
          <View style={styles.iconBtn} />
        </View>
        <View style={styles.centerFrame}>
          <View style={styles.frameBox} />
        </View>
        <View style={styles.bottomHint}>
          <Text style={styles.hintText}>店舗のQRコードを読み取ってください。</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 24,
  },
  topBar: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  centerFrame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  frameBox: {
    width: 220,
    height: 220,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  bottomHint: {
    alignItems: 'center',
  },
  hintText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  permissionDesc: {
    textAlign: 'center',
    color: colors.textSecondary,
    lineHeight: 20,
  },
  permissionBtn: {
    marginTop: 4,
    backgroundColor: colors.skyDeep,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: colors.shadow,
    shadowOpacity: 0.26,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 6,
  },
  permissionText: {
    color: '#fff',
    fontWeight: '700',
  },
  cancelBtn: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  cancelText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
