import React, { useCallback, useState } from 'react';
import VideoDurationProbe from '../components/VideoDurationProbe';

/**
 * Auto-fills the `duration` of queued upload items by probing each local file
 * once, one at a time. Returns a JSX element to render somewhere in the tree
 * (it's invisible) plus a `pendingProbe` flag so callers can tell the user
 * detection is still running.
 *
 * Each file is probed at most once: if detection fails or the user clears the
 * field afterwards we don't re-probe, so manual edits always win.
 */
export default function useDurationProbe(items, updateItem) {
  const [probedIds, setProbedIds] = useState(() => new Set());

  const next = items.find(
    (it) =>
      it.status !== 'done' &&
      it.file?.uri &&
      !String(it.duration || '').trim() &&
      !probedIds.has(it.id),
  );

  const handleDone = useCallback(
    (id, seconds) => {
      setProbedIds((prev) => {
        const n = new Set(prev);
        n.add(id);
        return n;
      });
      if (seconds && seconds > 0) updateItem(id, { duration: String(seconds) });
    },
    [updateItem],
  );

  const probeElement = next ? (
    <VideoDurationProbe key={next.id} uri={next.file.uri} onDone={(secs) => handleDone(next.id, secs)} />
  ) : null;

  return { probeElement, pendingProbe: !!next };
}
