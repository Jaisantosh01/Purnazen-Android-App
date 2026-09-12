/* eslint-env jest */
/* Mocks for native modules that have no JS-only implementation under jest. */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);

// @react-native-firebase packages ship ESM-only dist builds *and* a native
// TurboModule, so neither the import nor the call survives jest. crashReporting
// is imported transitively by the auth store, which nearly every suite reaches,
// so without this mock the failure is "Unexpected token 'export'" in files that
// have nothing to do with Firebase.
jest.mock('@react-native-firebase/crashlytics', () => {
  const instance = {
    setCrashlyticsCollectionEnabled: jest.fn(),
    setAttributes: jest.fn(),
    setUserId: jest.fn(),
    log: jest.fn(),
    recordError: jest.fn(),
  };
  return { __esModule: true, default: () => instance };
});

jest.mock('react-native-keychain', () => {
  const store = {};
  return {
    setGenericPassword: jest.fn(async (username, password, options = {}) => {
      store[options.service || 'default'] = { username, password };
      return { service: options.service || 'default', storage: 'mock' };
    }),
    getGenericPassword: jest.fn(async (options = {}) => {
      return store[options.service || 'default'] || false;
    }),
    resetGenericPassword: jest.fn(async (options = {}) => {
      delete store[options.service || 'default'];
      return true;
    }),
  };
});
