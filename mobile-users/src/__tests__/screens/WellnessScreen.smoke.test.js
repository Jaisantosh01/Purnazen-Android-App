import React from 'react';
import renderer, { act } from 'react-test-renderer';
import WellnessScreen from '../../screens/WellnessScreen';

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'MCIcon');

jest.mock('../../services/wellnessService', () => ({
  getAllSessions: jest.fn().mockResolvedValue({
    sessions: [
      { id: 'p1', title: 'Morning Yoga', duration: '20 min', icon: 'yoga', videoGroupId: 'g1' },
      { id: 'p2', title: 'Box Breathing', duration: '10 min', icon: 'heart', videoGroupId: null },
    ],
  }),
}));

jest.mock('../../services/therapyService', () => ({
  getSessionGroups: jest.fn().mockResolvedValue({
    sessions: [
      { id: 'run-open', groupId: 'g1', sessionType: 'wellness', status: 'in_progress', completedVideos: 2, totalVideos: 5, createdAt: new Date().toISOString() },
      { id: 'run-done', groupId: 'g1', sessionType: 'wellness', status: 'completed', completedVideos: 5, totalVideos: 5, createdAt: new Date().toISOString() },
    ],
  }),
  getTherapyHistory: jest.fn().mockResolvedValue({ stats: { sessions: 7, minutes: 120 } }),
}));

const navigation = { navigate: jest.fn() };

// Same as the Therapy History smoke test: JSON.stringify chokes on the
// ScrollView's element-valued refreshControl prop.
const flattenText = node => {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join('');
  return flattenText(node.children);
};

const render = async () => {
  let tree;
  await act(async () => { tree = renderer.create(<WellnessScreen navigation={navigation} />); });
  return tree;
};

describe('WellnessScreen', () => {
  it('shows stats, the resume card and program progress', async () => {
    const text = flattenText((await render()).toJSON());
    expect(text).toContain('Resume');
    expect(text).toContain('2 of 5 videos done');
    expect(text).toContain('Done');
    expect(text).toContain('2/5');
    expect(text).toContain('Coming soon');
    expect(text).toContain('120');
  });

  it('resumes the open run when its program is tapped', async () => {
    const tree = await render();
    const label = tree.root.findAll(n => n.props.children === 'CONTINUE')[0];
    let btn = label.parent;
    while (!btn.props.onPress) btn = btn.parent;
    act(() => btn.props.onPress());
    expect(navigation.navigate).toHaveBeenCalledWith('VideoPlayer', expect.objectContaining({
      groupId: 'g1', sessionGroupId: 'run-open', sessionType: 'wellness',
    }));
  });
});
