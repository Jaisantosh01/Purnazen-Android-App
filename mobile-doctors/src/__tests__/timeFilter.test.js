const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return -1;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return -1;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
    return -1;
  }
  
  if (ampm === 'PM' && hours < 12) {
    hours += 12;
  } else if (ampm === 'AM' && hours === 12) {
    hours = 0;
  }
  return hours * 60 + minutes;
};

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
