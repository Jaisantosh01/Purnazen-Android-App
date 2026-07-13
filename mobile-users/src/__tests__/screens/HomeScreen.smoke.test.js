import React from 'react';
import { act } from 'react-test-renderer';
import renderer from 'react-test-renderer';
import HomeScreen from '../../screens/HomeScreen';

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'MCIcon');

jest.mock('../../api/client', () => ({
  get: jest.fn().mockResolvedValue({ data: [] }),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

jest.mock('../../services/wellnessService', () => ({
  getAllSessions: jest.fn().mockResolvedValue({
    sessions: [
      { key: 'YogaSession', title: 'Yoga', duration: '15 min' },
    ],
  }),
}));

jest.mock('../../services/notificationsService', () => ({
  unreadCount: jest.fn().mockResolvedValue(0),
}));

const navigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  // Home subscribes to 'focus' to refresh the notification badge
  addListener: jest.fn(() => jest.fn()),
};

describe('HomeScreen', () => {
  it('renders without crashing', async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<HomeScreen navigation={navigation} />);
    });
    expect(tree).toBeTruthy();
  });

  it('shows the app title', async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<HomeScreen navigation={navigation} />);
    });
    const json = tree.toJSON();
    const allText = JSON.stringify(json);
    expect(allText).toContain('Purnazen');
  });

  it('shows wellness section heading after load', async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<HomeScreen navigation={navigation} />);
    });
    const allText = JSON.stringify(tree.toJSON());
    expect(allText).toContain('Wellness');
  });
});
