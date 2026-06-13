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
        title: 'Yoga Session',
        status: 'Completed',
        date: '10 Jun 2026',
        duration: '15 min',
        painBefore: 7,
        painAfter: 3,
      },
      {
        id: 2,
        title: 'Meditation',
        status: 'Cancelled',
        date: '8 Jun 2026',
        duration: '10 min',
        painBefore: null,
        painAfter: null,
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
