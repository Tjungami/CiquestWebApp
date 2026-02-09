import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { registerUser } from '../api/auth';
import AeroBackground from '../components/AeroBackground';

const USERNAME_MAX = 50;
const EMAIL_MAX = 100;
const PASSWORD_MAX = 64;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterScreen({ navigation, route }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState(route?.params?.email ?? '');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validatePassword = (value) => {
    if (value.length < 8) {
      return 'パスワードは8文字以上にしてください。';
    }
    if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) {
      return 'パスワードは英字と数字を含めてください。';
    }
    return '';
  };

  const handleRegister = async () => {
    if (loading) return;
    setError('');
    const trimmedEmail = email.trim();
    const trimmedName = username.trim();
    if (!trimmedName || !trimmedEmail || !password) {
      setError('ユーザー名、メールアドレス、パスワードを入力してください。');
      return;
    }
    if (trimmedName.length > USERNAME_MAX) {
      setError(`ユーザー名は${USERNAME_MAX}文字以内にしてください。`);
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
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== passwordConfirm) {
      setError('パスワードが一致しません。');
      return;
    }
    setLoading(true);
    try {
      await registerUser({ username: trimmedName, email: trimmedEmail, password });
      setPassword('');
      setPasswordConfirm('');
      Alert.alert('登録完了', 'ログイン画面からログインしてください。', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Login', { email: trimmedEmail }),
        },
      ]);
    } catch (err) {
      setError(err?.message || '登録に失敗しました。');
    } finally {
      setLoading(false);
    }
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
        <Text style={styles.headerTitle}>新規登録</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>ユーザー名（最大{USERNAME_MAX}文字）</Text>
        <TextInput
          value={username}
          onChangeText={setUsername}
          placeholder="ユーザー名"
          placeholderTextColor="#8fa0b2"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={USERNAME_MAX}
          style={styles.input}
        />

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
            textContentType="newPassword"
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
        <Text style={styles.helperText}>8文字以上、英字と数字を含めてください。</Text>

        <Text style={styles.label}>パスワード確認（最大{PASSWORD_MAX}文字）</Text>
        <View style={styles.passwordRow}>
          <TextInput
            value={passwordConfirm}
            onChangeText={setPasswordConfirm}
            placeholder="もう一度入力"
            placeholderTextColor="#8fa0b2"
            secureTextEntry={!showPasswordConfirm}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            maxLength={PASSWORD_MAX}
            style={[styles.input, styles.passwordInput]}
          />
          <TouchableOpacity
            style={styles.passwordToggle}
            onPress={() => setShowPasswordConfirm((prev) => !prev)}
            accessibilityLabel="パスワードを表示"
          >
            <Ionicons
              name={showPasswordConfirm ? 'eye-off-outline' : 'eye-outline'}
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity style={styles.primaryButton} onPress={handleRegister} disabled={loading}>
          <Text style={styles.primaryButtonText}>{loading ? '送信中...' : '登録する'}</Text>
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
  },
  passwordRow: {
    position: 'relative',
    justifyContent: 'center',
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
  helperText: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: -2,
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
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
  notice: {
    marginTop: 10,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
});
