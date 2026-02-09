import axios from 'axios';
import Constants from 'expo-constants';

function normalizeBaseUrl(url) {
  const trimmed = typeof url === 'string' ? url.trim() : '';
  if (!trimmed) return 'https://localhost:8000';
  if (trimmed.startsWith('http://')) {
    throw new Error('API_BASE_URL must use https://');
  }
  return trimmed.replace(/\/+$/, '');
}

const baseURL = normalizeBaseUrl(Constants.expoConfig?.extra?.apiBaseUrl);
const publicApiKey = Constants.expoConfig?.extra?.publicApiKey || '';

let accessToken = '';
let refreshToken = '';
let authExpiredHandler = null;
let refreshPromise = null;

const client = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    ...(publicApiKey ? { 'phone-API-key': publicApiKey } : {}),
  },
  // Keep the flag for cookie-based sessions; safe to disable if tokens are used instead.
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${accessToken}`,
    };
  }
  return config;
});

const refreshClient = axios.create({
  baseURL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    ...(publicApiKey ? { 'phone-API-key': publicApiKey } : {}),
  },
});

const refreshAccessToken = async () => {
  if (!refreshToken) {
    throw new Error('Refresh token is missing.');
  }
  if (!refreshPromise) {
    refreshPromise = refreshClient
      .post('/api/token/refresh/', { refresh: refreshToken })
      .then((response) => {
        const nextAccess = response?.data?.access || '';
        if (!nextAccess) {
          throw new Error('Failed to refresh access token.');
        }
        accessToken = nextAccess;
        return nextAccess;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

// Placeholder response interceptor for centralized error handling and future CSRF/header wiring.
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const originalRequest = error.config;
    if (status === 401 && !originalRequest?._retry && refreshToken) {
      originalRequest._retry = true;
      try {
        const nextAccess = await refreshAccessToken();
        originalRequest.headers = {
          ...originalRequest.headers,
          Authorization: `Bearer ${nextAccess}`,
        };
        return client(originalRequest);
      } catch (refreshError) {
        if (typeof authExpiredHandler === 'function') {
          authExpiredHandler();
        }
        const refreshMessage =
          refreshError.response?.data?.detail ||
          refreshError.message ||
          'Token refresh failed.';
        return Promise.reject(new Error(refreshMessage));
      }
    }
    const message =
      error.response?.data?.detail ||
      error.message ||
      'Network error. Please try again.';
    return Promise.reject(new Error(message));
  }
);

export function setAccessToken(token) {
  accessToken = token || '';
}

export function setAuthTokens(tokens = {}) {
  accessToken = tokens.access || '';
  refreshToken = tokens.refresh || '';
}

export function setAuthExpiredHandler(handler) {
  authExpiredHandler = handler;
}

export default client;
export { baseURL };
