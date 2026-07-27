import { parseTimeToMinutes, matchesTimeSlot } from '../utils/appointmentAgenda';

describe('parseTimeToMinutes helper', () => {
  it('correctly parses AM times', () => {
    expect(parseTimeToMinutes('06:00 AM')).toBe(360);
    expect(parseTimeToMinutes('11:59 AM')).toBe(719);
    expect(parseTimeToMinutes('09:30 AM')).toBe(570);
  });

  it('correctly parses PM times', () => {
    expect(parseTimeToMinutes('12:00 PM')).toBe(720);
    expect(parseTimeToMinutes('04:59 PM')).toBe(1019);
    expect(parseTimeToMinutes('05:00 PM')).toBe(1020);
    expect(parseTimeToMinutes('09:59 PM')).toBe(1319);
    expect(parseTimeToMinutes('01:15 PM')).toBe(795);
  });

  it('handles 12 AM and 12 PM boundaries correctly', () => {
    expect(parseTimeToMinutes('12:00 AM')).toBe(0);
    expect(parseTimeToMinutes('12:15 AM')).toBe(15);
    expect(parseTimeToMinutes('12:30 PM')).toBe(750);
  });

  it('returns -1 for invalid inputs', () => {
    expect(parseTimeToMinutes('')).toBe(-1);
    expect(parseTimeToMinutes(null)).toBe(-1);
    expect(parseTimeToMinutes('13:00 AM')).toBe(-1);
    expect(parseTimeToMinutes('12:60 AM')).toBe(-1);
    expect(parseTimeToMinutes('00:30 AM')).toBe(-1);
    expect(parseTimeToMinutes('invalid-time')).toBe(-1);
  });
});

describe('matchesTimeSlot', () => {
  it('keeps everything when no slot is chosen', () => {
    expect(matchesTimeSlot('09:00 AM', 'all')).toBe(true);
    expect(matchesTimeSlot(null, 'all')).toBe(true);
  });

  it('splits the day at the documented boundaries', () => {
    expect(matchesTimeSlot('06:00 AM', 'morning')).toBe(true);
    expect(matchesTimeSlot('11:59 AM', 'morning')).toBe(true);
    expect(matchesTimeSlot('12:00 PM', 'morning')).toBe(false);
    expect(matchesTimeSlot('12:00 PM', 'afternoon')).toBe(true);
    expect(matchesTimeSlot('04:59 PM', 'afternoon')).toBe(true);
    expect(matchesTimeSlot('05:00 PM', 'evening')).toBe(true);
    expect(matchesTimeSlot('09:59 PM', 'evening')).toBe(true);
    expect(matchesTimeSlot('10:00 PM', 'evening')).toBe(false);
  });

  it('drops rows whose time cannot be read once a slot is chosen', () => {
    expect(matchesTimeSlot('', 'morning')).toBe(false);
  });
});
