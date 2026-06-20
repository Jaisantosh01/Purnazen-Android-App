import React from 'react';
import { act } from 'react-test-renderer';
import renderer from 'react-test-renderer';
import ConsultScreen from '../../screens/ConsultScreen';

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'MCIcon');

jest.mock('../../services/consultService', () => ({
  getFilterTabs: jest.fn().mockResolvedValue([
    { id: '1', label: 'All' },
    { id: '2', label: 'Video Call' },
  ]),
  getDoctors: jest.fn().mockResolvedValue({
    doctors: [
      {
        id: 1,
        name: 'Dr. Priya Sharma',
        specialty: 'General Physician',
        rating: 4.8,
        reviews: 120,
        experience: 8,
        location: 'Mumbai',
        fee: 500,
        avatar: '👩‍⚕️',
        tags: ['Video'],
        availability: 'Available Today',
        availableToday: true,
      },
    ],
    hasMore: false,
    total: 1,
  }),
}));

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

// Collect rendered text by walking children only. ConsultScreen's FlatList puts
// a <RefreshControl> element in its props, which has circular fiber refs — so
// JSON.stringify(tree.toJSON()) throws. Walking children avoids those props.
const collectText = (node) => {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(collectText).join(' ');
  return collectText(node.children);
};

describe('ConsultScreen', () => {
  // ConsultScreen runs a 300ms search-debounce timer; unmounting after each
  // test fires the effect cleanup (clearTimeout) so no deferred state update
  // re-renders the component after the Jest environment is torn down.
  let tree;

  const render = async () => {
    await act(async () => {
      tree = renderer.create(<ConsultScreen navigation={navigation} />);
    });
    return tree;
  };

  afterEach(() => {
    if (tree) {
      act(() => tree.unmount());
      tree = null;
    }
  });

  it('renders without crashing', async () => {
    await render();
    expect(tree).toBeTruthy();
  });

  it('shows booking consultation heading', async () => {
    await render();
    expect(collectText(tree.toJSON())).toContain('Book Consultation');
  });

  it('renders doctor card after data loads', async () => {
    await render();
    expect(collectText(tree.toJSON())).toContain('Dr. Priya Sharma');
  });
});
