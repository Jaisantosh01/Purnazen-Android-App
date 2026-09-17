/**
 * Consecutive days of activity ending today or yesterday, from a list of ISO
 * timestamps. Days are taken in local time; a day with any activity counts once.
 */
export default function dayStreak(isoDates, now = new Date()) {
  const day = d => { const x = new Date(d); return Math.floor((x - x.getTimezoneOffset() * 60_000) / 86_400_000); };
  const days = new Set(isoDates.filter(Boolean).map(day));
  let cursor = day(now);
  if (!days.has(cursor)) cursor -= 1; // today not done yet: yesterday keeps the streak alive
  let n = 0;
  while (days.has(cursor)) { n += 1; cursor -= 1; }
  return n;
}
