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

describe('ConsultScreen', () => {
  it('renders without crashing', async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<ConsultScreen navigation={navigation} />);
    });
    expect(tree).toBeTruthy();
  });

  it('shows booking consultation heading', async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<ConsultScreen navigation={navigation} />);
    });
    const allText = JSON.stringify(tree.toJSON());
    expect(allText).toContain('Book Consultation');
  });

  it('renders doctor card after data loads', async () => {
    let tree;
    await act(async () => {
      tree = renderer.create(<ConsultScreen navigation={navigation} />);
    });
    const allText = JSON.stringify(tree.toJSON());
    expect(allText).toContain('Dr. Priya Sharma');
  });
});
