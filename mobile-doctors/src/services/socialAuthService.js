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
 * Everything requires android/app/google-services.json; without it the
 * methods fail with a friendly message and password login is unaffected.
 * Sign-in methods resolve to the logged-in user, or null when the user
 * cancelled.
 */
import authService from './authService';

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
