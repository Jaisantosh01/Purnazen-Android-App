/**
 * Build-time configuration.
 *
 * Values come from `.env` as Expo public env vars (EXPO_PUBLIC_*), inlined by
 * babel-preset-expo when the bundle is built. The doctor app talks to the SAME
 * FastAPI backend as the patient app (mobile-users); only the screens differ.
 *
 * Defaults keep local development working without a .env file (10.0.2.2 = host
 * machine from the Android emulator). 'localhost' works when
 * `adb reverse tcp:5000 tcp:5000` is active.
 */
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5000';

export const API_VERSION = '/api/v1';
