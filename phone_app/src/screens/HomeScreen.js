
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Linking,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import colors from '../theme/colors';
import { fetchStores } from '../api/public';
import AeroBackground from '../components/AeroBackground';
import StoreMap from '../components/StoreMap';

const mapStyle = [
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.business',
    elementType: 'all',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.attraction',
    elementType: 'all',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.government',
    elementType: 'all',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.medical',
    elementType: 'all',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.place_of_worship',
    elementType: 'all',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.school',
    elementType: 'all',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'poi.sports_complex',
    elementType: 'all',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
];

const defaultRegion = {
  latitude: 36.5551,
  longitude: 139.8828,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function HomeScreen() {
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const nextUpdateAtRef = useRef(Date.now() + 30000);
  const mapRef = useRef(null);
  const [stores, setStores] = useState([]);
  const [fetchError, setFetchError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [lastLocation, setLastLocation] = useState(null);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [hasCentered, setHasCentered] = useState(false);
  const [selected, setSelected] = useState(null);
  const [sheetAnim] = useState(() => new Animated.Value(0));
  const [contentAnim] = useState(() => new Animated.Value(1));
  const sheetTranslate = useMemo(
    () =>
      sheetAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [260, 0],
      }),
    [sheetAnim]
  );

  const ensurePermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setHasLocationPermission(granted);
      if (!granted) {
        setLocationError('位置情報の許可が必要です。');
        return false;
      }
      return true;
    } catch (error) {
      setLocationError(error?.message || '位置情報を取得できませんでした。');
      return false;
    }
  };

  const updateLocation = async () => {
    if (isLocating) return;
    const ok = hasLocationPermission ? true : await ensurePermission();
    if (!ok) return;
    try {
      setIsLocating(true);
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLastLocation(current);
      setLocationError('');
    } catch (error) {
      setLocationError(error?.message || '位置情報を取得できませんでした。');
    } finally {
      setIsLocating(false);
    }
  };

  const moveToCurrentLocation = () => {
    if (lastLocation) {
      mapRef.current?.animateToRegion(
        {
          latitude: lastLocation.coords.latitude,
          longitude: lastLocation.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        400
      );
      return;
    }
    setLocationError('位置情報がまだ取得されていません。');
  };

  const parseCoord = (value) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const handleSelect = (store) => {
    sheetAnim.stopAnimation();
    contentAnim.setValue(0.92);
    setSelected(store);
    Animated.spring(sheetAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
    }).start();
    Animated.spring(contentAnim, {
      toValue: 1,
      useNativeDriver: true,
      damping: 16,
      stiffness: 180,
    }).start();
  };

  const openMaps = (store) => {
    Linking.openURL(`https://www.google.com/maps?q=${store.lat},${store.lon}`);
  };

  const closeSheet = () => {
    setSelected(null);
    Animated.spring(sheetAnim, {
      toValue: 0,
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
    }).start();
  };

  useEffect(() => {
    if (!lastLocation && isFocused) {
      updateLocation();
    }
  }, [isFocused, lastLocation]);

  useEffect(() => {
    if (!lastLocation || hasCentered) return;
    mapRef.current?.animateToRegion(
      {
        latitude: lastLocation.coords.latitude,
        longitude: lastLocation.coords.longitude,
        latitudeDelta: defaultRegion.latitudeDelta,
        longitudeDelta: defaultRegion.longitudeDelta,
      },
      600
    );
    setHasCentered(true);
  }, [hasCentered, lastLocation]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      const now = Date.now();
      if (now < nextUpdateAtRef.current) return;
      nextUpdateAtRef.current += 30000;
      if (isFocused) {
        updateLocation();
      }
    }, 1000);
    return () => clearInterval(intervalId);
  }, [isFocused]);

  useEffect(() => {
    let active = true;

    const loadStores = async () => {
      try {
        const data = await fetchStores();
        if (!active) return;
        const normalized = data.map((store) => {
          const tags = Array.isArray(store.tags) ? store.tags : [];
          const distanceMeters =
            typeof store.distance === 'number' ? Math.round(store.distance * 1000) : null;
          const lat = parseCoord(store.lat ?? store.latitude);
          const lon = parseCoord(store.lon ?? store.longitude);
          return {
            id: String(store.id ?? store.store_id ?? store.pk ?? store.name ?? Math.random()),
            name: store.name || '',
            description: store.description || '',
            lat,
            lon,
            distance: distanceMeters,
            tag: tags[0] || '',
            tags,
          };
        });
        setStores(normalized);
        setFetchError('');
      } catch (error) {
        if (!active) return;
        setFetchError(error?.message || 'APIの取得に失敗しました。');
      }
    };

    loadStores();
    return () => {
      active = false;
    };
  }, []);

  return (
    <AeroBackground style={styles.container}>
      <LinearGradient colors={[colors.glassStrong, colors.glass]} style={styles.headerPill}>
        <View style={styles.headerLeft}>
          <Image source={require('../../assets/icon.png')} style={styles.headerIcon} />
          <Text style={styles.headerText}>Ciquest</Text>
        </View>
        <TouchableOpacity style={styles.noticeButton} onPress={() => navigation.navigate('Notices')}>
          <Ionicons name="notifications-outline" size={16} color="#ffffff" />
          <Text style={styles.noticeButtonText}>お知らせ</Text>
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.mapCard}>
        <View style={styles.mapSurface}>
          <StoreMap
            style={styles.mapView}
            ref={mapRef}
            initialRegion={defaultRegion}
            stores={stores}
            onSelect={handleSelect}
            mapStyle={mapStyle}
          />
          <View style={styles.mapOverlay} pointerEvents="box-none">
            <View style={styles.mapTitleRow}>
              <Text style={styles.mapTitle}>お店マップ</Text>
              <View style={styles.mapTitleActions}>
                <Text style={styles.mapCaption}>現在地からの距離は仮のデータです。</Text>
              </View>
            </View>
            <View style={styles.mapBottom}>
              <Text style={styles.mapHint}>ピンをタップして店舗情報を表示</Text>
              <View style={styles.mapActions}>
                <ActionChip
                  label="現在地に移動"
                  icon="compass-outline"
                  onPress={moveToCurrentLocation}
                  size="large"
                  disabled={isLocating}
                />
              </View>
              {!!locationError && <Text style={styles.fetchErrorText}>{locationError}</Text>}
              {!!fetchError && <Text style={styles.fetchErrorText}>{fetchError}</Text>}
            </View>
            {isLocating && (
              <View style={styles.loadingBadge}>
                <ActivityIndicator size="small" color={colors.skyDeep} />
                <Text style={styles.loadingText}>位置情報取得中</Text>
              </View>
            )}
          </View>
        </View>

        <Pressable
          style={styles.overlay}
          onPress={closeSheet}
          android_disableSound
          pointerEvents={selected ? 'auto' : 'none'}
        />

        <Animated.View
          pointerEvents="box-none"
          style={[styles.sheetContainer, { transform: [{ translateY: sheetTranslate }] }]}
        >
          <Animated.View
            style={{
              transform: [{ scale: contentAnim }],
              opacity: contentAnim,
            }}
          >
            <InfoCard
              store={selected}
              onOpenMaps={openMaps}
              onClose={closeSheet}
              onOpenDetail={(store) => navigation.navigate('StoreDetail', { store })}
            />
          </Animated.View>
        </Animated.View>
      </View>
    </AeroBackground>
  );
}

