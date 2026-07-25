import React from 'react';
import { act } from 'react-test-renderer';
import renderer from 'react-test-renderer';
import TherapyHistoryScreen from '../../screens/TherapyHistoryScreen';

// The screen loads session groups via getSessionGroups() and derives its stats
// from the returned sessions (session-groups refactor). Cards are titled by
// session type — a 'yoga' session renders as "Yoga Session".
jest.mock('../../services/therapyService', () => ({
  getSessionGroups: jest.fn().mockResolvedValue({
    sessions: [
      {
        id: 1,
        sessionType: 'yoga',
        groupTitle: 'Morning Flow',
        groupId: 'g1',
        status: 'Completed',
        completedVideos: 3,
        totalVideos: 3,
        createdAt: '2026-06-10T09:00:00Z',
      },
      {
        id: 2,
        sessionType: 'meditation',
        groupTitle: 'Calm',
        groupId: 'g2',
        status: 'in_progress',
        completedVideos: 1,
        totalVideos: 2,
        createdAt: '2026-06-08T09:00:00Z',
      },
    ],
  }),
  completeSession: jest.fn().mockResolvedValue({}),
}));

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

// Collect visible text from the rendered tree's children only. (JSON.stringify
// on the whole toJSON tree throws on element-valued props like the ScrollView's
// `refreshControl={<RefreshControl/>}` — a circular Fiber reference.)
const flattenText = (node) => {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  // Concatenate (not space-join) so a Text's children like ["Yoga", " Session"]
  // reconstruct as "Yoga Session" rather than gaining a spurious extra space.
  if (Array.isArray(node)) return node.map(flattenText).join('');
  return flattenText(node.children);
};

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
    const allText = flattenText(tree.toJSON());
    expect(allText).toContain('Therapy History');
  });

  it('renders session cards after data loads', async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<TherapyHistoryScreen navigation={navigation} />);
    });
    const allText = flattenText(tree.toJSON());
    expect(allText).toContain('Yoga Session');
  });

  it('shows stats after data loads', async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<TherapyHistoryScreen navigation={navigation} />);
    });
    const allText = flattenText(tree.toJSON());
    expect(allText).toContain('Sessions');
    expect(allText).toContain('Minutes');
  });
});
