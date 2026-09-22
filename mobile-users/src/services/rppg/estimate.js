/**
 * Heart rate and respiration rate from a 20–60 s run of per-frame ROI colour
 * means. This is the whole v1 vitals algorithm: resample → POS → detrend →
 * dense DFT → peak, with an SNR that says whether to trust it.
 *
 * Input samples are { t, r, g, b } — timestamp in seconds and the spatial mean
 * of the skin ROI in that frame. Nothing about the video itself is needed; the
 * native frame processor reduces each frame to these four numbers on-device.
 *
 * Ranges: HR 42–240 bpm (0.7–4 Hz), RR 6–30 breaths/min (0.1–0.5 Hz). We
 * measure at rest, so the upper HR bound mostly serves to reject harmonics.
 */
import { detrend, peakWithSnr, powerSpectrum, resampleUniform } from './signal';
import { pos } from './pos';

export const HR_BAND = [0.7, 4.0];
export const RR_BAND = [0.1, 0.5];
const FS = 30;
const MIN_SECONDS = 10;

/** SNR thresholds (dB) → quality label. Below 'fair' the number is withheld. */
export function qualityFromSnr(snrDb) {
  if (snrDb >= 5) return 'good';
  if (snrDb >= 0) return 'fair';
  return 'poor';
}

/**
 * @param {{t:number, r:number, g:number, b:number}[]} samples
 * @returns {{ bpm:number|null, snrDb:number, quality:string, seconds:number, pulse:number[] }}
 */
export function estimateHeartRate(samples, { fs = FS } = {}) {
  const seconds = samples.length > 1 ? samples[samples.length - 1].t - samples[0].t : 0;
  if (seconds < MIN_SECONDS) {
    return { bpm: null, snrDb: -Infinity, quality: 'poor', seconds, pulse: [] };
  }
  const { channels } = resampleUniform(
    samples.map(s => s.t),
    [samples.map(s => s.r), samples.map(s => s.g), samples.map(s => s.b)],
    fs,
  );
  const raw = pos(channels[0], channels[1], channels[2], fs);
  const pulse = detrend(raw, Math.round(fs * 1.0));       // kill <1 Hz drift left by POS
  const { f, p } = powerSpectrum(pulse, fs, HR_BAND[0], HR_BAND[1], 0.5 / 60);
  const { f0, snrDb } = peakWithSnr(f, p, 0.1);
  const quality = qualityFromSnr(snrDb);
  return { bpm: quality === 'poor' ? null : f0 * 60, snrDb, quality, seconds, pulse };
}

/**
 * Respiration from the slow modulation of the green channel. Breathing moves
 * the head and chest and modulates venous return, both of which show up as a
 * 0.1–0.5 Hz component in the raw ROI mean.
 */
export function estimateRespiration(samples, { fs = FS } = {}) {
  const seconds = samples.length > 1 ? samples[samples.length - 1].t - samples[0].t : 0;
  if (seconds < 20) return { brpm: null, snrDb: -Infinity, quality: 'poor', seconds };
  const { channels } = resampleUniform(samples.map(s => s.t), [samples.map(s => s.g)], fs);
  const g = detrend(channels[0], Math.round(fs * 15));    // remove >15 s drift, keep breaths
  const { f, p } = powerSpectrum(g, fs, RR_BAND[0], RR_BAND[1], 0.25 / 60);
  const { f0, snrDb } = peakWithSnr(f, p, 0.03);
  const quality = qualityFromSnr(snrDb);
  return { brpm: quality === 'poor' ? null : f0 * 60, snrDb, quality, seconds };
}
