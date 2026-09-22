import React from 'react';
import renderer, { act } from 'react-test-renderer';
import VitalsScanScreen from '../../screens/VitalsScanScreen';

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'MCIcon');

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

const collectText = node => {
  if (node == null) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(collectText).join(' ');
  return collectText(node.children);
};

describe('VitalsScanScreen', () => {
  let tree;
  afterEach(() => { if (tree) { act(() => tree.unmount()); tree = null; } });

  it('renders the unavailable state when the native plugin is missing', async () => {
    await act(async () => { tree = renderer.create(<VitalsScanScreen navigation={navigation} />); });
    const text = collectText(tree.toJSON());
    expect(text).toContain('Vitals Scan');
    expect(text).toContain('Not available in this build');
  });
});
