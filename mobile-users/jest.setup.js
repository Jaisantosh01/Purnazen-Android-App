/* eslint-env jest */
/* Mocks for native modules that have no JS-only implementation under jest. */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);

// react-native-vision-camera has a native TurboModule that throws on import
// under jest. Stub the surface the scan screens use.
jest.mock('react-native-vision-camera', () => ({
  Camera: () => null,
  useCameraDevice: () => undefined,
  useCameraPermission: () => ({ hasPermission: false, requestPermission: jest.fn() }),
}));

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
  launchCamera: jest.fn(),
}));

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
