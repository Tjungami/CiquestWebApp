import { Alert } from 'react-native';
import { useCallback, useRef } from 'react';

const DEFAULT_WINDOW_MS = 1800;

export function useDoubleBackPress(options = {}) {
  const lastPressedAtRef = useRef(0);
  const title = options.title || '確認';
  const message = options.message || 'もう一度押すと前の画面に戻ります。';
  const windowMs = Number.isFinite(options.windowMs) ? options.windowMs : DEFAULT_WINDOW_MS;

  return useCallback(
    (onConfirm) => {
      if (typeof onConfirm !== 'function') return false;
      const now = Date.now();
      if (now - lastPressedAtRef.current <= windowMs) {
        lastPressedAtRef.current = 0;
        onConfirm();
        return true;
      }
      lastPressedAtRef.current = now;
      Alert.alert(title, message);
      return false;
    },
    [message, title, windowMs]
  );
}

