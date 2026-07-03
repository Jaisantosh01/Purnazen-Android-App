module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-native-gesture-handler|react-native-swipe-list-view|react-native-vector-icons|react-native-keychain|@react-native-async-storage|expo[a-z-]*|@expo)/)',
  ],
};
