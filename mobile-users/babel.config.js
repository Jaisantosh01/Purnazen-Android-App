module.exports = {
  presets: ['babel-preset-expo'],
  // VisionCamera frame processors (vitals scan) run as worklets on the camera
  // thread; this plugin compiles the `'worklet'` functions.
  plugins: [['react-native-worklets-core/plugin']],
};
