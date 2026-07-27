import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import NotificationAdminScreen from '../../screens/NotificationAdminScreen';
import apiClient from '../../api/client';

jest.mock('../../api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

jest.mock('../../utils/alert', () => ({
  showAlert: jest.fn(),
  showConfirm: jest.fn(),
}));

jest.setTimeout(30000);

const navigation = { goBack: jest.fn(), canGoBack: () => true };

const SETTINGS = {
  appointmentsEnabled: true,
  paymentsEnabled: true,
  promosEnabled: true,
  remindersEnabled: true,
  reminderLeadMinutes: 60,
};

const mockApi = (settings = SETTINGS, broadcasts = []) => {
  apiClient.get.mockImplementation(url =>
    url.includes('settings')
      ? Promise.resolve({ data: settings })
      : Promise.resolve({ data: { broadcasts } }),
  );
};

const render = async () => {
  let tree;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<NotificationAdminScreen navigation={navigation} />);
  });
  return tree;
};

const texts = root =>
  root.findAllByType(Text).flatMap(t => {
    const c = t.props.children;
    const flat = Array.isArray(c) ? c : [c];
    return flat.filter(x => typeof x === 'string');
  });

// Some labels are built from several children ("Scheduled", " (", 1, ")"), so
// match on the concatenation rather than a single string child.
const flatText = node => {
  const c = node.props.children;
  return (Array.isArray(c) ? c : [c])
    .map(x => (typeof x === 'string' || typeof x === 'number' ? String(x) : ''))
    .join('');
};

const press = async (root, label) => {
  const btn = root
    .findAllByType(TouchableOpacity)
    .find(b => b.findAllByType(Text).some(t => flatText(t) === label));
  await ReactTestRenderer.act(async () => { btn.props.onPress(); });
};

describe('NotificationAdminScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApi();
  });

  it('opens on Compose with the config blocks collapsed to summaries', async () => {
    const tree = await render();
    const all = texts(tree.root);

    expect(all).toContain('Audience');
    expect(all).toContain('Delivery');
    // Summaries are visible; the chips inside them are not rendered until opened.
    expect(all).toContain('Everyone');
    expect(all).toContain('Send now');
    expect(all).not.toContain('Narrow it down');
  });

  it('expanding Audience reveals its controls, and only one block stays open', async () => {
    const tree = await render();

    await press(tree.root, 'Audience');
    expect(texts(tree.root)).toContain('Narrow it down');

    await press(tree.root, 'Delivery');
    const all = texts(tree.root);
    expect(all).not.toContain('Narrow it down');
    expect(all).toContain('Schedule');
  });

  it('previews the message and expands the {name} token', async () => {
    const tree = await render();
    const inputs = tree.root.findAllByType(TextInput);

    await ReactTestRenderer.act(async () => {
      inputs[0].props.onChangeText('Hi {name}');
    });

    expect(texts(tree.root)).toContain('Hi Priya');
  });

  it('warns and blocks nothing but explains when promos are globally off', async () => {
    mockApi({ ...SETTINGS, promosEnabled: false });
    const tree = await render();

    const all = texts(tree.root).join(' ');
    expect(all).toContain('Promotions are off globally');
  });

  it('keeps global switches and reminders on their own tab', async () => {
    const tree = await render();
    expect(texts(tree.root)).not.toContain('Appointment reminders');

    await press(tree.root, 'Settings');
    const all = texts(tree.root);
    expect(all).toContain('Appointment reminders');
    expect(all).toContain('Custom lead time');
  });

  it('History lists broadcasts and filters them by status', async () => {
    mockApi(SETTINGS, [
      { id: '1', title: 'Sent one', body: 'b', audience: 'all', segment: 'everyone', category: 'promo', status: 'sent', recipients: 4 },
      { id: '2', title: 'Future one', body: 'b', audience: 'all', segment: 'everyone', category: 'promo', status: 'scheduled', scheduledAt: '2030-01-01T09:00:00' },
    ]);
    const tree = await render();

    await press(tree.root, 'History');
    expect(texts(tree.root)).toContain('Sent one');

    await press(tree.root, 'Scheduled (1)');
    const all = texts(tree.root);
    expect(all).toContain('Future one');
    expect(all).not.toContain('Sent one');
  });
});
