import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import colors from '../theme/colors';
import { fetchNotices } from '../api/public';
import AeroBackground from '../components/AeroBackground';

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const yyyy = String(date.getFullYear());
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
}

function stripHtml(value) {
  if (!value) return '';
  return String(value).replace(/<[^>]*>/g, '').trim();
}

export default function NoticesScreen() {
  const navigation = useNavigation();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const loadNotices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchNotices();
      setNotices(data);
    } catch (err) {
      setNotices([]);
      setError(err?.message || 'お知らせの取得に失敗しました。');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNotices();
  }, [loadNotices]);

  return (
    <AeroBackground style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>お知らせ</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color={colors.skyDeep} />
          <Text style={styles.stateText}>読み込み中...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {notices.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>
                {error ? 'お知らせを取得できませんでした。' : 'お知らせはまだありません。'}
              </Text>
              {!!error && <Text style={styles.emptyDesc}>{error}</Text>}
              <TouchableOpacity style={styles.retryButton} onPress={loadNotices}>
                <Text style={styles.retryText}>再読み込み</Text>
              </TouchableOpacity>
            </View>
          ) : (
            notices.map((notice) => {
              const key = String(
                notice.notice_id ?? notice.id ?? notice.title ?? Math.random()
              );
              const startAt = formatDateTime(notice.start_at);
              const endAt = formatDateTime(notice.end_at);
              const bodyRaw = notice.body_html || notice.body_md || '';
              const body = stripHtml(bodyRaw);
              const isExpanded = expandedId === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={styles.card}
                  activeOpacity={0.85}
                  onPress={() => setExpandedId(isExpanded ? null : key)}
                >
                  <Text style={styles.title}>{notice.title || 'お知らせ'}</Text>
                  <Text style={styles.period}>
                    {startAt} ? {endAt}
                  </Text>
                  {!!body && (
                    <Text style={styles.body} numberOfLines={isExpanded ? undefined : 2}>
                      {body}
                    </Text>
                  )}
                  {!!body && (
                    <Text style={styles.moreText}>{isExpanded ? '閉じる' : '続きを読む'}</Text>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </AeroBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
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
  list: {
    paddingBottom: 24,
    gap: 12,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  period: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  body: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  moreText: {
    alignSelf: 'flex-start',
    marginTop: 6,
    color: colors.skyDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stateText: {
    color: colors.textSecondary,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emptyDesc: {
    color: colors.textSecondary,
    textAlign: 'center',
    fontSize: 12,
  },
  retryButton: {
    marginTop: 6,
    backgroundColor: colors.skyDeep,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
  },
});
