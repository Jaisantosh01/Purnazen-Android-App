/**
 * Sign in with Apple: native sheet -> Firebase credential (with the raw nonce)
 * -> Firebase ID token -> backend, plus the cancel and Android paths.
 */
import { Platform } from 'react-native';

const mockSignInWithCredential = jest.fn();
const mockGetIdToken = jest.fn();
const mockSignOut = jest.fn(() => Promise.resolve());
const mockCredential = jest.fn(params => ({ providerId: 'apple.com', ...params }));

jest.mock('@react-native-firebase/app', () => ({ getApp: () => ({}) }), { virtual: true });
jest.mock(
  '@react-native-firebase/auth',
  () => ({
    getAuth: () => ({ name: 'auth' }),
    OAuthProvider: jest.fn().mockImplementation(id => ({
      providerId: id,
      credential: params => mockCredential({ id, ...params }),
      addScope: jest.fn(),
    })),
    signInWithCredential: (...a) => mockSignInWithCredential(...a),
    signInWithPopup: jest.fn(),
    getIdToken: (...a) => mockGetIdToken(...a),
    signOut: (...a) => mockSignOut(...a),
  }),
  { virtual: true },
);

const mockSignInAsync = jest.fn();
const mockIsAvailable = jest.fn(() => Promise.resolve(true));
jest.mock(
  'expo-apple-authentication',
  () => ({
    isAvailableAsync: (...a) => mockIsAvailable(...a),
    signInAsync: (...a) => mockSignInAsync(...a),
    AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  }),
  { virtual: true },
);
jest.mock(
  'expo-crypto',
  () => ({
    getRandomBytesAsync: jest.fn(async n => new Uint8Array(n).fill(171)),
    digestStringAsync: jest.fn(async (_alg, s) => `sha256(${s})`),
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  }),
  { virtual: true },
);

jest.mock('../../services/authService', () => ({
  socialLogin: jest.fn(async (token, name) => ({ id: 'u1', token, name })),
  linkSocial: jest.fn(async token => ({ id: 'u1', linked: token })),
}));

const authService = require('../../services/authService');
const socialAuthService = require('../../services/socialAuthService').default;

const RAW_NONCE = 'ab'.repeat(32);

describe('socialAuthService — Sign in with Apple', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'ios';
    mockSignInAsync.mockResolvedValue({
      identityToken: 'apple-jwt',
      fullName: { givenName: 'Asha', familyName: 'Rao' },
    });
    mockSignInWithCredential.mockResolvedValue({ user: { uid: 'fb1' } });
    mockGetIdToken.mockResolvedValue('firebase-id-token');
  });

  it('hashes the nonce for Apple and gives Firebase the raw one', async () => {
    await socialAuthService.signInWithApple();

    expect(mockSignInAsync).toHaveBeenCalledWith(
      expect.objectContaining({ nonce: `sha256(${RAW_NONCE})`, requestedScopes: [0, 1] }),
    );
    expect(mockCredential).toHaveBeenCalledWith({
      id: 'apple.com',
      idToken: 'apple-jwt',
      rawNonce: RAW_NONCE,
    });
  });

  it('sends the Firebase token and the one-time Apple name to the backend', async () => {
    const user = await socialAuthService.signInWithApple();

    expect(authService.socialLogin).toHaveBeenCalledWith('firebase-id-token', 'Asha Rao');
    expect(user).toEqual({ id: 'u1', token: 'firebase-id-token', name: 'Asha Rao' });
    expect(mockSignOut).toHaveBeenCalled();
  });

  it('passes no name when Apple does not share one (repeat sign-in)', async () => {
    mockSignInAsync.mockResolvedValue({ identityToken: 'apple-jwt', fullName: null });
    await socialAuthService.signInWithApple();
    expect(authService.socialLogin).toHaveBeenCalledWith('firebase-id-token', null);
  });

  it('resolves to null when the user cancels the Apple sheet', async () => {
    mockSignInAsync.mockRejectedValue(Object.assign(new Error('x'), { code: 'ERR_REQUEST_CANCELED' }));
    await expect(socialAuthService.signInWithApple()).resolves.toBeNull();
    expect(authService.socialLogin).not.toHaveBeenCalled();
  });

  it('links an Apple identity to the signed-in account', async () => {
    const out = await socialAuthService.linkAccount('apple');
    expect(authService.linkSocial).toHaveBeenCalledWith('firebase-id-token');
    expect(out).toEqual({ id: 'u1', linked: 'firebase-id-token' });
  });

  it('is not offered on Android', async () => {
    Platform.OS = 'android';
    await expect(socialAuthService.isAppleSignInAvailable()).resolves.toBe(false);
    await expect(socialAuthService.signInWithApple()).rejects.toThrow(/iPhone/);
  });
});
