/**
 * Social sign-in via Firebase Authentication (see docs/FIREBASE.md).
 *
 * Every provider funnels into the same shape: sign into Firebase on the
 * device, grab the Firebase ID token, and hand it to the backend. Two uses:
 *   - signInWith*(): exchange the token for our own session (login/signup)
 *   - linkAccount(): bind the identity to the ALREADY logged-in account so
 *     the social button logs into it later (Settings → Linked account)
 *
 * - Google: native account picker (@react-native-google-signin), then the
 *   Google ID token is turned into a Firebase credential.
 * - GitHub: Firebase's built-in browser flow (signInWithPopup maps to the
 *   native SDK's provider flow) — no deep links or OAuth plumbing on our side.
 *
 * Everything requires android/app/google-services.json; without it (or Play
 * Services) the methods fail with a friendly message and password login is
 * unaffected. Sign-in methods resolve to the logged-in user, or null when
 * the user cancelled.
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

  let userCredential;
  if (provider === 'google') {
    let GoogleSignin;
    try {
      ({ GoogleSignin } = require('@react-native-google-signin/google-signin'));
    } catch (e) {
      throw new Error(UNAVAILABLE_MESSAGE);
    }
    // 'autoDetect' reads the web client ID from google-services.json, so no
    // extra env var is needed; EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID can override.
    GoogleSignin.configure({ webClientId: GOOGLE_WEB_CLIENT_ID || 'autoDetect' });
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    const result = await GoogleSignin.signIn();
    if (result.type !== 'success') return null; // dismissed the picker
    const googleIdToken = result.data?.idToken;
    if (!googleIdToken) {
      throw new Error('Google did not return an ID token. Please try again.');
    }
    const credential = fb.fbAuth.GoogleAuthProvider.credential(googleIdToken);
    userCredential = await fb.fbAuth.signInWithCredential(fb.auth, credential);
  } else {
    const oauthProvider = new fb.fbAuth.OAuthProvider('github.com');
    oauthProvider.addScope('user:email');
    try {
      // On native this runs the Firebase SDK's Custom-Tab OAuth flow.
      userCredential = await fb.fbAuth.signInWithPopup(fb.auth, oauthProvider);
    } catch (err) {
      if (isCancellation(err)) return null; // closed the browser sheet
      throw err;
    }
  }

  const idToken = await fb.fbAuth.getIdToken(userCredential.user);
  // The backend session is the source of truth — drop the Firebase one so no
  // half signed-in state lingers (FCM does not need it).
  fb.fbAuth.signOut(fb.auth).catch(() => {});
  return idToken;
}

class SocialAuthService {
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
    const idToken = await getFirebaseIdToken(provider);
    return idToken === null ? null : authService.linkSocial(idToken);
  }
}

export default new SocialAuthService();
