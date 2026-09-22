/**
 * JS half of the `roiMeans` frame-processor plugin (native halves:
 * android/.../vitals/RoiMeansPlugin.kt, ios/wellness/Vitals/RoiMeansPlugin.swift).
 *
 * Each camera frame is reduced on-device to { t, r, g, b, n } — the mean colour
 * of a centred square ROI — and only those five numbers ever reach JS. The
 * estimator in ./estimate.js turns 30 s of them into heart and respiration rate.
 */
import { VisionCameraProxy } from 'react-native-vision-camera';

let plugin;
try {
  plugin = VisionCameraProxy.initFrameProcessorPlugin('roiMeans', {});
} catch {
  plugin = undefined;
}

/** True when the native plugin is registered in this build. */
export const hasRoiMeansPlugin = !!plugin;

/** ROI side as a fraction of the frame's shorter edge — nose + cheeks under the oval guide. */
export const ROI_SIZE = 0.35;

/**
 * Worklet: call from inside `useFrameProcessor`.
 * @returns {{t:number, r:number, g:number, b:number, n:number}|null}
 */
export function roiMeans(frame) {
  'worklet';
  if (plugin == null) return null;
  return plugin.call(frame, { size: ROI_SIZE });
}
