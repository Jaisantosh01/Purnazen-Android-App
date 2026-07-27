import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import AppointmentsScreen from '../screens/AppointmentsScreen';
import appointmentService from '../services/appointmentService';
import { todayKey, addDays, formatDayShort } from '../utils/appointmentAgenda';

jest.mock('../services/appointmentService', () => ({
  getDoctorAppointments: jest.fn(),
  updateStatus: jest.fn(),
}));

jest.mock('../utils/alert', () => ({ showAlert: jest.fn() }));

// The screen refetches via useFocusEffect, which needs a real navigator. Outside
// one, a plain effect gives the same "run on mount" behaviour under test.
jest.mock('@react-navigation/native', () => {
  const ReactLib = require('react');
  return {
    NavigationContext: ReactLib.createContext(null),
    useFocusEffect: cb => ReactLib.useEffect(cb, [cb]),
  };
});

// The first render pays for transforming the whole screen's module graph.
jest.setTimeout(30000);

const navigation = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => false };

const TODAY = todayKey();
const TOMORROW = addDays(TODAY, 1);

const appt = (id, date, time, extra = {}) => ({
  id,
  date,
  time,
  endTime: null,
  userName: `Patient ${id}`,
  status: 'booked',
  consultationType: 'Clinic Visit',
  ...extra,
});

const mockList = list => {
  appointmentService.getDoctorAppointments.mockResolvedValue({ appointments: list });
};

const render = async () => {
  let tree;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<AppointmentsScreen navigation={navigation} />);
  });
  return tree;
};

const flatText = node => {
  const c = node.props.children;
  return (Array.isArray(c) ? c : [c])
    .map(x => (typeof x === 'string' || typeof x === 'number' ? String(x) : ''))
    .join('');
};

const texts = root => root.findAllByType(Text).map(flatText);

// "Pending" is both a filter chip and a status badge inside a card, and the card
// is itself pressable — so match the tightest wrapper (fewest Text descendants)
// rather than the first one encountered.
const press = async (root, label) => {
  const btn = root
    .findAllByType(TouchableOpacity)
    .filter(b => b.findAllByType(Text).some(t => flatText(t) === label))
    .sort((a, b) => a.findAllByType(Text).length - b.findAllByType(Text).length)[0];
  if (!btn) throw new Error(`No pressable labelled "${label}"`);
  await ReactTestRenderer.act(async () => {
    btn.props.onPress();
  });
};

describe('AppointmentsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockList([]);
  });

  it('fetches once, unfiltered — the counts need every appointment', async () => {
    await render();
    expect(appointmentService.getDoctorAppointments).toHaveBeenCalledTimes(1);
    expect(appointmentService.getDoctorAppointments).toHaveBeenCalledWith({});
  });

  it('opens on the upcoming view with Today first', async () => {
    mockList([appt('1', TODAY, '09:00 AM'), appt('2', TOMORROW, '10:00 AM')]);
    const tree = await render();
    const all = texts(tree.root);

    expect(all).toContain('Upcoming');
    expect(all).toContain('Today');
    expect(all).toContain('Tomorrow');
    expect(all).toContain('Patient 1');
  });

  it('bounds an empty today and points at what is next', async () => {
    mockList([appt('2', TOMORROW, '10:00 AM')]);
    const tree = await render();
    const all = texts(tree.root);

    expect(all).toContain('No more appointments today');
    expect(all).toContain('Next: Tomorrow at 10:00 AM');
  });

  it('narrows to the days picked from the strip, keeping empty ones visible', async () => {
    mockList([appt('1', TODAY, '09:00 AM')]);
    const tree = await render();

    // Tomorrow's pill: weekday initials over the date number.
    const pill = tree.root
      .findAllByType(TouchableOpacity)
      .find(b => b.findAllByType(Text).some(t => flatText(t) === String(new Date(`${TOMORROW}T00:00:00`).getDate())));
    await ReactTestRenderer.act(async () => { pill.props.onPress(); });

    const all = texts(tree.root);
    expect(all).toContain('Tomorrow');
    expect(all).not.toContain('Patient 1');       // today is out of scope now
    expect(all).toContain('Nothing scheduled');   // the picked day stays on screen
    expect(all).toContain('0 appointments');
  });

  it('keeps the filters in a sheet rather than on the list header', async () => {
    mockList([appt('1', TODAY, '09:00 AM'), appt('2', TODAY, '06:00 PM', { status: 'pending' })]);
    const tree = await render();

    expect(texts(tree.root)).not.toContain('Time of day');

    await press(tree.root, 'Filters');
    expect(texts(tree.root)).toContain('Time of day');

    await press(tree.root, 'Pending');
    const all = texts(tree.root);
    expect(all).toContain('Patient 2');
    expect(all).not.toContain('Patient 1');
    expect(all).toContain('Show 1 appointment');
  });

  it('shows the whole day regardless of the hour it is opened', async () => {
    // The old screen defaulted the time filter to the current part of the day,
    // so a doctor opening it after 5pm saw none of the morning's list.
    mockList([appt('1', TODAY, '09:00 AM'), appt('2', TODAY, '06:00 PM')]);
    const tree = await render();
    const all = texts(tree.root);

    expect(all).toContain('Patient 1');
    expect(all).toContain('Patient 2');
    expect(all).toContain('2 appointments');
  });

  it('keeps unresolved past appointments in front of the doctor', async () => {
    const lastWeek = addDays(TODAY, -7);
    mockList([
      appt('old', lastWeek, '09:00 AM', { status: 'pending' }),
      appt('done', lastWeek, '10:00 AM', { status: 'completed' }),
    ]);
    const tree = await render();
    const all = texts(tree.root);

    expect(all).toContain('Needs attention');
    expect(all).toContain('Patient old');
    expect(all).not.toContain('Patient done');
    // Mixed days, so those cards carry their own date.
    expect(all.join(' ')).toContain(formatDayShort(lastWeek));
  });
});
