/**
 * Build-time configuration.
 *
 * Values come from `.env` as Expo public env vars (EXPO_PUBLIC_*), inlined by
 * babel-preset-expo when the bundle is built.
 *
 * The default is `localhost:5000`, which works on **both** a physical device and
 * the emulator as long as `adb reverse tcp:5000 tcp:5000` is active (you already
 * need adb reverse for Metro on a USB device). NOTE: `react-native start` does
 * NOT load `.env`, so this default is what ships in dev builds unless you bundle
 * via `expo`. For an emulator with no adb reverse, use `http://10.0.2.2:5000`;
 * for a device over Wi-Fi, use `http://<your-machine-LAN-IP>:5000`.
 */
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000';

export const API_VERSION = '/api/v1';
