/**
 * Bridge to the native `OtaUpdater` module (Android): background APK download via
 * the system DownloadManager + a direct hand-off to the OS package installer.
 *
 * Every function degrades gracefully when the native module is missing (iOS, or a
 * JS bundle running on an older native build): `isOtaSupported()` is false and the
 * caller falls back to the legacy browser hand-off (`Linking.openURL`).
 *
 * Lifecycle events (subscribe via `onOtaEvent`):
 *  - otaDownloadProgress  { progress: 0..100 | -1, bytesDownloaded, bytesTotal }
 *  - otaDownloadComplete  { filePath }
 *  - otaDownloadError     { message }
 */
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { OtaUpdater } = NativeModules;

export const OTA_EVENTS = {
  PROGRESS: 'otaDownloadProgress',
  COMPLETE: 'otaDownloadComplete',
  ERROR: 'otaDownloadError',
};

const emitter = OtaUpdater ? new NativeEventEmitter(OtaUpdater) : null;

/** True when the in-app download + install path is available. */
export function isOtaSupported() {
  return Platform.OS === 'android' && !!OtaUpdater;
}

/** Whether the app may launch the installer ("install unknown apps" granted). */
export async function canInstall() {
  if (!OtaUpdater) return false;
  try {
    return !!(await OtaUpdater.isInstallAllowed());
  } catch {
    return false;
  }
}

/** Deep-link the user to the OS "Allow install from this source" screen. */
export async function openInstallSettings() {
  if (!OtaUpdater) return;
  try {
    await OtaUpdater.openInstallSettings();
  } catch {
    // Non-fatal: some OEM builds hide the screen; the installer will prompt anyway.
  }
}

/**
 * Start a background download of the APK. Resolves (with a download id) once it
 * is enqueued; progress + completion arrive via the OTA_EVENTS listeners. When a
 * 64-hex `sha256` is supplied the native side verifies it before completing.
 */
export async function downloadUpdate(url, version, sha256) {
  if (!OtaUpdater) throw new Error('OTA updater unavailable');
  return OtaUpdater.download(url, String(version), sha256 || null);
}

/** Launch the OS installer for a completed download (path optional; last used otherwise). */
export async function installUpdate(filePath) {
  if (!OtaUpdater) return false;
  return OtaUpdater.install(filePath || null);
}

/** Subscribe to a lifecycle event; returns a subscription with `.remove()`. */
export function onOtaEvent(event, handler) {
  if (!emitter) return { remove() {} };
  return emitter.addListener(event, handler);
}

/**
 * One-shot background update for call sites without their own progress UI
 * (e.g. Settings → Check for Updates). Downloads the APK in the background and,
 * once it lands, launches the installer — guiding the user to grant "install
 * unknown apps" first when it's missing (the install-ready notification is the
 * fallback entry point if they grant later). Returns a cleanup fn. The system
 * DownloadManager notification tracks progress meanwhile.
 */
export function startBackgroundInstall({ url, version, sha256 }, handlers = {}) {
  if (!OtaUpdater) return () => {};
  const { onProgress, onComplete, onError } = handlers;
  const subs = [];
  const cleanup = () => { subs.forEach(s => s.remove()); subs.length = 0; };
  subs.push(onOtaEvent(OTA_EVENTS.PROGRESS, e => onProgress && onProgress(e)));
  subs.push(onOtaEvent(OTA_EVENTS.ERROR, e => { cleanup(); onError && onError(e); }));
  subs.push(onOtaEvent(OTA_EVENTS.COMPLETE, async (e) => {
    cleanup();
    if (onComplete) onComplete(e);
    if (await canInstall()) await installUpdate(e && e.filePath);
    else await openInstallSettings();
  }));
  (async () => {
    try {
      await downloadUpdate(url, version, sha256);
    } catch {
      cleanup();
      if (onError) onError({ message: 'Could not start the download' });
    }
  })();
  return cleanup;
}