function ActionChip({ label, icon, onPress, size, disabled }) {
  const isLarge = size === 'large';
  const isSmall = size === 'small';
  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionChip,
        isLarge && styles.actionChipLarge,
        isSmall && styles.actionChipSmall,
        disabled && styles.actionChipDisabled,
        pressed && styles.actionChipPressed,
      ]}
      onPress={onPress}
      disabled={!onPress || disabled}
    >
      <Ionicons name={icon} size={isLarge ? 20 : isSmall ? 14 : 16} color={colors.navy} />
      <Text
        style={[
          styles.actionChipText,
          isLarge && styles.actionChipTextLarge,
          isSmall && styles.actionChipTextSmall,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function InfoCard({ store, onOpenMaps, onClose, onOpenDetail }) {
  if (!store) {
    return (
      <View style={[styles.infoCard, styles.infoCardEmpty]}>
        <View style={styles.sheetHandle} />
        <Text style={styles.infoTitle}>ピンをタップすると店舗情報が表示されます。</Text>
        <Text style={styles.infoSub}>本番では地図SDKに置き換え予定です。</Text>
      </View>
    );
  }

  return (
    <View style={styles.infoCard}>
      <View style={styles.sheetHandle} />
      <View style={styles.infoHeader}>
        <View>
          <Text style={styles.storeName}>{store.name}</Text>
          <Text style={styles.storeDesc}>{store.description}</Text>
        </View>
        <Text style={styles.storeDistance}>
          {typeof store.distance === 'number' ? `${store.distance}m` : '-'}
        </Text>
      </View>
      <View style={styles.storeFooter}>
        <View style={styles.tagPill}>
          <Text style={styles.tagText}>{store.tag}</Text>
        </View>
        <View style={styles.footerActions}>
          <TouchableOpacity onPress={() => onOpenMaps(store)} style={styles.linkButton}>
            <Text style={styles.linkText}>Googleマップで開く</Text>
            <Ionicons name="open-outline" size={16} color={colors.skyDeep} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onOpenDetail(store)} style={styles.detailLink}>
            <Text style={styles.detailLinkText}>詳細</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.skyDeep} />
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
        <Text style={styles.closeText}>閉じる</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: (Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0) + 18,
    paddingBottom: 10,
  },
  headerPill: {
    alignSelf: 'stretch',
    marginLeft: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerText: {
    color: colors.textPrimary,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontSize: 20,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  noticeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(31,135,212,0.9)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 4,
  },
  noticeButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  mapCard: {
    flex: 1,
    marginTop: 12,
    marginBottom: 4,
    marginHorizontal: -8,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 8,
    position: 'relative',
  },
  mapSurface: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  mapView: {
    ...StyleSheet.absoluteFillObject,
  },
  mapOverlay: {
    ...StyleSheet.absoluteFillObject,
    padding: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  mapTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  mapTitleActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  mapCaption: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  mapBottom: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
  },
  loadingBadge: {
    position: 'absolute',
    right: 12,
    bottom: 86,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.glassStrong,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  loadingText: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  mapHint: {
    color: colors.textSecondary,
    fontSize: 12,
    marginBottom: 8,
  },
  mapActions: {
    flexDirection: 'row',
    gap: 8,
  },
  fetchErrorText: {
    marginTop: 8,
    color: '#c0392b',
    fontSize: 12,
    fontWeight: '600',
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionChipLarge: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
  },
  actionChipSmall: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  actionChipPressed: {
    opacity: 0.7,
  },
  actionChipDisabled: {
    opacity: 0.6,
  },
  actionChipText: {
    color: colors.navy,
    fontWeight: '600',
    fontSize: 12,
  },
  actionChipTextLarge: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionChipTextSmall: {
    fontSize: 11,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.2)',
    zIndex: 1,
  },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    zIndex: 10,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  storeDesc: {
    marginTop: 4,
    color: colors.textSecondary,
    fontSize: 13,
  },
  storeDistance: {
    color: colors.skyDeep,
    fontWeight: '700',
    fontSize: 14,
  },
  storeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tagPill: {
    backgroundColor: colors.glassStrong,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tagText: {
    color: colors.skyDeep,
    fontWeight: '700',
    fontSize: 12,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkText: {
    color: colors.skyDeep,
    fontWeight: '700',
    fontSize: 13,
  },
  detailLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.glassStrong,
  },
  detailLinkText: {
    color: colors.skyDeep,
    fontWeight: '700',
    fontSize: 12,
  },
  infoCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
    marginTop: 12,
    minHeight: 180,
  },
  infoCardEmpty: {
    alignItems: 'center',
    gap: 6,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 48,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#d3deea',
    marginBottom: 10,
  },
  infoTitle: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  infoSub: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  closeButton: {
    marginTop: 12,
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  closeText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
});
