import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import colors from '../theme/colors';
import { fetchStores } from '../api/public';
import AeroBackground from '../components/AeroBackground';

const mapStyle = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', elementType: 'all', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.attraction', elementType: 'all', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.government', elementType: 'all', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.medical', elementType: 'all', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.place_of_worship', elementType: 'all', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.school', elementType: 'all', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.sports_complex', elementType: 'all', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit.station', elementType: 'labels', stylers: [{ visibility: 'off' }] },
];

const defaultRegion = {
  latitude: 36.5551,
  longitude: 139.8828,
};

let googleMapsPromise = null;

const loadGoogleMaps = (apiKey) => {
  if (!apiKey || typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps APIキーが設定されていません。'));
  }
  if (window.google && window.google.maps) {
    return Promise.resolve(window.google.maps);
  }
  if (googleMapsPromise) return googleMapsPromise;
  googleMapsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google && window.google.maps) {
        resolve(window.google.maps);
      } else {
        reject(new Error('Google Maps の読み込みに失敗しました。'));
      }
    };
    script.onerror = () => reject(new Error('Google Maps の読み込みに失敗しました。'));
    document.head.appendChild(script);
  });
  return googleMapsPromise;
};

const computeDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 1000;
};

export default function HomeScreen() {
  const navigation = useNavigation();
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const [stores, setStores] = useState([]);
  const [fetchError, setFetchError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [isLocating, setIsLocating] = useState(false);
  const [lastLocation, setLastLocation] = useState(null);
  const [selected, setSelected] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  const mapsApiKey =
    Constants.expoConfig?.extra?.googleMapsWebKey ||
    Constants.expoConfig?.extra?.googleMapsWebApiKey ||
    '';

  const normalizedStores = useMemo(() => {
    const parseCoord = (value) => {
      if (typeof value === 'number') return Number.isFinite(value) ? value : null;
      if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    };
    return stores.map((store) => ({
      ...store,
      lat: parseCoord(store.lat ?? store.latitude),
      lon: parseCoord(store.lon ?? store.longitude),
    }));
  }, [stores]);

  const selectStore = (store) => {
    setSelected(store);
  };

  const closeSheet = () => {
    setSelected(null);
  };

  const updateDistances = (position) => {
    if (!position) return;
    setStores((prev) =>
      prev.map((store) => {
        const lat = store.lat ?? store.latitude;
        const lon = store.lon ?? store.longitude;
        if (typeof lat !== 'number' || typeof lon !== 'number') return store;
        return {
          ...store,
          distance: Math.round(
            computeDistanceMeters(position.coords.latitude, position.coords.longitude, lat, lon)
          ),
        };
      })
    );
  };

  const ensurePermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
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
    const ok = await ensurePermission();
    if (!ok) return;
    try {
      setIsLocating(true);
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setLastLocation(current);
      setLocationError('');
      updateDistances(current);
      if (mapInstance.current) {
        mapInstance.current.setCenter({
          lat: current.coords.latitude,
          lng: current.coords.longitude,
        });
        mapInstance.current.setZoom(14);
      }
    } catch (error) {
      setLocationError(error?.message || '位置情報を取得できませんでした。');
    } finally {
      setIsLocating(false);
    }
  };

  useEffect(() => {
    let active = true;
    const loadStores = async () => {
      try {
        const data = await fetchStores();
        if (!active) return;
        const normalized = data.map((store) => {
          const tags = Array.isArray(store.tags) ? store.tags : [];
          return {
            id: String(store.id ?? store.store_id ?? store.pk ?? store.name ?? Math.random()),
            name: store.name || '',
            description: store.description || '',
            lat: store.lat ?? store.latitude,
            lon: store.lon ?? store.longitude,
            distance:
              typeof store.distance === 'number' ? Math.round(store.distance * 1000) : undefined,
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

  useEffect(() => {
    let active = true;
    if (!mapRef.current) return undefined;
    loadGoogleMaps(mapsApiKey)
      .then((maps) => {
        if (!active || !mapRef.current) return;
        mapInstance.current = new maps.Map(mapRef.current, {
          center: { lat: defaultRegion.latitude, lng: defaultRegion.longitude },
          zoom: 13,
          styles: mapStyle,
          mapTypeControl: false,
          fullscreenControl: false,
          streetViewControl: false,
        });
        setMapReady(true);
      })
      .catch((err) => {
        setFetchError(err?.message || '地図の読み込みに失敗しました。');
      });
    return () => {
      active = false;
    };
  }, [mapsApiKey]);

  useEffect(() => {
    if (!mapReady || !mapInstance.current || !normalizedStores.length) return;
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    normalizedStores
      .filter((store) => typeof store.lat === 'number' && typeof store.lon === 'number')
      .forEach((store) => {
        const marker = new window.google.maps.Marker({
          map: mapInstance.current,
          position: { lat: store.lat, lng: store.lon },
          title: store.name,
        });
        marker.addListener('click', () => selectStore(store));
        markersRef.current.push(marker);
      });
  }, [mapReady, normalizedStores]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      updateLocation();
    }, 30000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!lastLocation || !mapInstance.current) return;
    mapInstance.current.setCenter({
      lat: lastLocation.coords.latitude,
      lng: lastLocation.coords.longitude,
    });
  }, [lastLocation]);

  return (
    <AeroBackground style={styles.container}>
      <View style={styles.headerPill}>
        <View style={styles.headerLeft}>
          <Image source={require('../../assets/icon.png')} style={styles.headerIcon} />
          <Text style={styles.headerText}>Ciquest</Text>
        </View>
        <TouchableOpacity
          style={styles.noticeButton}
          onPress={() => navigation.navigate('Notices')}
        >
          <Ionicons name="notifications-outline" size={16} color="#ffffff" />
          <Text style={styles.noticeButtonText}>お知らせ</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mapCard}>
        <View style={styles.mapSurface} ref={mapRef} />
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
              <TouchableOpacity style={styles.actionChip} onPress={updateLocation}>
                <Ionicons name="compass-outline" size={20} color={colors.navy} />
                <Text style={styles.actionChipTextLarge}>現在地に移動</Text>
              </TouchableOpacity>
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

        {selected && (
          <TouchableOpacity style={styles.overlay} onPress={closeSheet} />
        )}

        <View style={[styles.sheetContainer, selected && styles.sheetContainerActive]}>
          <View style={styles.infoCard}>
            <View style={styles.sheetHandle} />
            {!selected ? (
              <>
                <Text style={styles.infoTitle}>ピンをタップすると店舗情報が表示されます。</Text>
                <Text style={styles.infoSub}>Web版ではGoogle Mapsを利用しています。</Text>
              </>
            ) : (
              <>
                <View style={styles.infoHeader}>
                  <View>
                    <Text style={styles.storeName}>{selected.name}</Text>
                    <Text style={styles.storeDesc}>{selected.description}</Text>
                  </View>
                  <Text style={styles.storeDistance}>
                    {typeof selected.distance === 'number' ? `${selected.distance}m` : '-'}
                  </Text>
                </View>
                <View style={styles.storeFooter}>
                  <View style={styles.tagPill}>
                    <Text style={styles.tagText}>{selected.tag}</Text>
                  </View>
                  <View style={styles.footerActions}>
                    <TouchableOpacity
                      onPress={() =>
                        window.open(
                          `https://www.google.com/maps?q=${selected.lat},${selected.lon}`,
                          '_blank'
                        )
                      }
                      style={styles.linkButton}
                    >
                      <Text style={styles.linkText}>Googleマップで開く</Text>
                      <Ionicons name="open-outline" size={16} color={colors.skyDeep} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => navigation.navigate('StoreDetail', { store: selected })}
                      style={styles.detailLink}
                    >
                      <Text style={styles.detailLinkText}>詳細</Text>
                      <Ionicons name="chevron-forward" size={16} color={colors.skyDeep} />
                    </TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={closeSheet}>
                  <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                  <Text style={styles.closeText}>閉じる</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </AeroBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 8,
    paddingTop: 18,
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
    backgroundColor: colors.glassStrong,
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionChipTextLarge: {
    color: colors.navy,
    fontWeight: '700',
    fontSize: 14,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  sheetContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    paddingBottom: 12,
    transform: [{ translateY: 260 }],
  },
  sheetContainerActive: {
    transform: [{ translateY: 0 }],
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
    textAlign: 'center',
  },
  infoSub: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
