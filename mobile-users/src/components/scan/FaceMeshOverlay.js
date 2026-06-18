import React from 'react';
import Svg, { Circle, Ellipse, Line } from 'react-native-svg';

/**
 * Draws the face-mesh landmarks returned by the backend over the captured still.
 *
 * Props:
 *   landmarks  - { type:'mesh', points:[[x,y]...] } | { type:'bbox', rect:[x,y,w,h] }
 *                with all values normalized 0..1. May be null while detecting.
 *   activeZone - one of ZONE_INDICES keys (or 'all') to highlight the feature
 *                currently being analysed.
 *   width,height - pixel size of the overlay area (matches the displayed image).
 *   scanY      - optional 0..1 vertical position for the animated scan line.
 */

// MediaPipe FaceLandmarker indices per facial zone (mirrors the backend
// image_preprocessor._ZONE_INDICES so the highlight lines up with the ROIs).
export const ZONE_INDICES = {
  forehead:    [10, 151, 9, 8, 67, 109, 297, 338],
  cheeks:      [116, 123, 187, 207, 345, 352, 411, 427],
  under_eyes:  [226, 227, 228, 229, 230, 231, 446, 447, 448, 449, 450, 451],
  t_zone:      [1, 4, 19, 94, 164, 2],
  jawline:     [172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365],
};

const ACCENT = '#C850C0';

const FaceMeshOverlay = ({ landmarks, activeZone = 'all', width, height, scanY }) => {
  if (!width || !height) return null;

  // Fallback: only a bounding box is available — draw a guide oval.
  if (landmarks?.type === 'bbox' && Array.isArray(landmarks.rect)) {
    const [rx, ry, rw, rh] = landmarks.rect;
    return (
      <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Ellipse
          cx={(rx + rw / 2) * width}
          cy={(ry + rh / 2) * height}
          rx={(rw / 2) * width}
          ry={(rh / 2) * height}
          stroke={ACCENT}
          strokeWidth={2}
          strokeDasharray="6 6"
          fill="rgba(200,80,192,0.06)"
        />
        {scanY != null && (
          <Line x1={0} y1={scanY * height} x2={width} y2={scanY * height} stroke={ACCENT} strokeWidth={2} opacity={0.7} />
        )}
      </Svg>
    );
  }

  const points = landmarks?.type === 'mesh' && Array.isArray(landmarks.points) ? landmarks.points : null;
  if (!points) {
    // Detecting — show just the animated scan line if provided.
    return scanY != null ? (
      <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
        <Line x1={0} y1={scanY * height} x2={width} y2={scanY * height} stroke={ACCENT} strokeWidth={2} opacity={0.7} />
      </Svg>
    ) : null;
  }

  const activeSet =
    activeZone && activeZone !== 'all' && ZONE_INDICES[activeZone]
      ? new Set(ZONE_INDICES[activeZone])
      : null;

  return (
    <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
      {/* Faint full mesh */}
      {points.map((p, i) => {
        const isActive = activeSet?.has(i);
        if (isActive) return null; // drawn brighter below
        return (
          <Circle key={i} cx={p[0] * width} cy={p[1] * height} r={0.9} fill={ACCENT} opacity={0.28} />
        );
      })}

      {/* Highlighted active-zone points */}
      {activeSet &&
        points.map((p, i) =>
          activeSet.has(i) ? (
            <Circle key={`a${i}`} cx={p[0] * width} cy={p[1] * height} r={3} fill={ACCENT} opacity={0.95} />
          ) : null,
        )}

      {scanY != null && (
        <Line x1={0} y1={scanY * height} x2={width} y2={scanY * height} stroke={ACCENT} strokeWidth={2} opacity={0.6} />
      )}
    </Svg>
  );
};

export default FaceMeshOverlay;
