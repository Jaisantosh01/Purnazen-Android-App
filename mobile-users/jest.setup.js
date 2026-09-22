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

// react-native-vision-camera has a native TurboModule that throws on import
// under jest. Stub the surface the scan screens use.
jest.mock('react-native-vision-camera', () => ({
  Camera: () => null,
  useCameraDevice: () => undefined,
  useCameraFormat: () => undefined,
  useCameraPermission: () => ({ hasPermission: false, requestPermission: jest.fn() }),
  useFrameProcessor: fn => fn,
  // No native plugin under jest → VitalsScanScreen renders its "not available" state.
  VisionCameraProxy: { initFrameProcessorPlugin: () => undefined },
}));

jest.mock('react-native-worklets-core', () => ({
  Worklets: { createRunOnJS: fn => fn },
}));

// Native resizer (pre-upload downscale in scanService): pass the URI through.
jest.mock('react-native-image-resizer', () => ({
  __esModule: true,
  default: { createResizedImage: jest.fn(async uri => ({ uri })) },
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

// Native-only modules used by AddressManagementScreen (PR #22).
jest.mock('react-native-webview', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { WebView: props => React.createElement(View, props) };
});

jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn(),
  watchPosition: jest.fn(),
  clearWatch: jest.fn(),
  requestAuthorization: jest.fn(),
}));

// react-native-safe-area-context measures insets from the native view tree,
// which isn't available under jest — so useSafeAreaInsets()/SafeAreaInsetsContext
// throw ("No safe area value available") when a screen is rendered without a
// real provider. Return static zero insets so screens (and ScreenHeader) render.
jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const { View } = require('react-native');
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  // Real context so useContext(SafeAreaInsetsContext) (e.g. in ScreenHeader) works.
  const SafeAreaInsetsContext = React.createContext(inset);
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaConsumer: ({ children }) => children(inset),
    SafeAreaInsetsContext,
    SafeAreaView: ({ children, ...props }) => React.createElement(View, props, children),
    useSafeAreaInsets: () => inset,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { frame, insets: inset },
  };
});

// Sign in with Apple (iOS only). Native Expo modules have no jest runtime;
// report the capability as unavailable so screens render without the button.
// socialAuthService.test.js overrides these with its own mocks.
jest.mock(
  'expo-apple-authentication',
  () => ({
    isAvailableAsync: jest.fn(() => Promise.resolve(false)),
    signInAsync: jest.fn(),
    AppleAuthenticationButton: () => null,
    AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 },
    AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
    AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  }),
  { virtual: true },
);
jest.mock(
  'expo-crypto',
  () => ({
    getRandomBytesAsync: jest.fn(async n => new Uint8Array(n)),
    digestStringAsync: jest.fn(async () => ''),
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  }),
  { virtual: true },
);
