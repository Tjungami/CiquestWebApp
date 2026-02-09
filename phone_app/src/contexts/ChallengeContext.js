import React, { createContext, useContext, useMemo, useState } from 'react';

const ChallengeContext = createContext(null);

function normalizeChallenge(input) {
  if (!input) return null;
  const id = String(input.id ?? input.challenge_id ?? input.challengeId ?? '');
  if (!id) return null;
  const parseNumber = (value) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };
  return {
    id,
    title: input.title || 'クエスト',
    description: input.description || '',
    storeName: input.storeName || input.store_name || '',
    rewardPoints:
      parseNumber(input.rewardPoints) ??
      parseNumber(input.reward_points) ??
      parseNumber(input.points),
    reward: input.reward || input.reward_detail || '',
    type: input.type || '',
    qrCode: input.qrCode || input.qr_code || '',
    status: input.status || 'in_progress',
    startedAt: input.startedAt || new Date().toISOString(),
    clearedAt: input.clearedAt || null,
  };
}

export function ChallengeProvider({ children }) {
  const [activeChallenges, setActiveChallenges] = useState([]);
  const [clearedChallenges, setClearedChallenges] = useState([]);

  const startChallenge = (input) => {
    const normalized = normalizeChallenge(input);
    if (!normalized) return { created: false, reason: 'invalid' };
    let result = { created: true, challenge: normalized };
    setActiveChallenges((prev) => {
      const existing = prev.find((item) => item.id === normalized.id);
      if (existing) {
        result = {
          created: false,
          reason: existing.status === 'cleared' ? 'already_cleared' : 'already_active',
          challenge: existing,
        };
        return prev;
      }
      const clearedExisting = clearedChallenges.find((item) => item.id === normalized.id);
      if (clearedExisting) {
        result = {
          created: false,
          reason: 'already_cleared',
          challenge: clearedExisting,
        };
        return prev;
      }
      return [...prev, normalized];
    });
    return result;
  };

  const clearChallengeByQr = (qrCode) => {
    const trimmed = typeof qrCode === 'string' ? qrCode.trim() : '';
    if (!trimmed) return { cleared: false, reason: 'empty_qr' };
    let result = { cleared: false, reason: 'not_found' };
    let clearedChallenge = null;
    setActiveChallenges((prev) => {
      const next = [];
      prev.forEach((item) => {
        if (result.cleared) {
          next.push(item);
          return;
        }
        if (item.status !== 'in_progress') {
          next.push(item);
          return;
        }
        if (!item.qrCode || item.qrCode !== trimmed) {
          next.push(item);
          return;
        }
        const clearedAt = new Date().toISOString();
        clearedChallenge = { ...item, status: 'cleared', clearedAt };
        result = { cleared: true, challenge: clearedChallenge };
      });
      return next;
    });
    if (clearedChallenge) {
      setClearedChallenges((prev) => [clearedChallenge, ...prev]);
    }
    return result;
  };

  const retireChallenge = (challengeId) => {
    const id = String(challengeId ?? '');
    if (!id) return { retired: false, reason: 'invalid' };
    let removed = null;
    setActiveChallenges((prev) => {
      const next = prev.filter((item) => {
        if (item.id !== id) return true;
        removed = item;
        return false;
      });
      return next;
    });
    if (!removed) return { retired: false, reason: 'not_found' };
    return { retired: true, challenge: removed };
  };

  const value = useMemo(
    () => ({
      activeChallenges,
      clearedChallenges,
      startChallenge,
      clearChallengeByQr,
      retireChallenge,
    }),
    [activeChallenges, clearedChallenges]
  );

  return <ChallengeContext.Provider value={value}>{children}</ChallengeContext.Provider>;
}

export function useChallenges() {
  const ctx = useContext(ChallengeContext);
  if (!ctx) throw new Error('useChallenges must be used within ChallengeProvider');
  return ctx;
}
