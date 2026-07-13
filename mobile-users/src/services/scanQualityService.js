import { NativeModules, Platform } from 'react-native';
import scanService from './scanService';

/**
 * Live capture-quality checks for the scan screens.
 *
 * Primary path: the native `ScanQuality` module (Android) — ML Kit face
 * detection + image statistics computed fully on-device. The preview frame
 * never leaves the phone (privacy) and a check takes tens of milliseconds
 * instead of a network round-trip (works offline / on slow connections).
 *
 * Fallback path: the backend `/scan/quality-preview` endpoint, used on
 * platforms without the native module (iOS, old builds) and for tongue scans.
 *
 * Thresholds and issue codes mirror backend/app/ai/quality.py — the server
 * remains the authoritative gate at upload time; this is the fast local mirror.
 */

const native = NativeModules.ScanQuality;

// ── Thresholds (keep in sync with backend/app/ai/quality.py) ─────────────────
const MIN_BLUR = 45.0; // Laplacian variance at ≤800px width; below = too soft
const MIN_MEAN_L = 80.0; // Lab L* mean (0-255); below = too dark
const MAX_MEAN_L = 220.0; // above = blown out / glare
const MIN_FACE_AREA = 0.04; // face bbox area / image area; below = too far
const MAX_CENTER_OFF = 0.3; // face-centre offset from image centre (frac of dim)
const MAX_YAW_DEG = 22; // client-only: head turned too far to the side

const GUIDANCE = {
  no_face: "We couldn't find your face. Centre it in the frame and ensure good lighting.",
  multiple_faces: 'Multiple faces detected. Make sure only your face is in the frame.',
  too_dark: "It's too dark. Move to brighter, even lighting.",
  too_bright: "It's too bright. Avoid direct glare or strong backlight.",
  too_blurry: 'The photo looks blurry. Hold still and keep your subject in focus.',
  face_too_small: 'Your face is too far away. Move a little closer.',
  off_center: 'Centre your face in the frame for the best result.',
  not_frontal: 'Face the camera directly for an accurate reading.',
};

const BLOCKING = new Set([
  'no_face', 'multiple_faces', 'too_dark', 'too_bright', 'too_blurry', 'face_too_small',
]);

const PRIORITY = [
  'no_face', 'multiple_faces',
  'too_dark', 'too_bright', 'too_blurry', 'face_too_small', 'off_center', 'not_frontal',
];

export const hasOnDeviceQuality =
  Platform.OS === 'android' && !!native && typeof native.analyze === 'function';

/** Map raw native metrics to the backend's issue list shape. */
function deriveIssues(m) {
  const codes = [];

  if (m.faceCount === 0) codes.push('no_face');
  else if (m.faceCount > 1) codes.push('multiple_faces');

  if (m.meanL < MIN_MEAN_L) codes.push('too_dark');
  else if (m.meanL > MAX_MEAN_L) codes.push('too_bright');

  if (m.blurVar < MIN_BLUR) codes.push('too_blurry');

  if (m.faceCount >= 1) {
    if (m.faceAreaRatio < MIN_FACE_AREA) codes.push('face_too_small');
    if (m.centerOffset > MAX_CENTER_OFF) codes.push('off_center');
    // Head-pose guidance only the on-device detector can provide.
    if (Math.abs(m.yaw ?? 0) > MAX_YAW_DEG) codes.push('not_frontal');
  }

  codes.sort((a, b) => PRIORITY.indexOf(a) - PRIORITY.indexOf(b));
  return codes.map(code => ({
    code,
    guidance: GUIDANCE[code] || '',
    blocking: BLOCKING.has(code),
  }));
}

/**
 * Run a live quality check on a preview frame.
 * Returns { ok, issues:[{code,guidance,blocking}], metrics, source:'device'|'server' }.
 *
 * @param {string} fileUri  Local file URI (takeSnapshot result)
 * @param {'face'|'tongue'} scanType
 */
export async function checkCaptureQuality(fileUri, scanType = 'face') {
  // Tongue detection needs the server's colour heuristics; face runs on-device.
  if (scanType === 'face' && hasOnDeviceQuality) {
    const metrics = await native.analyze(fileUri);
    const issues = deriveIssues(metrics);
    return {
      ok: !issues.some(i => i.blocking),
      issues,
      metrics,
      source: 'device',
    };
  }

  const result = await scanService.qualityPreview(fileUri, scanType);
  return { ...result, source: 'server' };
}

export default { checkCaptureQuality, hasOnDeviceQuality };
