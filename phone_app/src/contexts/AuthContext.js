import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { setAuthExpiredHandler, setAuthTokens } from '../api/client';

const AuthContext = createContext(null);
const AUTH_STORAGE_KEY = 'ciquest_auth_v1';

export function AuthProvider({ children }) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [user, setUser] = useState(null);
  const [accessToken, setAccessTokenState] = useState('');
  const [refreshToken, setRefreshTokenState] = useState('');
  const [userCoupons, setUserCoupons] = useState([]);
  const [userCouponHistory, setUserCouponHistory] = useState([]);
  const [storeCouponHistory, setStoreCouponHistory] = useState([]);

  const persistAuthState = useCallback(async (nextUser, nextAccess, nextRefresh) => {
    try {
      if (!nextAccess && !nextRefresh) {
        await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY);
        return;
      }
      await SecureStore.setItemAsync(
        AUTH_STORAGE_KEY,
        JSON.stringify({
          user: nextUser,
          access: nextAccess,
          refresh: nextRefresh,
        })
      );
    } catch (err) {
      // Ignore storage errors to avoid blocking login/logout flows.
    }
  }, []);

  const login = useCallback((nextUser = null, tokens = {}) => {
    setLoggedIn(true);
    setUser(nextUser);
    const nextAccess = tokens.access || '';
    const nextRefresh = tokens.refresh || '';
    setAccessTokenState(nextAccess);
    setRefreshTokenState(nextRefresh);
    setAuthTokens({ access: nextAccess, refresh: nextRefresh });
    void persistAuthState(nextUser, nextAccess, nextRefresh);
  }, [persistAuthState]);

  const logout = useCallback(() => {
    setLoggedIn(false);
    setUser(null);
    setAccessTokenState('');
    setRefreshTokenState('');
    setAuthTokens({ access: '', refresh: '' });
    setUserCoupons([]);
    setUserCouponHistory([]);
    setStoreCouponHistory([]);
    void persistAuthState(null, '', '');
  }, [persistAuthState]);

  const updateUser = useCallback((partial) => {
    if (!partial) return;
    setUser((prev) => {
      const nextUser = { ...(prev || {}), ...partial };
      void persistAuthState(nextUser, accessToken, refreshToken);
      return nextUser;
    });
  }, [accessToken, refreshToken, persistAuthState]);

  const addUserCoupon = useCallback((coupon) => {
    if (!coupon) return;
    setUserCoupons((prev) => {
      const nextId = String(coupon.id ?? coupon.coupon_id ?? '');
      if (!nextId) return prev;
      const exists = prev.some((item) => String(item.id ?? item.coupon_id ?? '') === nextId);
      if (exists) return prev;
      return [...prev, coupon];
    });
  }, []);

  const markUserCouponUsed = useCallback((couponId) => {
    const targetId = String(couponId ?? '');
    if (!targetId) return;
    setUserCoupons((prev) =>
      prev.map((item) =>
        String(item.id ?? item.coupon_id ?? '') === targetId
          ? { ...item, used: true, usedAt: new Date().toISOString() }
          : item
      )
    );
  }, []);

  const addUserCouponHistory = useCallback((entry) => {
    if (!entry) return;
    setUserCouponHistory((prev) => [entry, ...prev]);
  }, []);

  const setUserCouponHistorySafe = useCallback((entries) => {
    if (!Array.isArray(entries)) return;
    setUserCouponHistory(entries);
  }, []);

  const addStoreCouponHistory = useCallback((entry) => {
    if (!entry) return;
    setStoreCouponHistory((prev) => [entry, ...prev]);
  }, []);

  const setStoreCouponHistorySafe = useCallback((entries) => {
    if (!Array.isArray(entries)) return;
    setStoreCouponHistory(entries);
  }, []);

  const value = useMemo(
    () => ({
      loggedIn,
      user,
      accessToken,
      refreshToken,
      userCoupons,
      userCouponHistory,
      storeCouponHistory,
      login,
      logout,
      updateUser,
      addUserCoupon,
      markUserCouponUsed,
      addUserCouponHistory,
      setUserCouponHistory: setUserCouponHistorySafe,
      addStoreCouponHistory,
      setStoreCouponHistory: setStoreCouponHistorySafe,
    }),
    [
      loggedIn,
      user,
      accessToken,
      refreshToken,
      userCoupons,
      userCouponHistory,
      storeCouponHistory,
      login,
      logout,
      updateUser,
      addUserCoupon,
      markUserCouponUsed,
      addUserCouponHistory,
      setUserCouponHistorySafe,
      addStoreCouponHistory,
      setStoreCouponHistorySafe,
    ]
  );

  useEffect(() => {
    let mounted = true;
    const restore = async () => {
      try {
        const stored = await SecureStore.getItemAsync(AUTH_STORAGE_KEY);
        if (!stored || !mounted) return;
        const parsed = JSON.parse(stored);
        const nextAccess = parsed?.access || '';
        const nextRefresh = parsed?.refresh || '';
        const nextUser = parsed?.user || null;
        if (!mounted) return;
        setUser(nextUser);
        setAccessTokenState(nextAccess);
        setRefreshTokenState(nextRefresh);
        setAuthTokens({ access: nextAccess, refresh: nextRefresh });
        setLoggedIn(Boolean(nextAccess || nextRefresh));
      } catch (err) {
        if (mounted) {
          setLoggedIn(false);
          setUser(null);
          setAccessTokenState('');
          setRefreshTokenState('');
          setAuthTokens({ access: '', refresh: '' });
        }
      }
    };
    void restore();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    setAuthExpiredHandler(() => {
      logout();
    });
    return () => {
      setAuthExpiredHandler(null);
    };
  }, [logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
