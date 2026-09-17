const { getDefaultConfig } = require('expo/metro-config');
const { mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const path = require('path');

// npm nests expo-modules-core under node_modules/expo/ here: expo-modules-core
// 56 has an optional peer on react-native-worklets 0.7/0.8, but
// react-native-draggable-flatlist pulls reanimated 4 (worklets 0.12), so npm
// refuses to hoist it. CocoaPods and Gradle autolinking find the nested copy;
// Metro does not, and every expo-* import then fails to resolve. Point Metro at
// the nested folder too — there is exactly one copy, so nothing gets duplicated.
const config = {
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(__dirname, 'node_modules/expo/node_modules'),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
