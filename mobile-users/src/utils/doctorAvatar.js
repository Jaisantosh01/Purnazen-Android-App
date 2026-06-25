/**
 * doctorInitial — first letter of a doctor's name for the avatar fallback.
 *
 * The backend no longer sends an emoji avatar (it rendered inconsistently / as
 * "?" across devices); when there's no avatar image we show the initial in a
 * coloured circle instead, matching the user-profile pattern.
 */
export function doctorInitial(name) {
  const cleaned = String(name || '')
    .replace(/^\s*dr\.?\s*/i, '') // drop the "Dr." prefix
    .trim();
  return (cleaned.charAt(0) || 'D').toUpperCase();
}

export default doctorInitial;
