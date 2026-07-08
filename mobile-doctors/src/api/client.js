import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import secureStorage from '../utils/secureStorage';
import { BASE_URL, ENDPOINTS } from '../constants/apiEndpoints';
import { useAuthStore } from '../store/authStore';
import { resetToLogin } from '../navigation/navigationRef';

const STATUS_MESSAGES = {
  401: 'Unauthorized. Please login again.',
  403: 'Access forbidden.',
  404: 'Resource not found.',
  500: 'Server error. Please try again later.',
};

// 401s from these endpoints mean bad credentials / dead session — never
// trigger the silent-refresh flow for them.
const NO_REFRESH_PATHS = [
  ENDPOINTS.LOGIN,
  ENDPOINTS.SOCIAL_LOGIN,
  ENDPOINTS.REFRESH,
  ENDPOINTS.LOGOUT,
];

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Attach the auth token to every request
client.interceptors.request.use(async config => {
  // Never let a keychain read failure abort the request — a throw here surfaces
  // as a misleading "network error". Proceed unauthenticated if it can't be read.
  try {
    const token = await secureStorage.getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    // ignore — request continues without the Authorization header
  }
  return config;
});

// One in-flight refresh at a time; concurrent 401s await the same promise.
let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = await secureStorage.getRefreshToken();
  if (!refreshToken) {
    throw new Error('No refresh token');
  }

  // Bare axios call so it skips this instance's interceptors
  const response = await axios.post(`${BASE_URL}${ENDPOINTS.REFRESH}`, null, {
    headers: { Authorization: `Bearer ${refreshToken}` },
    timeout: 30000,
  });

  const accessToken = response.data?.data?.access_token;
  if (!accessToken) {
    throw new Error('Refresh failed');
  }

  await secureStorage.setTokens(accessToken, refreshToken);
  return accessToken;
}

async function handleSessionExpired() {
  try {
    await secureStorage.clearTokens();
    await AsyncStorage.removeItem('user');
  } catch (storageError) {
    // Best effort — the store reset below still logs the UI out
  }
  useAuthStore.getState().clearAuth();
  resetToLogin();
}

function normalizeError(error) {
  const status = error.response?.status;
  const serverMessage =
    typeof error.response?.data?.message === 'string'
      ? error.response.data.message
      : null;

  const isNetworkError = !error.response && !error.code?.includes('CANCEL');

  const message =
    serverMessage ||
    STATUS_MESSAGES[status] ||
    (isNetworkError
      ? `Network error: ${error.message || error.code || 'request did not reach the server'}. Please check your connection and try again.`
      : status
      ? `Request failed with status ${status}`
      : error.message || 'Something went wrong.');

  const normalized = new Error(message);
  normalized.status = status;
  normalized.data = error.response?.data;
  return normalized;
}

// 401 → silent token refresh + replay; everything else → normalized Error
client.interceptors.response.use(
  response => response,
  async error => {
    const { config, response } = error;

    const isNoRefreshPath =
      !!config?.url && NO_REFRESH_PATHS.some(path => config.url.includes(path));

    if (response?.status === 401 && config && !config._retried && !isNoRefreshPath) {
      config._retried = true;
      try {
        refreshPromise =
          refreshPromise ||
          refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        const accessToken = await refreshPromise;

        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${accessToken}`;
        return client(config);
      } catch (refreshError) {
        await handleSessionExpired();
        return Promise.reject(new Error('Session expired. Please login again.'));
      }
    }

    return Promise.reject(normalizeError(error));
  },
);

// Methods resolve to the parsed response body
const apiClient = {
  get: (endpoint, config) => client.get(endpoint, config).then(response => response.data),
  post: (endpoint, body, config) =>
    client.post(endpoint, body, config).then(response => response.data),
  put: (endpoint, body, config) =>
    client.put(endpoint, body, config).then(response => response.data),
  patch: (endpoint, body, config) =>
    client.patch(endpoint, body, config).then(response => response.data),
  delete: (endpoint, config) => client.delete(endpoint, config).then(response => response.data),
};

// Exposed for tests (adapter injection)
export { client as axiosInstance };

export default apiClient;
