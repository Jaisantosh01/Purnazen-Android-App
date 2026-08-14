import React from 'react';
import { act } from 'react-test-renderer';
import renderer from 'react-test-renderer';
import TherapyHistoryScreen from '../../screens/TherapyHistoryScreen';

// The screen loads session groups via getSessionGroups() for the cards AND
// getTherapyHistory() for the minutes KPI — both in one Promise.all, so a
// missing mock rejects the pair and drops the screen into its error state.
// (getTherapyHistory was absent here, which is why the two stats assertions
// below were failing on `getTherapyHistory is not a function`.)
// Cards are titled by session type — a 'yoga' session renders as "Yoga Session".
jest.mock('../../services/therapyService', () => ({
  getTherapyHistory: jest.fn().mockResolvedValue({
    stats: { sessions: 2, minutes: 45, avgRelief: 30 },
  }),
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
      {
        id: 3,
        sessionType: 'relief',
        groupTitle: 'Back Relief',
        groupId: 'g3',
        status: 'completed',
        completedVideos: 2,
        totalVideos: 2,
        createdAt: '2026-06-05T09:00:00Z',
        feedback: {
          painBefore: 8,
          painAfter: 3,
          userFeedback: 'Lower back felt much looser afterwards',
        },
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

  it('shows the feedback message left against a session', async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<TherapyHistoryScreen navigation={navigation} />);
    });
    const allText = flattenText(tree.toJSON());
    expect(allText).toContain('Your feedback');
    expect(allText).toContain('Lower back felt much looser afterwards');
  });

  it('omits the feedback block for sessions with none', async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<TherapyHistoryScreen navigation={navigation} />);
    });
    // Only one of the three mocked sessions carries a remark, so the label must
    // not repeat — an empty quote block on the other two would be a regression.
    const allText = flattenText(tree.toJSON());
    expect(allText.match(/Your feedback/g)).toHaveLength(1);
  });
});
