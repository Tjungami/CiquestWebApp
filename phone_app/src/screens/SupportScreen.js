import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import AeroBackground from '../components/AeroBackground';
import { submitInquiry } from '../api/inquiries';
import { useDoubleBackPress } from '../hooks/useDoubleBackPress';

const SUBJECT_MAX = 50;
const MESSAGE_MAX = 500;

export default function SupportScreen({ navigation }) {
  const confirmBack = useDoubleBackPress();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert('入力確認', '件名とお問い合わせ内容を入力してください。');
      return;
    }
    try {
      setSending(true);
      await submitInquiry({
        category: subject.trim(),
        message: message.trim(),
      });
      Alert.alert('送信完了', 'お問い合わせを受け付けました。');
      setSubject('');
      setMessage('');
      navigation.goBack();
    } catch (err) {
      Alert.alert('送信エラー', err?.message || '送信に失敗しました。');
    } finally {
      setSending(false);
    }
  };

  const handleBackPress = () => {
    confirmBack(() => navigation.goBack());
  };

  return (
    <AeroBackground style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBackPress}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
          <Text style={styles.backText}>戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>ヘルプ / サポート</Text>
      </View>

      <View style={styles.formCard}>
        <Text style={styles.label}>件名（最大{SUBJECT_MAX}文字）</Text>
        <TextInput
          value={subject}
          onChangeText={setSubject}
          maxLength={SUBJECT_MAX}
          placeholder="例：ログインできない"
          placeholderTextColor={colors.textSecondary}
          style={styles.input}
        />

        <Text style={styles.label}>お問い合わせ内容（最大{MESSAGE_MAX}文字）</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          maxLength={MESSAGE_MAX}
          multiline
          style={[styles.input, styles.textarea]}
          placeholder="お問い合わせ内容を入力してください"
          placeholderTextColor={colors.textSecondary}
        />

        <TouchableOpacity
          style={[styles.submitButton, sending && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={sending}
        >
          <Text style={styles.submitText}>{sending ? '送信中...' : '送信する'}</Text>
        </TouchableOpacity>
      </View>
    </AeroBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 12,
    gap: 6,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
  },
  backText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.textPrimary,
    backgroundColor: colors.glassStrong,
  },
  textarea: {
    minHeight: 140,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: colors.skyDeep,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitText: {
    color: '#fff',
    fontWeight: '700',
  },
});
