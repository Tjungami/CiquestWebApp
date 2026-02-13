import 'react-native-gesture-handler';
import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { MaterialTopTabBar, createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { Alert, BackHandler, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { AuthProvider } from './src/contexts/AuthContext';
import { ChallengeProvider } from './src/contexts/ChallengeContext';
import HomeScreen from './src/screens/HomeScreen';
import SearchScreen from './src/screens/SearchScreen';
import ScanScreen from './src/screens/ScanScreen';
import FullScanScreen from './src/screens/FullScanScreen';
import CouponsScreen from './src/screens/CouponsScreen';
import MyPageScreen from './src/screens/MyPageScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import NoticesScreen from './src/screens/NoticesScreen';
import StoreDetailScreen from './src/screens/StoreDetailScreen';
import QuestClearScreen from './src/screens/QuestClearScreen';
import QuestClearProcessingScreen from './src/screens/QuestClearProcessingScreen';
import RankUpScreen from './src/screens/RankUpScreen';
import BadgeUnlockScreen from './src/screens/BadgeUnlockScreen';
import CouponUseScanScreen from './src/screens/CouponUseScanScreen';
import StampScanScreen from './src/screens/StampScanScreen';
import StampRewardScreen from './src/screens/StampRewardScreen';
import StampCooldownScreen from './src/screens/StampCooldownScreen';
import TermsScreen from './src/screens/TermsScreen';
import SupportScreen from './src/screens/SupportScreen';
import LocationRequiredScreen from './src/screens/LocationRequiredScreen';
import colors from './src/theme/colors';

enableScreens();

const Tab = createMaterialTopTabNavigator();
const Stack = createNativeStackNavigator();
const TERMS_STORAGE_KEY = 'ciquest_terms_accepted_v1';

function SafeTabBar(props) {
  const insets = useSafeAreaInsets();
  return (
    <MaterialTopTabBar
      {...props}
      style={[
        props.style,
        {
          height: 60 + insets.bottom,
          paddingBottom: Math.max(8, insets.bottom),
          paddingTop: 8,
          backgroundColor: 'rgba(255,255,255,0.78)',
          borderTopColor: colors.border,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.2,
          shadowRadius: 12,
          elevation: 12,
        },
      ]}
    />
  );
}

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: 'transparent',
    primary: colors.skyDeep,
    text: colors.textPrimary,
    border: colors.border,
    card: colors.glassStrong,
  },
};

function Tabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <SafeTabBar {...props} />}
      tabBarPosition="bottom"
      screenOptions={({ route }) => ({
        headerShown: false,
        swipeEnabled: false,
        animationEnabled: true,
        tabBarActiveTintColor: colors.skyDeep,
        tabBarInactiveTintColor: '#7f8fa3',
        tabBarStyle: {},
        tabBarIndicatorStyle: { backgroundColor: 'transparent' },
        tabBarShowIcon: true,
        tabBarIcon: ({ color, size }) => {
          const iconMap = {
            Home: 'home-outline',
            Search: 'search-outline',
            Scan: 'qr-code-outline',
            Coupons: 'ticket-outline',
            MyPage: 'person-outline',
          };
          return <Ionicons name={iconMap[route.name]} size={size} color={color} />;
        },
        tabBarLabelStyle: {
          fontWeight: '700',
          fontSize: 12,
          letterSpacing: 0.2,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'ホーム' }} />
      <Tab.Screen name="Search" component={SearchScreen} options={{ title: '検索' }} />
      <Tab.Screen name="Scan" component={ScanScreen} options={{ title: 'スキャン' }} />
      <Tab.Screen name="Coupons" component={CouponsScreen} options={{ title: 'クーポン' }} />
      <Tab.Screen name="MyPage" component={MyPageScreen} options={{ title: 'マイページ' }} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [termsAccepted, setTermsAccepted] = useState(null);
  const [locationStatus, setLocationStatus] = useState(null);
  const [locationChecked, setLocationChecked] = useState(false);
  const navigationRef = useRef(null);
  const webBackPressedAtRef = useRef(0);
  const androidBackPressedAtRef = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const warning =
      'もう一度押すと前の画面に戻ります。';

    const handlePopState = (event) => {
      const now = Date.now();
      if (now - webBackPressedAtRef.current <= 1800) {
        webBackPressedAtRef.current = 0;
        return;
      }
      event.preventDefault();
      window.history.pushState(null, '', window.location.href);
      webBackPressedAtRef.current = now;
      window.alert(warning);
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const handleHardwareBackPress = () => {
      const navigation = navigationRef.current;
      if (!navigation || !navigation.canGoBack()) {
        return false;
      }
      const now = Date.now();
      if (now - androidBackPressedAtRef.current <= 1800) {
        androidBackPressedAtRef.current = 0;
        navigation.goBack();
        return true;
      }
      androidBackPressedAtRef.current = now;
      Alert.alert('確認', 'もう一度押すと前の画面に戻ります。');
      return true;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      handleHardwareBackPress
    );
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadTerms = async () => {
      try {
        const stored = await SecureStore.getItemAsync(TERMS_STORAGE_KEY);
        if (!mounted) return;
        setTermsAccepted(stored === 'true');
      } catch (err) {
        if (mounted) setTermsAccepted(false);
      }
    };
    void loadTerms();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!termsAccepted) {
      setLocationStatus(null);
      setLocationChecked(false);
      return;
    }
    let mounted = true;
    const checkLocationPermission = async () => {
      try {
        const result = await Location.getForegroundPermissionsAsync();
        if (!mounted) return;
        setLocationStatus(result?.status || 'undetermined');
      } catch (err) {
        if (mounted) setLocationStatus('denied');
      } finally {
        if (mounted) setLocationChecked(true);
      }
    };
    void checkLocationPermission();
    return () => {
      mounted = false;
    };
  }, [termsAccepted]);

  const handleAcceptTerms = async () => {
    try {
      await SecureStore.setItemAsync(TERMS_STORAGE_KEY, 'true');
    } catch (err) {
      // Ignore storage errors to avoid blocking entry.
    }
    setTermsAccepted(true);
  };

  const handleRequestLocation = async () => {
    try {
      const result = await Location.requestForegroundPermissionsAsync();
      setLocationStatus(result?.status || 'undetermined');
      setLocationChecked(true);
    } catch (err) {
      setLocationStatus('denied');
      setLocationChecked(true);
    }
  };

  if (termsAccepted === null) {
    return null;
  }

  if (!termsAccepted) {
    return <TermsScreen onAccept={handleAcceptTerms} />;
  }

  if (!locationChecked || locationStatus === null) {
    return null;
  }

  if (locationStatus !== 'granted') {
    return (
      <LocationRequiredScreen
        status={locationStatus}
        onRequestPermission={handleRequestLocation}
      />
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ChallengeProvider>
          <NavigationContainer ref={navigationRef} theme={navTheme}>
            <StatusBar style="dark" />
            <Stack.Navigator
              screenOptions={{
                headerShown: false,
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="Tabs" component={Tabs} />
              <Stack.Screen name="FullScan" component={FullScanScreen} />
              <Stack.Screen name="StoreDetail" component={StoreDetailScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
              <Stack.Screen name="Notices" component={NoticesScreen} />
              <Stack.Screen name="QuestClear" component={QuestClearScreen} />
              <Stack.Screen
                name="QuestClearProcessing"
                component={QuestClearProcessingScreen}
              />
              <Stack.Screen name="BadgeUnlock" component={BadgeUnlockScreen} />
              <Stack.Screen name="RankUp" component={RankUpScreen} />
              <Stack.Screen name="CouponUseScan" component={CouponUseScanScreen} />
              <Stack.Screen name="StampScan" component={StampScanScreen} />
              <Stack.Screen name="StampReward" component={StampRewardScreen} />
              <Stack.Screen name="StampCooldown" component={StampCooldownScreen} />
              <Stack.Screen name="Support" component={SupportScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </ChallengeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
