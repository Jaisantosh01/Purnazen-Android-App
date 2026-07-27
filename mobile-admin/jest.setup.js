/* eslint-env jest */
/* Mocks for native modules that have no JS-only implementation under jest. */

require('react-native-gesture-handler/jestSetup');

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}));

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);

// Drag-to-reorder pulls in Reanimated 4, which wires itself to the native
// worklets runtime on import and has no JS fallback (its shipped mock loads the
// real module too). Stubbing it here with a plain FlatList keeps that whole
// stack out of the module graph — the video/FAQ screens still render, they just
// aren't draggable under test.
jest.mock('react-native-draggable-flatlist', () => {
  const React = require('react');
  const { FlatList } = require('react-native');
  const DraggableFlatList = ({ renderItem, ...props }) =>
    React.createElement(FlatList, {
      ...props,
      renderItem: info => renderItem({ ...info, drag: () => {}, isActive: false }),
    });
  return {
    __esModule: true,
    default: DraggableFlatList,
    ScaleDecorator: ({ children }) => children,
  };
});

// The WebView entry point calls TurboModuleRegistry.getEnforcing at import
// time, so anything importing it (ClinicAddressPickerScreen, and App through
// it) blows up under jest unless the module is stubbed out entirely.
jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return { WebView: View, default: View };
});

jest.mock('@react-native-community/geolocation', () => ({
  getCurrentPosition: jest.fn((success) =>
    success({ coords: { latitude: 12.9716, longitude: 77.5946 } }),
  ),
  watchPosition: jest.fn(() => 0),
  clearWatch: jest.fn(),
  requestAuthorization: jest.fn(),
  setRNConfiguration: jest.fn(),
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
