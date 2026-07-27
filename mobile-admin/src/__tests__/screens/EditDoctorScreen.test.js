import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, TouchableOpacity } from 'react-native';
import EditDoctorScreen from '../../screens/EditDoctorScreen';
import apiClient from '../../api/client';
import { showAlert } from '../../utils/alert';

jest.mock('../../api/client', () => ({
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
}));

jest.mock('../../utils/alert', () => ({
  showAlert: jest.fn(),
  showConfirm: jest.fn(),
}));

// The first render pays for transforming the whole screen's module graph, which
// alone can outrun the 5s default before any assertion runs.
jest.setTimeout(30000);

const navigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  canGoBack: () => true,
};

// The screen fans out one GET per lookup table on mount; resolve them all by URL
// so the form leaves its loading skeleton.
const mockLookups = () => {
  apiClient.get.mockImplementation(url => {
    if (url.includes('consultation-type')) {
      return Promise.resolve({ data: [{ id: 1, name: 'Video' }] });
    }
    return Promise.resolve({ data: [] });
  });
};

const render = async (params = {}) => {
  let tree;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <EditDoctorScreen route={{ params }} navigation={navigation} />,
    );
  });
  return tree;
};

const texts = root => root.findAllByType(Text).flatMap(t => {
  const c = t.props.children;
  return Array.isArray(c) ? c.filter(x => typeof x === 'string') : typeof c === 'string' ? [c] : [];
});

const pressText = async (root, label) => {
  const btn = root
    .findAllByType(TouchableOpacity)
    .find(b => b.findAllByType(Text).some(t => t.props.children === label));
  await ReactTestRenderer.act(async () => { btn.props.onPress(); });
  return btn;
};

describe('EditDoctorScreen steps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLookups();
  });

  it('opens on the first step and shows the step chips', async () => {
    const tree = await render({ doctorId: null });
    const all = texts(tree.root);
    expect(all).toContain('Step 1 of 6 · Account');
    expect(all).toContain('Account');
    expect(all).toContain('Awards');
    // Nothing to go back to on step one; Next is the only way forward.
    expect(all).toContain('Next');
    expect(all).not.toContain('Complete');
  });

  it('Next advances a step and Back returns', async () => {
    const tree = await render({ doctorId: null });

    await pressText(tree.root, 'Next');
    expect(texts(tree.root)).toContain('Step 2 of 6 · Profile');

    await pressText(tree.root, 'Back');
    expect(texts(tree.root)).toContain('Step 1 of 6 · Account');
  });

  it('flags what a step is missing once it has been left', async () => {
    const tree = await render({ doctorId: null });
    await pressText(tree.root, 'Next');
    // Account was left blank, so its missing columns are named on return.
    await pressText(tree.root, 'Back');
    const all = texts(tree.root).join(' ');
    expect(all).toContain('Full Name');
    expect(all).toContain('Email');
    expect(all).toContain('Password');
  });

  it('the last step offers Complete instead of Next', async () => {
    const tree = await render({ doctorId: null });
    for (let i = 0; i < 5; i++) await pressText(tree.root, 'Next');
    const all = texts(tree.root);
    expect(all).toContain('Step 6 of 6 · Awards');
    expect(all).toContain('Complete');
    expect(all).not.toContain('Next');
  });

  it('saving an incomplete form returns to the first bad step instead of posting', async () => {
    const tree = await render({ doctorId: null });
    for (let i = 0; i < 5; i++) await pressText(tree.root, 'Next');

    await pressText(tree.root, 'Complete');

    expect(apiClient.post).not.toHaveBeenCalled();
    expect(showAlert).toHaveBeenCalled();
    expect(texts(tree.root)).toContain('Step 1 of 6 · Account');
  });
});
