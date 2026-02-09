import React from 'react';
import { Platform, StatusBar, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import colors from '../theme/colors';

export default function AeroBackground({ children, style }) {
  return (
    <LinearGradient colors={[colors.aeroTop, colors.aeroMid, colors.aeroBottom]} style={[styles.base, style]}>
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.bubbleOne} />
      <View pointerEvents="none" style={styles.bubbleTwo} />
      <View pointerEvents="none" style={styles.horizon} />
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  base: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 8 : 12,
  },
  glowTop: {
    position: 'absolute',
    top: -90,
    left: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: colors.glow,
    opacity: 0.7,
  },
  bubbleOne: {
    position: 'absolute',
    top: 140,
    right: -60,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.28)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  bubbleTwo: {
    position: 'absolute',
    bottom: 140,
    left: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  horizon: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 170,
    height: 120,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});
