/**
 * Coordinate helpers for the clinic location fields.
 *
 * Admins realistically get a clinic's position by copying it out of Google Maps,
 * so `parseCoordinates` accepts everything that ends up on the clipboard from
 * there — a bare "lat, lng" pair or any of the Maps URL shapes — rather than
 * forcing them to split the numbers by hand.
 */

const LAT_MIN = -90;
const LAT_MAX = 90;
const LNG_MIN = -180;
const LNG_MAX = 180;

/** A signed decimal pair, e.g. "12.9716, 77.5946" (comma or whitespace). */
const PAIR_RE = /(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)/;

export const isValidLatitude = value =>
  Number.isFinite(value) && value >= LAT_MIN && value <= LAT_MAX;

export const isValidLongitude = value =>
  Number.isFinite(value) && value >= LNG_MIN && value <= LNG_MAX;

/**
 * Pull a { latitude, longitude } pair out of pasted text, or null when the
 * text holds no usable coordinates.
 *
 * Handles: "12.97, 77.59", "?q=12.97,77.59", "/@12.97,77.59,17z",
 * "!3d12.97!4d77.59", and "ll=12.97,77.59".
 */
export const parseCoordinates = text => {
  if (typeof text !== 'string' || !text.trim()) return null;
  const input = text.trim();

  // Maps place URLs carry the precise pin as !3d<lat>!4d<lng>; the /@ segment is
  // only the viewport centre, so prefer the former when both are present.
  const pinMatch = input.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const candidates = [
    pinMatch && [pinMatch[1], pinMatch[2]],
    ...[/[?&](?:q|ll|daddr|sll|center)=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/, /@(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/]
      .map(re => {
        const m = input.match(re);
        return m && [m[1], m[2]];
      }),
  ].filter(Boolean);

  if (!candidates.length) {
    const pair = input.match(PAIR_RE);
    // Only treat a bare pair as coordinates when that is all the text is —
    // otherwise stray numbers in an address would be read as a location.
    if (pair && pair[0].trim() === input) candidates.push([pair[1], pair[2]]);
  }

  for (const [rawLat, rawLng] of candidates) {
    const latitude = Number(rawLat);
    const longitude = Number(rawLng);
    if (isValidLatitude(latitude) && isValidLongitude(longitude)) {
      return { latitude, longitude };
    }
  }
  return null;
};

/** Maps deep link for previewing a coordinate pair. */
export const mapsUrl = (latitude, longitude) =>
  `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

/**
 * Validate the lat/long a clinic form currently holds.
 * Returns null when valid (including "both blank" — location is optional).
 */
export const validateClinicLocation = (latitude, longitude) => {
  const latBlank = latitude === '' || latitude === null || latitude === undefined;
  const lngBlank = longitude === '' || longitude === null || longitude === undefined;

  if (latBlank && lngBlank) return null;
  if (latBlank || lngBlank) return 'Enter both latitude and longitude, or leave both blank.';
  if (!isValidLatitude(Number(latitude))) return 'Latitude must be a number between -90 and 90.';
  if (!isValidLongitude(Number(longitude))) return 'Longitude must be a number between -180 and 180.';
  return null;
};
