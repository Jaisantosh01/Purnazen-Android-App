/**
 * POS — plane-orthogonal-to-skin (Wang, den Brinker, Stuijk & de Haan, IEEE
 * TBME 2017, "Algorithmic principles of remote PPG"), Algorithm 1 verbatim.
 *
 * Input: per-frame spatial mean RGB of a skin ROI. Output: one pulse signal.
 * Works with no training and is the best of the hand-crafted projections across
 * skin tones in controlled settings, which is why it's v1.
 *
 * @param {number[]} r  @param {number[]} g  @param {number[]} b
 * @param {number} fs   sample rate, Hz
 * @param {number} [winSec=1.6]  window length; 1.6 s is the paper's choice
 */
export function pos(r, g, b, fs, winSec = 1.6) {
  const n = r.length;
  const l = Math.max(2, Math.round(winSec * fs));
  const h = new Array(n).fill(0);
  for (let end = l; end <= n; end++) {
    const start = end - l;
    // Temporal normalisation of each channel by its window mean.
    let mr = 0, mg = 0, mb = 0;
    for (let i = start; i < end; i++) { mr += r[i]; mg += g[i]; mb += b[i]; }
    mr /= l; mg /= l; mb /= l;
    const s1 = new Array(l), s2 = new Array(l);
    for (let i = 0; i < l; i++) {
      const cr = r[start + i] / (mr || 1), cg = g[start + i] / (mg || 1), cb = b[start + i] / (mb || 1);
      s1[i] = cg - cb;                 // P row 1: [0, 1, -1]
      s2[i] = -2 * cr + cg + cb;       // P row 2: [-2, 1, 1]
    }
    const sd1 = _std(s1), sd2 = _std(s2);
    const alpha = sd2 > 1e-12 ? sd1 / sd2 : 0;
    let mh = 0;
    const hw = new Array(l);
    for (let i = 0; i < l; i++) { hw[i] = s1[i] + alpha * s2[i]; mh += hw[i]; }
    mh /= l;
    for (let i = 0; i < l; i++) h[start + i] += hw[i] - mh;   // overlap-add
  }
  return h;
}

function _std(a) {
  let m = 0; for (const v of a) m += v; m /= a.length;
  let s = 0; for (const v of a) s += (v - m) * (v - m);
  return Math.sqrt(s / a.length);
}
