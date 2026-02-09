import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';
import { userProfile } from '../data/mockData';
import LockedOverlay from '../components/LockedOverlay';
import { useAuth } from '../contexts/AuthContext';
import { useChallenges } from '../contexts/ChallengeContext';
import AeroBackground from '../components/AeroBackground';
import { fetchUserBadges } from '../api/badges';

export default function MyPageScreen() {
  const { loggedIn, logout, user } = useAuth();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const [logoutChecked, setLogoutChecked] = useState(false);
  const [badges, setBadges] = useState([]);
  const isFocused = useIsFocused();
  const { clearedChallenges } = useChallenges();
  const navigation = useNavigation();

  const openLogoutModal = () => {
    setLogoutChecked(false);
    setLogoutModalOpen(true);
  };

  const closeLogoutModal = () => {
    setLogoutModalOpen(false);
  };

  const confirmLogout = () => {
    if (!logoutChecked) return;
    setLogoutModalOpen(false);
    logout();
  };

  useEffect(() => {
    if (!loggedIn || !isFocused) return;
    let mounted = true;
    const load = async () => {
      try {
        const data = await fetchUserBadges();
        if (mounted && Array.isArray(data)) {
          setBadges(data);
        }
      } catch (err) {
        if (mounted) {
          setBadges([]);
        }
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, [loggedIn, isFocused]);

  const profile = {
    name: user?.username || user?.name || user?.email || userProfile.name,
    rank: user?.rank?.name || user?.rank || userProfile.rank || 'ブロンズ',
    points: typeof user?.points === 'number' ? user.points : userProfile.points ?? 0,
    badges: badges,
  };

  if (!loggedIn) {
    return (
      <LockedOverlay
        title="ログインが必要です"
        description="マイページを表示するにはログインしてください。"
        onLogin={() => navigation.navigate('Login')}
      />
    );
  }

  return (
    <AeroBackground style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>🎯</Text>
          </View>
          <Text style={styles.userName}>{profile.name}</Text>
          <Text style={styles.userRank}>
            ランク: <Text style={styles.rankValue}>{profile.rank}</Text>
          </Text>
          <Text style={styles.userPoints}>
            ポイント: <Text style={styles.pointsValue}>{profile.points}</Text> pt
          </Text>
        </View>

        <View style={styles.badgeSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>バッジ</Text>
            <Text style={styles.sectionNote}>獲得済みのみ表示</Text>
          </View>
          {profile.badges.length === 0 ? (
            <Text style={styles.badgeEmpty}>まだバッジがありません</Text>
          ) : (
            <View style={styles.badgeList}>
              {profile.badges.map((badge) => (
                <View key={badge.id || badge.code || badge.name} style={styles.badge}>
                  <Text style={styles.badgeTitle}>{badge.name}</Text>
                  {!!badge.description && (
                    <Text style={styles.badgeDesc}>{badge.description}</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.historySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>クリア履歴</Text>
            <Text style={styles.sectionNote}>最新順</Text>
          </View>
          {clearedChallenges.length === 0 ? (
            <Text style={styles.historyEmpty}>クリア履歴がまだありません。</Text>
          ) : (
            <View style={styles.historyList}>
              {clearedChallenges.map((challenge) => (
                <View key={challenge.id} style={styles.historyCard}>
                  <Text style={styles.historyName}>{challenge.title}</Text>
                  {!!challenge.storeName && (
                    <Text style={styles.historyMeta}>{challenge.storeName}</Text>
                  )}
                  {!!challenge.clearedAt && (
                    <Text style={styles.historyDate}>{formatDate(challenge.clearedAt)}</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.settingsSection}>
          <Text style={styles.sectionTitle}>設定</Text>
          <View style={styles.settingsList}>
            <SettingsButton
              label="ログアウト"
              icon="log-out-outline"
              onPress={openLogoutModal}
            />
            <SettingsButton
              label="ヘルプ / サポート"
              icon="help-circle-outline"
              onPress={() => navigation.navigate('Support')}
            />
          </View>
        </View>
      </ScrollView>

      <Modal
        transparent
        visible={logoutModalOpen}
        animationType="fade"
        onRequestClose={closeLogoutModal}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>ログアウトの確認</Text>
            <Text style={styles.modalText}>
              ログアウトすると再ログインが必要になります。
            </Text>
            <TouchableOpacity
              style={styles.modalCheckRow}
              onPress={() => setLogoutChecked((prev) => !prev)}
            >
              <Ionicons
                name={logoutChecked ? 'checkbox-outline' : 'square-outline'}
                size={22}
                color={colors.skyDeep}
              />
              <Text style={styles.modalCheckText}>確認しました</Text>
            </TouchableOpacity>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalGhost} onPress={closeLogoutModal}>
                <Text style={styles.modalGhostText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimary, !logoutChecked && styles.modalPrimaryDisabled]}
                onPress={confirmLogout}
                disabled={!logoutChecked}
              >
                <Text style={styles.modalPrimaryText}>ログアウト</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AeroBackground>
  );
}

function SettingsButton({ label, icon, onPress }) {
  return (
    <TouchableOpacity style={styles.settingsBtn} onPress={onPress}>
      <View style={styles.settingsBtnLeft}>
        <Ionicons name={icon} size={18} color={colors.skyDeep} />
        <Text style={styles.settingsBtnText}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  content: {
    paddingBottom: 28,
  },
  profileCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    alignItems: 'center',
    paddingVertical: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  avatarText: {
    fontSize: 32,
  },
  userName: {
    fontWeight: '800',
    color: colors.textPrimary,
    fontSize: 18,
  },
  userRank: {
    color: colors.textSecondary,
  },
  rankValue: {
    color: colors.skyDeep,
    fontWeight: '700',
  },
  userPoints: {
    color: colors.textSecondary,
  },
  pointsValue: {
    color: colors.skyDeep,
    fontWeight: '700',
  },
  badgeSection: {
    marginTop: 18,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    fontSize: 16,
  },
  sectionNote: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  badgeList: {
    marginTop: 12,
    gap: 10,
  },
  badge: {
    backgroundColor: colors.glassStrong,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 4,
  },
  badgeTitle: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  badgeDesc: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  badgeEmpty: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 12,
  },
  historySection: {
    marginTop: 18,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
    gap: 10,
  },
  historyEmpty: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  historyList: {
    gap: 10,
  },
  historyCard: {
    backgroundColor: colors.glassStrong,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  historyName: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  historyMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  historyDate: {
    color: colors.skyDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  settingsSection: {
    marginTop: 18,
    gap: 10,
  },
  settingsList: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 4,
    overflow: 'hidden',
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingsBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  settingsBtnText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(12,45,68,0.12)',
    gap: 10,
    shadowColor: colors.shadow,
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalText: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 20,
  },
  modalCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalCheckText: {
    color: colors.textPrimary,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalGhost: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalGhostText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  modalPrimary: {
    flex: 1,
    backgroundColor: colors.skyDeep,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalPrimaryDisabled: {
    opacity: 0.5,
  },
  modalPrimaryText: {
    color: '#fff',
    fontWeight: '700',
  },
});
