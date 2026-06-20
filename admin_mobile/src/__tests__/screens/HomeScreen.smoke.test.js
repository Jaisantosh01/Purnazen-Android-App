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

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

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
    expect(allText).toContain('PurnaZen');
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
