/**
 * Grouping + date rules behind the appointments agenda.
 *
 * Kept out of the screen so the parts that are easy to get subtly wrong — what
 * counts as overdue, how a day is labelled, how per-day counts are tallied —
 * can be unit-tested without mounting the screen.
 */

const pad2 = n => String(n).padStart(2, '0');

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/** Anything the API might hand us for a date -> 'YYYY-MM-DD' (local), or ''. */
export const toDateKey = value => {
  if (!value) return '';
  if (typeof value === 'string') return value.split('T')[0];
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

export const todayKey = () => toDateKey(new Date());

/**
 * 'YYYY-MM-DD' -> local midnight. The time part matters: `new Date('2026-07-27')`
 * is parsed as UTC, which lands on the previous day west of Greenwich.
 */
export const keyToDate = key => new Date(`${key}T00:00:00`);

/** Whole days from `today` to `key` (negative = past). Rounded, so DST can't shift it. */
export const dayDiff = (key, today = todayKey()) =>
  Math.round((keyToDate(key) - keyToDate(today)) / 86400000);

export const addDays = (key, n) => {
  const d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
};

/** 'Mon, 27 Jul' — '' for anything unparseable, rather than 'undefined, NaN NaN'. */
export const formatDayShort = key => {
  const d = keyToDate(key);
  if (Number.isNaN(d.getTime())) return '';
  return `${DAY_SHORT[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
};

/** 'Mon, 27 Jul 2026' */
export const formatDayFull = key => {
  const short = formatDayShort(key);
  return short ? `${short} ${keyToDate(key).getFullYear()}` : '';
};

/**
 * Headline for a day group. Near dates get a word the doctor can read at a
 * glance; anything past the coming week falls back to the date itself, because
 * "Tuesday" is ambiguous once it could mean either of two Tuesdays.
 */
export const relativeDayLabel = (key, today = todayKey()) => {
  const diff = dayDiff(key, today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return DAY_LONG[keyToDate(key).getDay()];
  return formatDayShort(key);
};

export const parseTimeToMinutes = timeStr => {
  if (!timeStr) return -1;
  const match = String(timeStr).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return -1;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();

  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return -1;

  if (ampm === 'PM' && hours < 12) hours += 12;
  else if (ampm === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
};

export const TIME_WINDOWS = {
  morning: [360, 719],     // 06:00 – 11:59
  afternoon: [720, 1019],  // 12:00 – 16:59
  evening: [1020, 1319],   // 17:00 – 21:59
};

export const matchesTimeSlot = (timeStr, slot) => {
  if (!slot || slot === 'all') return true;
  const window = TIME_WINDOWS[slot];
  if (!window) return true;
  const mins = parseTimeToMinutes(timeStr);
  if (mins === -1) return false;
  return mins >= window[0] && mins <= window[1];
};

/**
 * Time-of-day order, with unreadable times sinking to the bottom of their day
 * instead of floating to the top as a raw -1 would sort them.
 */
export const byTimeAsc = (a, b) => {
  const ma = parseTimeToMinutes(a?.time);
  const mb = parseTimeToMinutes(b?.time);
  if (ma === mb) return 0;
  if (ma === -1) return 1;
  if (mb === -1) return -1;
  return ma - mb;
};

/** { 'YYYY-MM-DD': appointment[] }, each day sorted by start time. */
export const groupByDate = appointments => {
  const groups = {};
  (appointments || []).forEach(appt => {
    const key = toDateKey(appt?.date);
    if (!key) return;
    (groups[key] = groups[key] || []).push(appt);
  });
  Object.values(groups).forEach(list => list.sort(byTimeAsc));
  return groups;
};

/** { 'YYYY-MM-DD': count } — feeds the badges on the date strip and calendar. */
export const countByDate = appointments => {
  const counts = {};
  (appointments || []).forEach(appt => {
    const key = toDateKey(appt?.date);
    if (key) counts[key] = (counts[key] || 0) + 1;
  });
  return counts;
};

/** Past appointments in these states are still the doctor's problem. */
const OPEN_STATUSES = ['pending', 'booked'];

/**
 * The default view: today, then each upcoming day.
 *
 * Past days are dropped except for appointments still pending or booked — those
 * would otherwise vanish the moment the clock passed them, which is exactly
 * when they most need answering.
 */
export const buildAgendaSections = (appointments, today = todayKey()) => {
  const groups = groupByDate(appointments);
  const keys = Object.keys(groups).sort();

  const overdue = [];
  keys.filter(k => k < today).reverse().forEach(k => {
    overdue.push(...groups[k].filter(a => OPEN_STATUSES.includes(a.status)));
  });

  const sections = [];
  if (overdue.length) {
    sections.push({
      key: 'overdue',
      kind: 'overdue',
      title: 'Needs attention',
      subtitle: `${overdue.length} past appointment${overdue.length === 1 ? '' : 's'} still open`,
      data: overdue,
    });
  }

  sections.push({
    key: today,
    kind: 'today',
    dateKey: today,
    title: 'Today',
    subtitle: formatDayShort(today),
    data: groups[today] || [],
  });

  keys.filter(k => k > today).forEach(k => {
    sections.push({
      key: k,
      kind: 'upcoming',
      dateKey: k,
      title: relativeDayLabel(k, today),
      subtitle: formatDayShort(k),
      data: groups[k],
    });
  });

  return sections;
};

/**
 * One section per hand-picked date, in date order. Days the doctor selected
 * that turn out to be empty keep their section — the answer "nothing that day"
 * is the point of asking.
 */
export const buildDateSections = (appointments, dateKeys, today = todayKey()) => {
  const groups = groupByDate(appointments);
  return [...(dateKeys || [])].sort().map(key => ({
    key,
    kind: 'date',
    dateKey: key,
    title: relativeDayLabel(key, today),
    subtitle: formatDayFull(key),
    data: groups[key] || [],
  }));
};

/** The soonest appointment at or after today that hasn't been cancelled. */
export const findNextAppointment = (appointments, today = todayKey()) => {
  const groups = groupByDate(appointments);
  const key = Object.keys(groups).sort().find(k => k >= today && groups[k].some(a => a.status !== 'cancelled'));
  if (!key) return null;
  const appt = groups[key].find(a => a.status !== 'cancelled');
  return { dateKey: key, appointment: appt };
};
