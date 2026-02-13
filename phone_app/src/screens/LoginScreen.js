import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Image,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import colors from '../theme/colors';
import { loginUser, loginWithGoogle } from '../api/auth';
import { useAuth } from '../contexts/AuthContext';
import AeroBackground from '../components/AeroBackground';
import { useDoubleBackPress } from '../hooks/useDoubleBackPress';

const EMAIL_MAX = 100;
const PASSWORD_MAX = 64;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GOOGLE_ICON = require('../../assets/android_neutral_sq_SI@2x.png');

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ navigation, route }) {
  const { login } = useAuth();
  const confirmBack = useDoubleBackPress();
  const [email, setEmail] = useState(route?.params?.email ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const googleAuthConfig = Constants.expoConfig?.extra?.googleAuth || {};
  const googleConfigured = Boolean(
    googleAuthConfig.androidClientId ||
      googleAuthConfig.iosClientId ||
      googleAuthConfig.webClientId
  );

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: googleAuthConfig.androidClientId,
    iosClientId: googleAuthConfig.iosClientId,
    webClientId: googleAuthConfig.webClientId,
    scopes: ['profile', 'email'],
  });

  useEffect(() => {
    if (response?.type !== 'success') return;
    const authenticate = async () => {
      const idToken = response?.authentication?.idToken || '';
      const accessToken = response?.authentication?.accessToken || '';
      if (!idToken && !accessToken) {
        setError('Google認証に失敗しました。');
        return;
      }
      setGoogleLoading(true);
      setError('');
      try {
        const data = await loginWithGoogle({ idToken, accessToken });
        const userData = data?.user ?? data ?? null;
        login(userData, { access: data?.access, refresh: data?.refresh });
        navigation.reset({
          index: 0,
          routes: [{ name: 'Tabs' }],
        });
      } catch (err) {
        setError(err?.message || 'Googleログインに失敗しました。');
      } finally {
        setGoogleLoading(false);
      }
    };
    void authenticate();
  }, [login, navigation, response]);

  const handleLogin = async () => {
    if (loading) return;
    setError('');
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('メールアドレスとパスワードを入力してください。');
      return;
    }
    if (trimmedEmail.length > EMAIL_MAX) {
      setError(`メールアドレスは${EMAIL_MAX}文字以内にしてください。`);
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError('メールアドレスの形式が正しくありません。');
      return;
    }
    if (password.length > PASSWORD_MAX) {
      setError(`パスワードは${PASSWORD_MAX}文字以内にしてください。`);
      return;
    }
    setLoading(true);
    try {
      const data = await loginUser({ email: trimmedEmail, password });
      const userData = data?.user ?? data ?? null;
      login(userData, { access: data?.access, refresh: data?.refresh });
      navigation.reset({
        index: 0,
        routes: [{ name: 'Tabs' }],
      });
    } catch (err) {
      setError(err?.message || 'ログインに失敗しました。');
    } finally {
      setLoading(false);
      setPassword('');
    }
  };

  const handleGoogleLogin = async () => {
    if (googleLoading) return;
    setError('');
    if (!googleConfigured) {
      setError('Googleログインの設定が不足しています。');
      return;
    }
    try {
      await promptAsync({ useProxy: Constants.appOwnership === 'expo' });
    } catch (err) {
      setError(err?.message || 'Googleログインに失敗しました。');
    }
  };

  const goToRegister = () => {
    navigation.navigate('Register', { email: email.trim() });
  };

  const handleBackPress = () => {
    confirmBack(() => navigation.goBack());
  };

  return (
    <AeroBackground style={styles.container}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ログイン</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>メールアドレス（最大{EMAIL_MAX}文字）</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="name@example.com"
            placeholderTextColor="#8fa0b2"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            maxLength={EMAIL_MAX}
            style={styles.input}
          />

          <Text style={styles.label}>パスワード（最大{PASSWORD_MAX}文字）</Text>
          <View style={styles.passwordRow}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="パスワードを入力"
              placeholderTextColor="#8fa0b2"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="password"
              maxLength={PASSWORD_MAX}
              style={[styles.input, styles.passwordInput]}
            />
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setShowPassword((prev) => !prev)}
              accessibilityLabel="パスワードを表示"
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {!!error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity style={styles.primaryButton} onPress={handleLogin} disabled={loading}>
            <Text style={styles.primaryButtonText}>
              {loading ? 'ログイン中...' : 'ログイン'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.googleButton,
              (googleLoading || !googleConfigured || !request) && styles.googleButtonDisabled,
            ]}
            onPress={handleGoogleLogin}
            disabled={googleLoading || !googleConfigured || !request}
            accessibilityLabel="Googleでログイン"
          >
            <Image source={GOOGLE_ICON} style={styles.googleIcon} />
            <Text style={styles.googleButtonText}>
              {googleLoading ? 'Googleでログイン中...' : 'Googleでログイン'}
            </Text>
          </TouchableOpacity>

          {!googleConfigured && (
            <Text style={styles.notice}>Googleログインの設定が不足しています。</Text>
          )}

          <TouchableOpacity style={styles.linkButton} onPress={goToRegister}>
            <Text style={styles.linkText}>新規登録はこちら</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </AeroBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 40,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 14,
    elevation: 6,
    gap: 10,
  },
  label: {
    fontWeight: '700',
    color: colors.textSecondary,
    marginTop: 4,
  },
  input: {
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.textPrimary,
    width: '100%',
  },
  passwordRow: {
    position: 'relative',
    justifyContent: 'center',
    width: '100%',
  },
  passwordInput: {
    paddingRight: 44,
  },
  passwordToggle: {
    position: 'absolute',
    right: 12,
    height: '100%',
    justifyContent: 'center',
  },
  errorText: {
    color: '#c0392b',
    fontWeight: '600',
    fontSize: 12,
  },
  primaryButton: {
    marginTop: 8,
    backgroundColor: colors.skyDeep,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 6,
    width: '100%',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
  googleButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  googleButtonText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  linkButton: {
    marginTop: 8,
    alignItems: 'center',
  },
  linkText: {
    color: colors.skyDeep,
    fontWeight: '700',
  },
  notice: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
});
