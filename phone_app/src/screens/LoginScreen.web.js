import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
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

const EMAIL_MAX = 100;
const PASSWORD_MAX = 64;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ navigation, route }) {
  const { login } = useAuth();
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
        setError('Google隱崎ｨｼ縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲�');
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
        setError(err?.message || 'Google繝ｭ繧ｰ繧､繝ｳ縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲�');
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
      setError('繝｡繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ縺ｨ繝代せ繝ｯ繝ｼ繝峨ｒ蜈･蜉帙＠縺ｦ縺上□縺輔＞縲�');
      return;
    }
    if (trimmedEmail.length > EMAIL_MAX) {
      setError(`繝｡繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ縺ｯ${EMAIL_MAX}譁�蟄嶺ｻ･蜀�縺ｫ縺励※縺上□縺輔＞縲Ａ);
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError('繝｡繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ縺ｮ蠖｢蠑上′豁｣縺励￥縺ゅｊ縺ｾ縺帙ｓ縲�');
      return;
    }
    if (password.length > PASSWORD_MAX) {
      setError(`繝代せ繝ｯ繝ｼ繝峨�ｯ${PASSWORD_MAX}譁�蟄嶺ｻ･蜀�縺ｫ縺励※縺上□縺輔＞縲Ａ);
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
      setError(err?.message || '繝ｭ繧ｰ繧､繝ｳ縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲�');
    } finally {
      setLoading(false);
      setPassword('');
    }
  };

  const handleGoogleLogin = async () => {
    if (googleLoading) return;
    setError('');
    if (!googleConfigured) {
      setError('Google繝ｭ繧ｰ繧､繝ｳ縺ｮ險ｭ螳壹′荳崎ｶｳ縺励※縺�縺ｾ縺吶�');
      return;
    }
    try {
      await promptAsync({ useProxy: Constants.appOwnership === 'expo' });
    } catch (err) {
      setError(err?.message || 'Google繝ｭ繧ｰ繧､繝ｳ縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲�');
    }
  };

  const goToRegister = () => {
    navigation.navigate('Register', { email: email.trim() });
  };

  return (
    <AeroBackground style={styles.container}>
      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>繝ｭ繧ｰ繧､繝ｳ</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>繝｡繝ｼ繝ｫ繧｢繝峨Ξ繧ｹ�ｼ域怙螟ｧ{EMAIL_MAX}譁�蟄暦ｼ�</Text>
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

          <Text style={styles.label}>繝代せ繝ｯ繝ｼ繝会ｼ域怙螟ｧ{PASSWORD_MAX}譁�蟄暦ｼ�</Text>
          <View style={styles.passwordRow}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="繝代せ繝ｯ繝ｼ繝峨ｒ蜈･蜉�"
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
              accessibilityLabel="繝代せ繝ｯ繝ｼ繝峨ｒ陦ｨ遉ｺ"
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
              {loading ? '繝ｭ繧ｰ繧､繝ｳ荳ｭ...' : '繝ｭ繧ｰ繧､繝ｳ'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.googleButton,
              (googleLoading || !googleConfigured || !request) && styles.googleButtonDisabled,
            ]}
            onPress={handleGoogleLogin}
            disabled={googleLoading || !googleConfigured || !request}
            accessibilityLabel="Google縺ｧ繝ｭ繧ｰ繧､繝ｳ"
          >
            <Ionicons name="logo-google" size={18} color={colors.textPrimary} />
            <Text style={styles.googleButtonText}>
              {googleLoading ? 'Google縺ｧ繝ｭ繧ｰ繧､繝ｳ荳ｭ...' : 'Google縺ｧ繝ｭ繧ｰ繧､繝ｳ'}
            </Text>
          </TouchableOpacity>

          {!googleConfigured && (
            <Text style={styles.notice}>Google繝ｭ繧ｰ繧､繝ｳ縺ｮ險ｭ螳壹′荳崎ｶｳ縺励※縺�縺ｾ縺吶�</Text>
          )}

          <TouchableOpacity style={styles.linkButton} onPress={goToRegister}>
            <Text style={styles.linkText}>譁ｰ隕冗匳骭ｲ縺ｯ縺薙■繧�</Text>
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
