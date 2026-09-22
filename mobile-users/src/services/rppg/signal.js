/**
 * Small numeric helpers for the rPPG chain. Plain arrays, no deps.
 *
 * Everything here works on a few hundred to a few thousand samples (30 s at
 * 30 fps = 900), so the O(n·bins) direct DFT below is a couple of hundred
 * thousand multiply-adds — a millisecond of JS. That buys arbitrary frequency
 * resolution and no FFT/power-of-two bookkeeping.
 */

export const mean = a => a.reduce((s, v) => s + v, 0) / (a.length || 1);

export function std(a) {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length || 1));
}

/**
 * Resample irregularly timestamped samples onto a uniform grid by linear
 * interpolation. Camera frames never arrive at exactly 30 fps; feeding jittered
 * samples straight into a spectrum smears the peak and shows up as HR error.
 *
 * @param {number[]} t   timestamps, seconds, strictly increasing
 * @param {number[][]} channels  one array per channel, same length as t
 * @param {number} fs   target sample rate
 * @returns {{ fs:number, channels:number[][] }}
 */
export function resampleUniform(t, channels, fs) {
  const n = t.length;
  if (n < 2) return { fs, channels: channels.map(c => c.slice()) };
  const dt = 1 / fs;
  const count = Math.floor((t[n - 1] - t[0]) / dt) + 1;
  const out = channels.map(() => new Array(count));
  let j = 0;
  for (let i = 0; i < count; i++) {
    const ti = t[0] + i * dt;
    while (j < n - 2 && t[j + 1] < ti) j++;
    const w = (ti - t[j]) / (t[j + 1] - t[j] || 1);
    for (let c = 0; c < channels.length; c++) {
      out[c][i] = channels[c][j] + w * (channels[c][j + 1] - channels[c][j]);
    }
  }
  return { fs, channels: out };
}

/** Subtract a moving average (window in samples) — removes slow drift. */
export function detrend(x, window) {
  const half = Math.floor(window / 2);
  const out = new Array(x.length);
  let sum = 0, lo = 0, hi = -1;
  for (let i = 0; i < x.length; i++) {
    while (hi < Math.min(x.length - 1, i + half)) sum += x[++hi];
    while (lo < i - half) sum -= x[lo++];
    out[i] = x[i] - sum / (hi - lo + 1);
  }
  return out;
}

/**
 * Power spectrum on an explicit frequency grid via direct DFT with a Hann
 * window. Returns parallel arrays { f, p }.
 */
export function powerSpectrum(x, fs, fLo, fHi, df) {
  const n = x.length;
  const win = new Array(n);
  for (let i = 0; i < n; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1 || 1));
  const m = mean(x);
  const f = [], p = [];
  for (let fr = fLo; fr <= fHi + 1e-9; fr += df) {
    const w = (2 * Math.PI * fr) / fs;
    let re = 0, im = 0;
    for (let i = 0; i < n; i++) {
      const v = (x[i] - m) * win[i];
      re += v * Math.cos(w * i);
      im -= v * Math.sin(w * i);
    }
    f.push(fr);
    p.push(re * re + im * im);
  }
  return { f, p };
}

/**
 * Spectral peak plus a de Haan-style SNR: power within ±halfBand of the peak
 * and its first harmonic, over everything else in the analysed band, in dB.
 */
export function peakWithSnr(f, p, halfBand) {
  let k = 0;
  for (let i = 1; i < p.length; i++) if (p[i] > p[k]) k = i;
  const f0 = f[k];
  let sig = 0, rest = 0;
  for (let i = 0; i < p.length; i++) {
    const inPeak = Math.abs(f[i] - f0) <= halfBand || Math.abs(f[i] - 2 * f0) <= halfBand;
    if (inPeak) sig += p[i]; else rest += p[i];
  }
  return { f0, snrDb: 10 * Math.log10((sig + 1e-12) / (rest + 1e-12)) };
}
