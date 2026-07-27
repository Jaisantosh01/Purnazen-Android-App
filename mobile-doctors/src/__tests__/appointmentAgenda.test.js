import {
  toDateKey,
  dayDiff,
  addDays,
  relativeDayLabel,
  byTimeAsc,
  groupByDate,
  countByDate,
  buildAgendaSections,
  buildDateSections,
  findNextAppointment,
} from '../utils/appointmentAgenda';

const TODAY = '2026-07-27'; // a Monday

const appt = (id, date, time, status = 'booked') => ({ id, date, time, status });

describe('toDateKey', () => {
  it('takes the date half of an ISO timestamp', () => {
    expect(toDateKey('2026-07-27T09:30:00')).toBe('2026-07-27');
    expect(toDateKey('2026-07-27')).toBe('2026-07-27');
  });

  it('formats a Date in local time, not UTC', () => {
    // new Date('2026-07-27') is UTC midnight, which is the 26th west of
    // Greenwich — the key has to come from the local calendar fields.
    expect(toDateKey(new Date(2026, 6, 27, 23, 30))).toBe('2026-07-27');
  });

  it('returns an empty key for missing or unparseable dates', () => {
    expect(toDateKey(null)).toBe('');
    expect(toDateKey(undefined)).toBe('');
    expect(toDateKey(new Date('nope'))).toBe('');
  });
});

describe('day arithmetic', () => {
  it('counts whole days in both directions', () => {
    expect(dayDiff('2026-07-27', TODAY)).toBe(0);
    expect(dayDiff('2026-07-28', TODAY)).toBe(1);
    expect(dayDiff('2026-07-26', TODAY)).toBe(-1);
    expect(dayDiff('2026-08-03', TODAY)).toBe(7);
  });

  it('rolls over month ends', () => {
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDays(TODAY, 13)).toBe('2026-08-09');
  });
});

describe('relativeDayLabel', () => {
  it('names the days around today', () => {
    expect(relativeDayLabel(TODAY, TODAY)).toBe('Today');
    expect(relativeDayLabel('2026-07-28', TODAY)).toBe('Tomorrow');
    expect(relativeDayLabel('2026-07-26', TODAY)).toBe('Yesterday');
  });

  it('uses the weekday inside the coming week', () => {
    expect(relativeDayLabel('2026-07-30', TODAY)).toBe('Thursday');
  });

  it('falls back to a date once a weekday would be ambiguous', () => {
    // Seven days out is another Monday — "Monday" would read as tomorrow-ish.
    expect(relativeDayLabel('2026-08-03', TODAY)).toBe('Mon, 3 Aug');
  });
});

describe('grouping', () => {
  it('sorts each day by start time and sinks unreadable times to the end', () => {
    const list = [
      appt('c', TODAY, '05:00 PM'),
      appt('a', TODAY, '09:00 AM'),
      appt('x', TODAY, ''),
      appt('b', TODAY, '12:30 PM'),
    ];
    const ids = groupByDate(list)[TODAY].map(a => a.id);
    expect(ids).toEqual(['a', 'b', 'c', 'x']);
  });

  it('leaves order alone when neither time can be read', () => {
    expect(byTimeAsc({ time: '' }, { time: null })).toBe(0);
  });

  it('skips rows with no usable date instead of bucketing them under ""', () => {
    const groups = groupByDate([appt('a', TODAY, '09:00 AM'), appt('b', null, '10:00 AM')]);
    expect(Object.keys(groups)).toEqual([TODAY]);
  });

  it('counts per day', () => {
    expect(
      countByDate([
        appt('a', TODAY, '09:00 AM'),
        appt('b', `${TODAY}T00:00:00`, '10:00 AM'),
        appt('c', '2026-07-28', '10:00 AM'),
        appt('d', null, '10:00 AM'),
      ]),
    ).toEqual({ '2026-07-27': 2, '2026-07-28': 1 });
  });
});

describe('buildAgendaSections', () => {
  it('always leads with Today, even when the day is empty', () => {
    const sections = buildAgendaSections([appt('a', '2026-07-29', '09:00 AM')], TODAY);
    expect(sections[0].kind).toBe('today');
    expect(sections[0].title).toBe('Today');
    expect(sections[0].data).toEqual([]);
  });

  it('lists upcoming days after today, in date order', () => {
    const sections = buildAgendaSections(
      [
        appt('later', '2026-07-29', '09:00 AM'),
        appt('soon', '2026-07-28', '09:00 AM'),
        appt('now', TODAY, '09:00 AM'),
      ],
      TODAY,
    );
    expect(sections.map(s => s.title)).toEqual(['Today', 'Tomorrow', 'Wednesday']);
  });

  it('surfaces past appointments that are still open, newest first', () => {
    const sections = buildAgendaSections(
      [
        appt('old-pending', '2026-07-20', '09:00 AM', 'pending'),
        appt('yesterday-booked', '2026-07-26', '09:00 AM', 'booked'),
        appt('done', '2026-07-25', '09:00 AM', 'completed'),
        appt('dropped', '2026-07-25', '10:00 AM', 'cancelled'),
      ],
      TODAY,
    );
    expect(sections[0].kind).toBe('overdue');
    expect(sections[0].data.map(a => a.id)).toEqual(['yesterday-booked', 'old-pending']);
    expect(sections[0].subtitle).toBe('2 past appointments still open');
  });

  it('hides the overdue block when nothing from the past is outstanding', () => {
    const sections = buildAgendaSections(
      [appt('done', '2026-07-25', '09:00 AM', 'completed')],
      TODAY,
    );
    expect(sections.map(s => s.kind)).toEqual(['today']);
  });
});

describe('buildDateSections', () => {
  it('keeps a section per picked day, in order, including the empty ones', () => {
    const sections = buildDateSections(
      [appt('a', '2026-08-05', '09:00 AM')],
      ['2026-08-05', '2026-07-28'],
      TODAY,
    );
    expect(sections.map(s => s.dateKey)).toEqual(['2026-07-28', '2026-08-05']);
    expect(sections[0].data).toEqual([]);
    expect(sections[1].data).toHaveLength(1);
  });
});

describe('findNextAppointment', () => {
  it('skips cancelled rows when reporting what is next', () => {
    const next = findNextAppointment(
      [
        appt('scrapped', '2026-07-28', '09:00 AM', 'cancelled'),
        appt('real', '2026-07-29', '11:00 AM'),
      ],
      TODAY,
    );
    expect(next.appointment.id).toBe('real');
    expect(next.dateKey).toBe('2026-07-29');
  });

  it('returns null when there is nothing left', () => {
    expect(findNextAppointment([appt('a', '2026-07-01', '09:00 AM')], TODAY)).toBeNull();
  });
});
