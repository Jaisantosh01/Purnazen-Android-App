/**
 * Crash + error reporting (Firebase Crashlytics).
 *
 * The ErrorBoundary catches React render errors and POSTs them to
 * `/errors/report`, which is genuinely useful — handled failures land in our
 * own logs, in our own payload shape, next to the server request that failed.
 * It is also blind to most of what actually kills an app in the field:
 *
 *   - Native crashes. ML Kit, Vision Camera, Hermes, JNI, OOM. The process
 *     dies; nothing sends.
 *   - ANRs, which Play enforces a threshold on.
 *   - Startup crashes, before the JS bundle loads and the boundary mounts.
 *   - Anything thrown outside the React tree: promise rejections, timers,
 *     native callbacks.
 *   - Symbolication. Hermes release bundles produce minified stacks, and with
 *     R8 on the native frames are obfuscated too.
 *
 * Crashlytics covers all of those, deduplicates, and gives a crash-free-users
 * number. The two are complementary, so `/errors/report` stays: this module
 * adds Crashlytics alongside it rather than replacing it.
 *
 * Nothing here throws. A reporting failure must never be what breaks the app.
 */
import crashlytics from '@react-native-firebase/crashlytics';
import { APP_SLUG, APP_VERSION } from '../config';

let installed = false;

const safe = fn => {
  try {
    return fn();
  } catch {
    return undefined;
  }
};

/**
 * Install the global handlers. Call once, as early in the app's life as
 * possible — anything that throws before this runs is only visible as a native
 * crash, not as a JS stack.
 */
export function initCrashReporting() {
  if (installed) return;
  installed = true;

  // Collection is disabled in dev: a Metro reload storm is not a crash-rate
  // signal, and it pollutes the release numbers Play vitals is compared to.
  const enabled = !(typeof __DEV__ !== 'undefined' && __DEV__);
  safe(() => crashlytics().setCrashlyticsCollectionEnabled(enabled));
  if (!enabled) return;

  safe(() =>
    crashlytics().setAttributes({
      app: String(APP_SLUG),
      appVersion: String(APP_VERSION),
    }),
  );

  // Fatal and non-fatal JS errors that escape every boundary. Chain to the
  // previous handler so RN's red box still appears in dev builds.
  const globalHandlers = global.ErrorUtils;
  if (globalHandlers?.setGlobalHandler) {
    const previous = globalHandlers.getGlobalHandler?.();
    globalHandlers.setGlobalHandler((error, isFatal) => {
      safe(() => {
        crashlytics().log(`Unhandled JS error (fatal=${!!isFatal})`);
        crashlytics().recordError(
          error instanceof Error ? error : new Error(String(error)),
        );
      });
      previous?.(error, isFatal);
    });
  }

  // Unhandled promise rejections never reach ErrorUtils. RN bundles the
  // `promise` polyfill's rejection tracker for exactly this.
  safe(() => {
    require('promise/setimmediate/rejection-tracking').enable({
      allRejections: true,
      onUnhandled: (id, error) => {
        safe(() => {
          crashlytics().log(`Unhandled promise rejection #${id}`);
          crashlytics().recordError(
            error instanceof Error ? error : new Error(String(error)),
          );
        });
      },
      onHandled: () => {},
    });
  });
}

/**
 * Tie crashes to an account so a user reporting a problem can be found in the
 * console. The id only — no email, no name, nothing that widens what the
 * Data Safety declaration has to cover beyond "installation identifier".
 */
export function setCrashUser(userId) {
  safe(() => crashlytics().setUserId(userId ? String(userId) : ''));
}

/** Breadcrumb attached to the next crash report. */
export function logBreadcrumb(message) {
  safe(() => crashlytics().log(String(message)));
}

/** Record a handled error as a non-fatal. */
export function recordHandledError(error, context = {}) {
  safe(() => {
    const entries = Object.entries(context);
    if (entries.length) {
      crashlytics().setAttributes(
        Object.fromEntries(entries.map(([k, v]) => [k, String(v)])),
      );
    }
    crashlytics().recordError(
      error instanceof Error ? error : new Error(String(error)),
    );
  });
}

export default {
  initCrashReporting,
  setCrashUser,
  logBreadcrumb,
  recordHandledError,
};
