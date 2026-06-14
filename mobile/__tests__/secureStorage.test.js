import AsyncStorage from '@react-native-async-storage/async-storage';
import secureStorage from '../src/utils/secureStorage';

describe('secureStorage', () => {
  beforeEach(async () => {
    await secureStorage.clearTokens();
    await AsyncStorage.clear();
  });

  test('stores and returns tokens', async () => {
    await secureStorage.setTokens('access-abc', 'refresh-xyz');

    expect(await secureStorage.getAccessToken()).toBe('access-abc');
    expect(await secureStorage.getRefreshToken()).toBe('refresh-xyz');
  });

  test('returns null when no tokens stored', async () => {
    expect(await secureStorage.getAccessToken()).toBeNull();
    expect(await secureStorage.getRefreshToken()).toBeNull();
  });

  test('clearTokens removes both tokens', async () => {
    await secureStorage.setTokens('access-abc', 'refresh-xyz');
    await secureStorage.clearTokens();

    expect(await secureStorage.getAccessToken()).toBeNull();
    expect(await secureStorage.getRefreshToken()).toBeNull();
  });

  test('migrates legacy AsyncStorage tokens into the keystore', async () => {
    await AsyncStorage.setMany({
      access_token: 'legacy-access',
      refresh_token: 'legacy-refresh',
    });

    await secureStorage.migrateFromAsyncStorage();

    expect(await secureStorage.getAccessToken()).toBe('legacy-access');
    expect(await secureStorage.getRefreshToken()).toBe('legacy-refresh');
    expect(await AsyncStorage.getItem('access_token')).toBeNull();
    expect(await AsyncStorage.getItem('refresh_token')).toBeNull();
  });

  test('migration is a no-op when nothing is stored', async () => {
    await secureStorage.migrateFromAsyncStorage();

    expect(await secureStorage.getAccessToken()).toBeNull();
    expect(await secureStorage.getRefreshToken()).toBeNull();
  });
});
