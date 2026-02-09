import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import colors from '../theme/colors';
import AeroBackground from '../components/AeroBackground';

export default function CouponUseScanScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const handleClose = () => {
    navigation.goBack();
  };

  const handleBarcodeScanned = ({ data }) => {
    setScanned(true);
    navigation.navigate('Tabs', {
      screen: 'Coupons',
      params: {
        couponId: route?.params?.couponId,
        storeQr: data,
      },
      merge: true,
    });
  };

  if (!permission?.granted) {
    return (
      <AeroBackground style={styles.permissionContainer}>
        <Ionicons name="qr-code-outline" size={64} color={colors.navy} />
        <Text style={styles.permissionTitle}>カメラ権限が必要です</Text>
        <Text style={styles.permissionDesc}>
          クーポンを使用するため、カメラの使用を許可してください。
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
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />
      <View style={styles.overlay}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleClose}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>クーポン利用</Text>
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
