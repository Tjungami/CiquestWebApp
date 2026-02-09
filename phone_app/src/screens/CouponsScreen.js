import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import colors from '../theme/colors';
import { fetchCoupons } from '../api/public';
import { fetchUserCouponHistory, useCoupon } from '../api/coupons';
import LockedOverlay from '../components/LockedOverlay';
import { useAuth } from '../contexts/AuthContext';
import AeroBackground from '../components/AeroBackground';

export default function CouponsScreen({ navigation, route }) {
  const {
    loggedIn,
    user,
    userCoupons,
    markUserCouponUsed,
    addUserCouponHistory,
    setUserCouponHistory,
    userCouponHistory,
    addStoreCouponHistory,
  } = useAuth();
  const [state, setState] = useState({ points: 0, owned: [], exchangeable: [] });
  const [fetchError, setFetchError] = useState('');
  const [confirmCoupon, setConfirmCoupon] = useState(null);
  const [confirmStoreQr, setConfirmStoreQr] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [pendingCouponId, setPendingCouponId] = useState(null);
  const [pendingStoreQr, setPendingStoreQr] = useState('');

  const handleExchange = (coupon) => {
    if (state.points < coupon.cost) {
      alert('ポイントが足りません');
      return;
    }
    alert(`${coupon.title} を交換しました（ダミー）`);
    setState((prev) => ({
      ...prev,
      points: prev.points - coupon.cost,
      owned: [...prev.owned, { ...coupon, used: false }],
    }));
  };

  const handleStartUse = (coupon) => {
    const couponId = coupon.id ?? coupon.coupon_id ?? null;
    if (!couponId) {
      setConfirmError('クーポン情報が不足しています。');
      return;
    }
    navigation.navigate('CouponUseScan', { couponId });
  };

  const handleConfirmUse = async () => {
    if (!confirmCoupon || !confirmStoreQr || confirmLoading || confirmError) return;
    setConfirmLoading(true);
    setConfirmError('');
    try {
      const response = await useCoupon({
        coupon_id: confirmCoupon.id,
        store_qr: confirmStoreQr,
      });
      markUserCouponUsed(confirmCoupon.id);
      addUserCouponHistory({
        couponId: response.coupon_id,
        couponTitle: response.coupon_title,
        storeId: response.store_id,
        storeName: response.store_name,
        usedAt: response.used_at,
        couponType: response.coupon_type,
      });
      addStoreCouponHistory({
        couponId: response.coupon_id,
        couponTitle: response.coupon_title,
        storeId: response.store_id,
        storeName: response.store_name,
        usedAt: response.used_at,
        couponType: response.coupon_type,
      });
      setConfirmCoupon(null);
      setConfirmStoreQr('');
    } catch (err) {
      setConfirmError(err?.message || 'クーポンの使用に失敗しました。');
    } finally {
      setConfirmLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const loadCoupons = async () => {
      try {
        const data = await fetchCoupons();
        if (!active) return;
        const exchangeable = data.map((coupon) => ({
          id: String(coupon.coupon_id ?? coupon.id ?? coupon.title ?? Math.random()),
          title: coupon.title || '',
          desc: coupon.description || '',
          cost: typeof coupon.required_points === 'number' ? coupon.required_points : 0,
        }));
        setState((prev) => ({
          ...prev,
          exchangeable,
        }));
        setFetchError('');
      } catch (error) {
        if (!active) return;
        setFetchError(error?.message || 'APIの取得に失敗しました。');
      }
    };

    loadCoupons();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setState((prev) => ({
      ...prev,
      points: typeof user?.points === 'number' ? user.points : prev.points,
      owned: Array.isArray(userCoupons) ? userCoupons : prev.owned,
    }));
  }, [user?.points, userCoupons]);

  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      if (!loggedIn) return;
      try {
        const history = await fetchUserCouponHistory();
        if (!active) return;
        setUserCouponHistory(history);
      } catch (err) {
        return;
      }
    };
    loadHistory();
    return () => {
      active = false;
    };
  }, [loggedIn, setUserCouponHistory]);

  useEffect(() => {
    const couponId = route?.params?.couponId;
    const storeQr = (route?.params?.storeQr || '').trim();
    if (!couponId || !storeQr) return;
    setPendingCouponId(String(couponId));
    setPendingStoreQr(storeQr);
    navigation.setParams({ couponId: undefined, storeQr: undefined });
  }, [navigation, route?.params?.couponId, route?.params?.storeQr, state.owned]);

  useEffect(() => {
    if (!pendingCouponId || !pendingStoreQr) return;
    const ownedCoupon = state.owned.find((coupon) => {
      const ownedId = coupon.id ?? coupon.coupon_id ?? '';
      return String(ownedId) === String(pendingCouponId);
    });
    if (ownedCoupon) {
      setConfirmCoupon(ownedCoupon);
      setConfirmStoreQr(pendingStoreQr);
      setConfirmError('');
      setPendingCouponId(null);
      setPendingStoreQr('');
      return;
    }
    setConfirmCoupon({ id: String(pendingCouponId), title: 'クーポン' });
    setConfirmStoreQr(pendingStoreQr);
    setConfirmError('所持していないクーポンです。');
  }, [pendingCouponId, pendingStoreQr, state.owned]);

  if (!loggedIn) {
    return (
      <LockedOverlay
        title="ログインが必要です"
        description="クーポンを見る・交換するにはログインしてください。"
        onLogin={() => navigation.navigate('Login')}
      />
    );
  }

  return (
    <AeroBackground style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.pointBox}>
          <Text style={styles.pointLabel}>保有ポイント</Text>
          <Text style={styles.pointValue}>{state.points} pt</Text>
        </View>
        {!!fetchError && <Text style={styles.errorText}>{fetchError}</Text>}

        <Section title="所持クーポン">
          {state.owned.map((c) => (
            <CouponItem
              key={c.id}
              coupon={c}
              cta={c.used ? '使用済み' : '使う'}
              disabled={c.used}
              onPress={() => handleStartUse(c)}
            />
          ))}
        </Section>

        <Section title="交換できるクーポン">
          {state.exchangeable.map((c) => (
            <CouponItem
              key={c.id}
              coupon={c}
              cta={`${c.cost} ptで交換`}
              onPress={() => handleExchange(c)}
            />
          ))}
        </Section>

        <Section title="使用履歴">
          {Array.isArray(userCouponHistory) && userCouponHistory.length > 0 ? (
            userCouponHistory.map((entry, idx) => (
              <HistoryItem
                key={`${entry.coupon_id ?? entry.couponId ?? 'history'}-${idx}`}
                title={entry.coupon_title || entry.couponTitle || ''}
                storeName={entry.store_name || entry.storeName || ''}
                usedAt={entry.used_at || entry.usedAt || ''}
                couponType={entry.coupon_type || entry.couponType || ''}
              />
            ))
          ) : (
            <Text style={styles.emptyHistory}>使用履歴はまだありません。</Text>
          )}
        </Section>
      </ScrollView>
      <Modal
        transparent
        visible={!!confirmCoupon}
        animationType="fade"
        onRequestClose={() => setConfirmCoupon(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>クーポンを使用しますか？</Text>
            {!!confirmCoupon && (
              <Text style={styles.modalBody}>
                {confirmCoupon.title}を使用します。
              </Text>
            )}
            <Text style={styles.modalWarning}>店舗のQRコードでのみ使用できます。</Text>
            {!!confirmError && <Text style={styles.modalError}>{confirmError}</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => {
                  setConfirmCoupon(null);
                  setConfirmError('');
                  setConfirmStoreQr('');
                }}
                disabled={confirmLoading}
              >
                <Text style={styles.modalCancelText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={handleConfirmUse}
                disabled={confirmLoading || !!confirmError}
              >
                <Text style={styles.modalConfirmText}>
                  {confirmLoading ? '処理中...' : '使用する'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </AeroBackground>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function CouponItem({ coupon, cta, onPress, disabled }) {
  return (
    <View style={styles.couponItem}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.couponTitle}>{coupon.title}</Text>
        <Text style={styles.couponDesc}>{coupon.desc}</Text>
      </View>
      <TouchableOpacity
        style={[styles.couponBtn, disabled && styles.couponBtnDisabled]}
        onPress={onPress}
        disabled={disabled}
      >
        <Text style={[styles.couponBtnText, disabled && styles.couponBtnTextDisabled]}>{cta}</Text>
      </TouchableOpacity>
    </View>
  );
}

function formatCouponType(value) {
  if (value === 'store_specific') return '店舗独自';
  if (value === 'common') return '共通';
  return value || '';
}

function HistoryItem({ title, storeName, usedAt, couponType }) {
  return (
    <View style={styles.historyItem}>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.historyTitle}>{title}</Text>
        <Text style={styles.historyMeta}>
          {storeName} {formatCouponType(couponType)}
        </Text>
      </View>
      {!!usedAt && <Text style={styles.historyDate}>{usedAt.slice(0, 10)}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  content: {
    paddingBottom: 32,
  },
  pointBox: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  pointLabel: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  pointValue: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: '800',
    color: colors.skyDeep,
  },
  errorText: {
    marginTop: 10,
    color: '#c0392b',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    marginTop: 18,
    gap: 10,
  },
  sectionTitle: {
    fontWeight: '800',
    color: colors.textPrimary,
    fontSize: 16,
  },
  sectionBody: {
    gap: 10,
  },
  couponItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  couponTitle: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  couponDesc: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  couponBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.skyDeep,
  },
  couponBtnDisabled: {
    backgroundColor: '#d4dce7',
  },
  couponBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  couponBtnTextDisabled: {
    color: '#7f8fa3',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  historyTitle: {
    fontWeight: '700',
    color: colors.textPrimary,
  },
  historyMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  historyDate: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyHistory: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(12,45,68,0.12)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.28,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 12,
    elevation: 8,
    gap: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  modalBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  modalWarning: {
    color: '#c0392b',
    fontSize: 12,
    fontWeight: '700',
  },
  modalError: {
    color: '#c0392b',
    fontSize: 12,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  modalCancel: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  modalCancelText: {
    color: colors.textSecondary,
    fontWeight: '700',
  },
  modalConfirm: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.skyDeep,
  },
  modalConfirmText: {
    color: '#fff',
    fontWeight: '700',
  },
});


