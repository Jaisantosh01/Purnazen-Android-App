import React from 'react';
import { act } from 'react-test-renderer';
import renderer from 'react-test-renderer';
import TherapyHistoryScreen from '../../screens/TherapyHistoryScreen';

jest.mock('../../services/therapyService', () => ({
  getTherapyHistory: jest.fn().mockResolvedValue({
    stats: { sessions: 3, minutes: 60, avgRelief: 6 },
    sessions: [
      {
        id: 1,
        type: 'wellness',
        videoTitle: 'Yoga Session',
        groupTitle: 'Morning Flow',
        groupId: 'g1',
        status: 'Completed',
        totalSessionsInGroup: 1,
        totalVideosInGroup: 3,
        modifiedAt: '2026-06-10T09:00:00Z',
        createdAt: '2026-06-10T09:00:00Z',
      },
      {
        id: 2,
        type: 'quick_relief',
        videoTitle: 'Meditation',
        groupTitle: 'Calm',
        groupId: 'g2',
        status: 'Cancelled',
        totalSessionsInGroup: 0,
        totalVideosInGroup: 2,
        modifiedAt: '2026-06-08T09:00:00Z',
        createdAt: '2026-06-08T09:00:00Z',
      },
    ],
  }),
}));

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

describe('TherapyHistoryScreen', () => {
  it('renders without crashing', async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<TherapyHistoryScreen navigation={navigation} />);
    });
    expect(tree).toBeTruthy();
  });

  it('shows therapy history heading', async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<TherapyHistoryScreen navigation={navigation} />);
    });
    const allText = JSON.stringify(tree.toJSON());
    expect(allText).toContain('Therapy History');
  });

  it('renders session cards after data loads', async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<TherapyHistoryScreen navigation={navigation} />);
    });
    const allText = JSON.stringify(tree.toJSON());
    expect(allText).toContain('Yoga Session');
  });

  it('shows stats after data loads', async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<TherapyHistoryScreen navigation={navigation} />);
    });
    const allText = JSON.stringify(tree.toJSON());
    expect(allText).toContain('Sessions');
    expect(allText).toContain('Minutes');
  });
});
