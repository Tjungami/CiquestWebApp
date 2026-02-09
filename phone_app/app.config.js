import 'dotenv/config';

export default {
  expo: {
    name: 'Ciquest',
    slug: 'ciquest-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/icon.png',
      resizeMode: 'contain',
      backgroundColor: '#f2f8ff',
    },
    ios: {
      bundleIdentifier: 'com.junt.ciquestphoneapp',
      supportsTablet: true,
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          'Allow Ciquest to access your location to show it on the map.',
        NFCReaderUsageDescription: 'NFCタグを読み取ってチャレンジを完了します。',
      },
    },
    android: {
      package: 'com.jun_t.ciquest_phone_app',
      adaptiveIcon: {
        foregroundImage: './assets/icon.png',
        backgroundColor: '#ffffff',
      },
      permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'CAMERA', 'NFC'],
      config: {
        googleMaps: {
          apiKey: 'AIzaSyDwvBWw6dXPF5dYmJCuyC8PoFafr_QiaWw',
        },
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    extra: {
      apiBaseUrl: process.env.API_BASE_URL,
      publicApiKey: process.env.PHONE_API_KEY,
      googleMapsWebKey: process.env.GOOGLE_MAPS_JS_API_KEY,
      googleAuth: {
        androidClientId: process.env.GOOGLE_ANDROID_CLIENT_ID,
        iosClientId: process.env.GOOGLE_IOS_CLIENT_ID,
        webClientId: process.env.GOOGLE_WEB_CLIENT_ID,
      },
      eas: {
        projectId: 'd8b7a881-8745-4643-963d-ab57d00cbb9b',
      },
    },
    plugins: ['react-native-nfc-manager', 'expo-secure-store', 'expo-web-browser'],
  },
};
