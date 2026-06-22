import * as Keychain from 'react-native-keychain';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Token storage backed by the device keystore (Android Keystore / iOS Keychain)
 * via react-native-keychain. Replaces plaintext AsyncStorage persistence.
 *
 * Tokens are cached in memory after first read so the axios request
 * interceptor doesn't hit the native keystore on every call.
 */
const SERVICES = {
  ACCESS: 'com.purnazen.admin.access_token',
  REFRESH: 'com.purnazen.admin.refresh_token',
};

const cache = {
  [SERVICES.ACCESS]: undefined, // undefined = not read yet, null = known empty
  [SERVICES.REFRESH]: undefined,
};

async function getToken(service) {
  if (cache[service] !== undefined) {
    return cache[service];
  }
  const credentials = await Keychain.getGenericPassword({ service });
  cache[service] = credentials ? credentials.password : null;
  return cache[service];
}

async function setToken(service, token) {
  await Keychain.setGenericPassword('token', token, { service });
  cache[service] = token;
}

async function removeToken(service) {
  await Keychain.resetGenericPassword({ service });
  cache[service] = null;
}

const secureStorage = {
  getAccessToken: () => getToken(SERVICES.ACCESS),
  getRefreshToken: () => getToken(SERVICES.REFRESH),

  async setTokens(accessToken, refreshToken) {
    await Promise.all([
      setToken(SERVICES.ACCESS, accessToken),
      setToken(SERVICES.REFRESH, refreshToken),
    ]);
  },

  async clearTokens() {
    await Promise.all([
      removeToken(SERVICES.ACCESS),
      removeToken(SERVICES.REFRESH),
    ]);
  },

  /**
   * One-time migration: sessions created before the keychain switch kept
   * tokens in AsyncStorage. Move them into the keystore and wipe the
   * plaintext copies. Safe to call on every app start.
   */
  async migrateFromAsyncStorage() {
    const stored = await AsyncStorage.getMany(['access_token', 'refresh_token']);
    const accessToken = stored.access_token;
    const refreshToken = stored.refresh_token;

    if (!accessToken && !refreshToken) {
      return;
    }

    if (accessToken) {
      await setToken(SERVICES.ACCESS, accessToken);
    }
    if (refreshToken) {
      await setToken(SERVICES.REFRESH, refreshToken);
    }
    await AsyncStorage.removeMany(['access_token', 'refresh_token']);
  },
};

export default secureStorage;
