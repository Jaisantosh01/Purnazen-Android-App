/**
 * Build-time configuration.
 *
 * Values come from `.env` as Expo public env vars (EXPO_PUBLIC_*), inlined by
 * babel-preset-expo when the bundle is built. Defaults keep local development
 * working without a .env file (10.0.2.2 = host machine from the Android
 * emulator). Set EXPO_PUBLIC_API_URL to e.g. http://192.168.1.50:5000 when
 * testing on a physical device.
 */
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5000';

export const API_VERSION = '/api/v1';
