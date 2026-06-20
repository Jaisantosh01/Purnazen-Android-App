/**
 * Client-side error reporting.
 * Sends structured error payloads to the backend for server-side logging.
 * Never throws — callers must not be disrupted by a reporting failure.
 */
import { Platform } from 'react-native';
import { BASE_URL, ENDPOINTS } from '../constants/apiEndpoints';

const APP_VERSION = '1.0.0'; // bump alongside app version

const errorReportingService = {
  /**
   * Report an error to the backend.
   *
   * @param {Error|string} error
   * @param {{ screen?: string, action?: string, [key: string]: any }} context
   */
  async report(error, context = {}) {
    try {
      const { screen, action, ...extra } = context;
      const message = typeof error === 'string' ? error : (error?.message ?? String(error));
      const stack   = error instanceof Error ? error.stack : undefined;

      // Fire-and-forget with a short timeout so it never blocks the UI
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), 5000);

      await fetch(`${BASE_URL}${ENDPOINTS.ERROR_REPORT}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:     message.slice(0, 1000),
          stack:       stack?.slice(0, 8000),
          screen:      screen || null,
          action:      action || null,
          platform:    Platform.OS,
          app_version: APP_VERSION,
          extra:       Object.keys(extra).length ? extra : null,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch {
      // Reporting itself must never throw
    }
  },

  /** Convenience: report + console.warn in dev. */
  warn(error, context = {}) {
    if (__DEV__) {
      console.warn('[ErrorReporting]', error, context);
    }
    return this.report(error, context);
  },

  /** Convenience: report + console.error in dev. */
  captureException(error, context = {}) {
    if (__DEV__) {
      console.error('[ErrorReporting]', error, context);
    }
    return this.report(error, context);
  },
};

export default errorReportingService;
