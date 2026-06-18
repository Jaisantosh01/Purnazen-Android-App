import * as Keychain from 'react-native-keychain';

/**
 * Token storage backed by the device keystore (Android Keystore / iOS Keychain)
 * via react-native-keychain.
 *
 * Service names are namespaced to the doctor app so its tokens never collide
 * with the patient app (mobile-users) if both are installed on one device.
 *
 * Tokens are cached in memory after first read so the axios request
 * interceptor doesn't hit the native keystore on every call.
 */
const SERVICES = {
  ACCESS: 'com.purnazen.doctor.access_token',
  REFRESH: 'com.purnazen.doctor.refresh_token',
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
};

export default secureStorage;
