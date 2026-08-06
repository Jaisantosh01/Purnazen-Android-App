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
 *  - otaInstallStatus     { status: 'pending_user_action'|'success'|'error', message? }
 *
 * Note that a successful install is the one outcome JS usually never sees: the OS
 * kills this process to replace the app. The native side relaunches us afterwards.
 */
import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { OtaUpdater } = NativeModules;

export const OTA_EVENTS = {
  PROGRESS: 'otaDownloadProgress',
  COMPLETE: 'otaDownloadComplete',
  ERROR: 'otaDownloadError',
  INSTALL: 'otaInstallStatus',
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

/**
 * Install a completed download (path optional; last used otherwise).
 *
 * Resolves when the install has been handed to the OS, NOT when it finishes —
 * on Android 12+ this can replace the app with no dialog, so the next thing that
 * happens is usually the process dying. Watch OTA_EVENTS.INSTALL for anything the
 * user still has to do (or for a failure).
 */
export async function installUpdate(filePath) {
  if (!OtaUpdater) return false;
  return OtaUpdater.install(filePath || null);
}

/**
 * Dismiss leftover "update ready" / "update installed" notifications. Called on
 * app start: the post-update relaunch notification is only a fallback for devices
 * that block the automatic restart, so if we're running it has done its job.
 */
export async function clearUpdateNotifications() {
  if (!OtaUpdater?.clearUpdateNotifications) return false;
  try {
    return await OtaUpdater.clearUpdateNotifications();
  } catch {
    return false;
  }
}

/** Subscribe to a lifecycle event; returns a subscription with `.remove()`. */
export function onOtaEvent(event, handler) {
  if (!emitter) return { remove() {} };
  return emitter.addListener(event, handler);
}

/**
 * One-shot background update for call sites without their own progress UI
 * (e.g. Settings → Check for Updates). Downloads the APK in the background and,
 * once it lands, installs it — guiding the user to grant "install unknown apps"
 * first when it's missing (the install-ready notification is the fallback entry
 * point if they grant later). Returns a cleanup fn. The system DownloadManager
 * notification tracks progress meanwhile.
 *
 * A successful install ends this process, so the only terminal outcome that ever
 * reaches `onError` is a failure.
 */
export function startBackgroundInstall({ url, version, sha256 }, handlers = {}) {
  if (!OtaUpdater) return () => {};
  const { onProgress, onComplete, onError } = handlers;
  let subs = [];
  const drop = (list) => { list.forEach(s => s.remove()); };
  const cleanup = () => { drop(subs); subs = []; };
  const fail = (e) => { cleanup(); if (onError) onError(e); };
  // Install outcomes land after the download is done, so this subscription has to
  // outlive the download ones rather than being torn down alongside them.
  const installSub = onOtaEvent(OTA_EVENTS.INSTALL, (e) => {
    if (e && e.status === 'error') fail(e);
  });
  const downloadSubs = [
    onOtaEvent(OTA_EVENTS.PROGRESS, e => onProgress && onProgress(e)),
    onOtaEvent(OTA_EVENTS.ERROR, fail),
    onOtaEvent(OTA_EVENTS.COMPLETE, async (e) => {
      drop(downloadSubs);
      subs = [installSub];
      if (onComplete) onComplete(e);
      if (await canInstall()) await installUpdate(e && e.filePath);
      else await openInstallSettings();
    }),
  ];
  subs = [...downloadSubs, installSub];
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
