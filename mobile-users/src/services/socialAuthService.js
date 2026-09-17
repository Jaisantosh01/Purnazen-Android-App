/**
 * Social sign-in via Firebase Authentication (see docs/FIREBASE.md).
 *
 * Every provider funnels into the same shape: sign into Firebase on the
 * device, grab the Firebase ID token, and hand it to the backend. Two uses:
 *   - signInWith*(): exchange the token for our own session (login/signup)
 *   - linkAccount(): bind the identity to the ALREADY logged-in account so
 *     the social button logs into it later (Settings → Linked account)
 *
 * Google and GitHub both use Firebase's built-in browser flow — on native,
 * signInWithPopup maps to the SDK's Custom-Tab provider flow. Any provider
 * enabled in the Firebase console works the same way; no per-provider SDKs,
 * deep links, or OAuth plumbing on our side.
 *
 * Apple is the exception, and iOS-only: App Review expects the native Sign in
 * with Apple sheet (guideline 4.8 — required once Google sign-in is offered).
 * expo-apple-authentication shows that sheet and returns Apple's identity
 * token; Firebase exchanges it (with the raw nonce that was hashed into the
 * request) for a Firebase ID token, and from there it is the same path as the
 * other providers. Apple returns the user's name only on the very first
 * authorisation, so it is forwarded to the backend for account creation.
 *
 * Everything requires android/app/google-services.json; without it the
 * methods fail with a friendly message and password login is unaffected.
 * Sign-in methods resolve to the logged-in user, or null when the user
 * cancelled.
 */
import { Platform } from 'react-native';
import authService from './authService';

const UNAVAILABLE_MESSAGE =
  'Social sign-in is unavailable in this build. Please use email login.';

// Firebase: 'auth/popup-closed-by-user', '...cancelled...';
// expo-apple-authentication: 'ERR_REQUEST_CANCELED'.
const isCancellation = err =>
  typeof err?.code === 'string' && /cancel|popup-closed/i.test(err.code);

// Lazy so a binary built before Firebase was configured still boots.
const getFirebase = () => {
  const { getApp } = require('@react-native-firebase/app');
  const fbAuth = require('@react-native-firebase/auth');
  return { fbAuth, auth: fbAuth.getAuth(getApp()) };
};

/**
 * Run the device-side Firebase sign-in for a provider and return the Firebase
 * ID token, or null when the user cancelled.
 */
async function getFirebaseIdToken(provider) {
  let fb;
  try {
    fb = getFirebase();
  } catch (e) {
    throw new Error(UNAVAILABLE_MESSAGE);
  }

  const oauthProvider = new fb.fbAuth.OAuthProvider(
    provider === 'google' ? 'google.com' : 'github.com',
  );
  if (provider === 'google') {
    oauthProvider.addScope('email');
    oauthProvider.addScope('profile');
  } else {
    oauthProvider.addScope('user:email');
  }

  let userCredential;
  try {
    // On native this runs the Firebase SDK's Custom-Tab OAuth flow.
    userCredential = await fb.fbAuth.signInWithPopup(fb.auth, oauthProvider);
  } catch (err) {
    if (isCancellation(err)) return null; // closed the browser sheet
    throw err;
  }

  const idToken = await fb.fbAuth.getIdToken(userCredential.user);
  // The backend session is the source of truth — drop the Firebase one so no
  // half signed-in state lingers (FCM does not need it).
  fb.fbAuth.signOut(fb.auth).catch(() => {});
  return idToken;
}

/** Random URL-safe nonce; only its SHA-256 goes to Apple. */
async function makeNonce(Crypto) {
  const bytes = await Crypto.getRandomBytesAsync(32);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

const joinName = fullName =>
  [fullName?.givenName, fullName?.familyName].filter(Boolean).join(' ').trim() || null;

/**
 * Native Sign in with Apple -> Firebase ID token. Resolves to
 * `{ idToken, fullName }`, or null when the user cancelled.
 */
async function getAppleFirebaseIdToken() {
  if (Platform.OS !== 'ios') {
    throw new Error('Sign in with Apple is available on iPhone and iPad.');
  }
  let fb;
  let AppleAuthentication;
  let Crypto;
  try {
    fb = getFirebase();
    AppleAuthentication = require('expo-apple-authentication');
    Crypto = require('expo-crypto');
  } catch (e) {
    throw new Error(UNAVAILABLE_MESSAGE);
  }
  if (!(await AppleAuthentication.isAvailableAsync())) {
    throw new Error('Sign in with Apple is not available on this device.');
  }

  const rawNonce = await makeNonce(Crypto);
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  let apple;
  try {
    apple = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (err) {
    if (isCancellation(err)) return null;
    throw err;
  }
  if (!apple?.identityToken) {
    throw new Error('Apple did not return a sign-in token. Please try again.');
  }

  const credential = new fb.fbAuth.OAuthProvider('apple.com').credential({
    idToken: apple.identityToken,
    rawNonce,
  });
  const userCredential = await fb.fbAuth.signInWithCredential(fb.auth, credential);
  const idToken = await fb.fbAuth.getIdToken(userCredential.user);
  fb.fbAuth.signOut(fb.auth).catch(() => {});
  return { idToken, fullName: joinName(apple.fullName) };
}

class SocialAuthService {
  /** True where the native Apple button should be offered. */
  async isAppleSignInAvailable() {
    if (Platform.OS !== 'ios') return false;
    try {
      return await require('expo-apple-authentication').isAvailableAsync();
    } catch {
      return false;
    }
  }

  async signInWithApple() {
    const result = await getAppleFirebaseIdToken();
    return result === null
      ? null
      : authService.socialLogin(result.idToken, result.fullName);
  }

  async signInWithGoogle() {
    const idToken = await getFirebaseIdToken('google');
    return idToken === null ? null : authService.socialLogin(idToken);
  }

  async signInWithGitHub() {
    const idToken = await getFirebaseIdToken('github');
    return idToken === null ? null : authService.socialLogin(idToken);
  }

  /**
   * Link a social identity to the logged-in account (any email). Returns the
   * updated user, or null when the user cancelled the provider dialog.
   */
  async linkAccount(provider) {
    const idToken =
      provider === 'apple'
        ? (await getAppleFirebaseIdToken())?.idToken ?? null
        : await getFirebaseIdToken(provider);
    return idToken === null ? null : authService.linkSocial(idToken);
  }

  /** Dispatch by provider name: 'google' | 'github' | 'apple'. */
  signIn(provider) {
    if (provider === 'apple') return this.signInWithApple();
    if (provider === 'github') return this.signInWithGitHub();
    return this.signInWithGoogle();
  }
}

export default new SocialAuthService();
