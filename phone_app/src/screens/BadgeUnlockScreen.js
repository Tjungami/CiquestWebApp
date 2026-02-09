import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import AeroBackground from '../components/AeroBackground';

export default function BadgeUnlockScreen({ navigation, route }) {
  const badges = route?.params?.badges ?? [];
  const title = route?.params?.title || 'バッジ獲得';
  const message = route?.params?.message || '';
  const nextRoute = route?.params?.nextRoute || null;
  const nextParams = route?.params?.nextParams || undefined;

  const handleContinue = () => {
    if (nextRoute) {
      navigation.replace(nextRoute, nextParams);
      return;
    }
    navigation.goBack();
  };

  return (
    <AeroBackground style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="ribbon-outline" size={26} color="#fff" />
        </View>
        <Text style={styles.title}>{title}</Text>
        {!!message && <Text style={styles.message}>{message}</Text>}
        <View style={styles.badgeList}>
          {badges.map((badge) => (
            <View key={badge.id || badge.code || badge.name} style={styles.badgeItem}>
              <Text style={styles.badgeName}>{badge.name}</Text>
              {!!badge.description && (
                <Text style={styles.badgeDesc}>{badge.description}</Text>
              )}
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleContinue}>
        <Text style={styles.primaryText}>続ける</Text>
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
  },
  message: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  badgeList: {
    width: '100%',
    gap: 10,
  },
  badgeItem: {
    backgroundColor: colors.glassStrong,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 4,
  },
  badgeName: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  badgeDesc: {
    color: colors.textSecondary,
    fontSize: 12,
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
