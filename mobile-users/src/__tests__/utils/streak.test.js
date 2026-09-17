import dayStreak from '../../utils/streak';

const at = (daysAgo, now) => new Date(now - daysAgo * 86_400_000).toISOString();

describe('dayStreak', () => {
  const now = new Date('2026-09-17T15:00:00');

  it('counts consecutive days back from today', () => {
    expect(dayStreak([at(0, now), at(1, now), at(1, now), at(2, now), at(4, now)], now)).toBe(3);
  });

  it('survives a day not done yet', () => {
    expect(dayStreak([at(1, now), at(2, now)], now)).toBe(2);
  });

  it('is zero after a two-day gap or with no data', () => {
    expect(dayStreak([at(2, now)], now)).toBe(0);
    expect(dayStreak([], now)).toBe(0);
  });
});
