import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import TwoStepScreen from '../screens/TwoStepScreen';
import authService from '../services/authService';
import { showAlert } from '../utils/alert';

jest.mock('../services/authService', () => ({
  __esModule: true,
  default: { completeTwoStep: jest.fn(), cancelTwoStep: jest.fn() },
}));
jest.mock('../utils/alert', () => ({ showAlert: jest.fn() }));

const render = async () => {
  let tree;
  await ReactTestRenderer.act(async () => { tree = ReactTestRenderer.create(<TwoStepScreen />); });
  return tree;
};
const press = async (tree, label) => {
  const btn = tree.root.findAll(
    n => n.type === TouchableOpacity && n.findAllByType(Text).some(t => t.props.children === label),
  )[0];
  await ReactTestRenderer.act(async () => btn.props.onPress());
};
const texts = tree => tree.root.findAllByType(Text).map(t => t.props.children);

describe('TwoStepScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('submits the code and warns when recovery codes run low', async () => {
    authService.completeTwoStep.mockResolvedValue({ user: {}, recoveryCodesLeft: 1 });
    const tree = await render();
    await ReactTestRenderer.act(async () => tree.root.findByType(TextInput).props.onChangeText('123 456'));
    await press(tree, 'Verify');
    expect(authService.completeTwoStep).toHaveBeenCalledWith('123 456');
    expect(showAlert).toHaveBeenCalledWith('Recovery codes running low', expect.stringContaining('1 recovery code left'));
  });

  it('shows the server error and never submits an empty code', async () => {
    authService.completeTwoStep.mockRejectedValue(new Error('That code did not work'));
    const tree = await render();
    await press(tree, 'Verify');
    expect(authService.completeTwoStep).not.toHaveBeenCalled();
    await ReactTestRenderer.act(async () => tree.root.findByType(TextInput).props.onChangeText('000000'));
    await press(tree, 'Verify');
    expect(texts(tree)).toContain('That code did not work');
  });

  it('cancel drops the pending challenge', async () => {
    const tree = await render();
    await press(tree, 'Back to sign in');
    expect(authService.cancelTwoStep).toHaveBeenCalled();
  });
});
