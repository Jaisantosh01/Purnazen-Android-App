import { estimateHeartRate, estimateRespiration } from '../../services/rppg/estimate';
import { pos } from '../../services/rppg/pos';
import { resampleUniform } from '../../services/rppg/signal';

// Deterministic Gaussian noise (Box–Muller over an LCG) so the test is stable.
function rng(seed) {
  let s = seed >>> 0;
  const u = () => ((s = (1664525 * s + 1013904223) >>> 0) / 4294967296);
  return () => Math.sqrt(-2 * Math.log(u() + 1e-12)) * Math.cos(2 * Math.PI * u());
}

/**
 * Synthetic ROI means. Pulse modulates the channels with the relative strengths
 * of the blood-volume pulse vector (G strongest, then B, then R), on top of a
 * skin tone, a slow multiplicative illumination drift, a breathing modulation,
 * sensor noise and camera timestamp jitter.
 */
function synth({ seconds = 30, fps = 30, hrBpm = 72, rrBpm = 15, pulseAmp = 0.006, noise = 0.35, seed = 7 }) {
  const gauss = rng(seed);
  const skin = [150, 110, 95];
  const pulseVec = [0.33, 0.77, 0.53];
  const out = [];
  for (let i = 0; i < seconds * fps; i++) {
    const t = i / fps + 0.003 * gauss();                       // ±3 ms jitter
    const pulse = Math.sin(2 * Math.PI * (hrBpm / 60) * t);
    const breath = 0.003 * Math.sin(2 * Math.PI * (rrBpm / 60) * t);
    const light = 1 + 0.08 * Math.sin(2 * Math.PI * 0.05 * t);  // slow drift
    const [r, g, b] = skin.map((c, k) => light * c * (1 + pulseAmp * pulseVec[k] * pulse + breath) + noise * gauss());
    out.push({ t, r, g, b });
  }
  return out.sort((a, b) => a.t - b.t);
}

describe('rPPG chain', () => {
  test('recovers a 72 bpm pulse through drift, breathing, noise and jitter', () => {
    const res = estimateHeartRate(synth({ hrBpm: 72 }));
    expect(res.quality).not.toBe('poor');
    expect(Math.abs(res.bpm - 72)).toBeLessThanOrEqual(1.5);
  });

  test('tracks a different rate (fails if the spectrum is hard-coded or aliased)', () => {
    const res = estimateHeartRate(synth({ hrBpm: 95, seed: 11 }));
    expect(Math.abs(res.bpm - 95)).toBeLessThanOrEqual(1.5);
  });

  test('recovers 15 breaths/min from the green channel', () => {
    const res = estimateRespiration(synth({ seconds: 40, rrBpm: 15 }));
    expect(res.quality).not.toBe('poor');
    expect(Math.abs(res.brpm - 15)).toBeLessThanOrEqual(1.5);
  });

  test('withholds the number on pure noise', () => {
    const gauss = rng(3);
    const samples = Array.from({ length: 900 }, (_, i) => ({
      t: i / 30, r: 150 + gauss(), g: 110 + gauss(), b: 95 + gauss(),
    }));
    const res = estimateHeartRate(samples);
    expect(res.quality).toBe('poor');
    expect(res.bpm).toBeNull();
  });

  test('withholds the number on a recording that is too short', () => {
    expect(estimateHeartRate(synth({ seconds: 5 })).bpm).toBeNull();
  });

  test('POS cancels a pure illumination change (no pulse → ~flat output)', () => {
    const n = 300, fs = 30;
    const light = Array.from({ length: n }, (_, i) => 1 + 0.2 * Math.sin(2 * Math.PI * 1.2 * i / fs));
    const h = pos(light.map(v => 150 * v), light.map(v => 110 * v), light.map(v => 95 * v), fs);
    const rms = Math.sqrt(h.reduce((s, v) => s + v * v, 0) / n);
    expect(rms).toBeLessThan(1e-9);
  });

  test('resampling lands on a uniform grid', () => {
    const t = [0, 0.031, 0.07, 0.099, 0.134];
    const { channels } = resampleUniform(t, [[0, 1, 2, 3, 4]], 30);
    expect(channels[0].length).toBe(5);                // 0.134 s span → 5 samples at 30 Hz
    expect(channels[0][1]).toBeCloseTo(1.07, 1);       // t=1/30 s sits just past sample 1
  });
});
