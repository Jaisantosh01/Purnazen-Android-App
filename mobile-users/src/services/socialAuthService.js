/**
 * Social sign-in via Firebase Authentication (see docs/FIREBASE.md).
 *
 * Every provider funnels into the same shape: sign into Firebase on the
 * device, grab the Firebase ID token, and exchange it at the backend
 * (`POST /auth/social`) for our own access/refresh pair. The backend
 * re-verifies the token against the Firebase project, so no provider secret
 * ships in the APK.
 *
 * - Google: native account picker (@react-native-google-signin), then the
 *   Google ID token is turned into a Firebase credential.
 * - GitHub: Firebase's built-in browser flow (signInWithPopup maps to the
 *   native SDK's provider flow) — no deep links or OAuth plumbing on our side.
 *
 * Everything requires android/app/google-services.json; without it (or Play
 * Services) the methods fail with a friendly message and password login is
 * unaffected. Both resolve to the logged-in user, or null when cancelled.
 */
import authService from './authService';
import { GOOGLE_WEB_CLIENT_ID } from '../config';

const UNAVAILABLE_MESSAGE =
  'Social sign-in is unavailable in this build. Please use email login.';

const isCancellation = err =>
  typeof err?.code === 'string' &&
  (err.code.includes('cancel') || err.code.includes('CANCELLED'));

// Lazy so a binary built before Firebase was configured still boots.
const getFirebase = () => {
  const { getApp } = require('@react-native-firebase/app');
  const fbAuth = require('@react-native-firebase/auth');
  return { fbAuth, auth: fbAuth.getAuth(getApp()) };
};

class SocialAuthService {
  async signInWithGoogle() {
    let fb, GoogleSignin;
    try {
      fb = getFirebase();
      ({ GoogleSignin } = require('@react-native-google-signin/google-signin'));
    } catch (e) {
      throw new Error(UNAVAILABLE_MESSAGE);
    }

    // 'autoDetect' reads the web client ID from google-services.json, so no
    // extra env var is needed; EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID can override.
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID || 'autoDetect' });
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const result = await GoogleSignin.signIn();
    if (result.type !== 'success') {
      return null; // user dismissed the account picker
    }
    const googleIdToken = result.data?.idToken;
    if (!googleIdToken) {
      throw new Error('Google did not return an ID token. Please try again.');
    }

    const credential = fb.fbAuth.GoogleAuthProvider.credential(googleIdToken);
    const userCredential = await fb.fbAuth.signInWithCredential(fb.auth, credential);
    return this._exchangeForSession(fb, userCredential);
  }

  async signInWithGitHub() {
    let fb;
    try {
      fb = getFirebase();
    } catch (e) {
      throw new Error(UNAVAILABLE_MESSAGE);
    }

    const provider = new fb.fbAuth.OAuthProvider('github.com');
    provider.addScope('user:email');

    let userCredential;
    try {
      // On native this runs the Firebase SDK's Custom-Tab OAuth flow.
      userCredential = await fb.fbAuth.signInWithPopup(fb.auth, provider);
    } catch (err) {
      if (isCancellation(err)) return null; // user closed the browser sheet
      throw err;
    }
    return this._exchangeForSession(fb, userCredential);
  }

  /** Trade the Firebase ID token for our backend session. */
  async _exchangeForSession(fb, userCredential) {
    const idToken = await fb.fbAuth.getIdToken(userCredential.user);
    try {
      return await authService.socialLogin(idToken);
    } finally {
      // The backend session is the source of truth — drop the Firebase one so
      // a rejected login (e.g. wrong role) leaves no half signed-in state.
      fb.fbAuth.signOut(fb.auth).catch(() => {});
    }
  }
}

export default new SocialAuthService();
