/**
 * Live-update (OTA) check against GitHub Releases.
 *
 * The apps are distributed as sideloaded APKs published by the "Release Mobile
 * Apps" workflow, which tags each release `<APP_SLUG>-v<version>` and attaches a
 * `purnazen-<APP_SLUG>-v<version>.apk`. On launch we ask the GitHub API for the
 * newest release for THIS app, compare it to the running APP_VERSION (baked in at
 * build time), and surface an update prompt when a newer one exists.
 *
 * A release whose notes contain the marker `purnazen:force-update` is treated as
 * mandatory — the prompt becomes non-dismissible (see UpdatePrompt).
 */
import { APP_SLUG, APP_VERSION, GITHUB_REPO } from '../config';

const RELEASES_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=30`;
export const FORCE_MARKER = 'purnazen:force-update';

// Compare dotted versions numerically: compareSemver('1.2.10','1.2.9') === 1.
// Returns 1 / 0 / -1. Missing/odd parts count as 0.
export function compareSemver(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * @returns {Promise<null | {version, current, forced, notes, apkUrl, pageUrl}>}
 *   null when up to date, offline, or running in dev.
 */
export async function checkForUpdate() {
  // Don't nag during Metro/dev — APP_VERSION isn't baked there.
  if (typeof __DEV__ !== 'undefined' && __DEV__) return null;
  try {
    const res = await fetch(RELEASES_URL, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const releases = await res.json();
    if (!Array.isArray(releases)) return null;

    const prefix = `${APP_SLUG}-v`;
    let best = null; // newest release for THIS app, by semver
    for (const r of releases) {
      if (r.draft || !r.tag_name || !r.tag_name.startsWith(prefix)) continue;
      const version = r.tag_name.slice(prefix.length);
      if (!best || compareSemver(version, best.version) > 0) {
        best = { version, release: r };
      }
    }
    if (!best) return null;
    if (compareSemver(best.version, APP_VERSION) <= 0) return null; // up to date

    const apk = (best.release.assets || []).find(
      a => a.name && a.name.toLowerCase().endsWith('.apk'),
    );
    return {
      version: best.version,
      current: APP_VERSION,
      forced: (best.release.body || '').includes(FORCE_MARKER),
      notes: best.release.body || '',
      apkUrl: apk ? apk.browser_download_url : best.release.html_url,
      pageUrl: best.release.html_url,
    };
  } catch {
    return null; // never block app start on a network/parse error
  }
}
