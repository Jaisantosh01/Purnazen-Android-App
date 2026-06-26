/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { TextInput, TouchableOpacity, Text } from 'react-native';
import RegisterScreen from '../src/screens/RegisterScreen';
import authService from '../src/services/authService';

jest.mock('../src/services/authService', () => ({
  register: jest.fn(),
}));

const navigation = { replace: jest.fn(), goBack: jest.fn(), navigate: jest.fn() };

const findButtonByText = (root, label) =>
  root
    .findAllByType(TouchableOpacity)
    .find(btn => btn.findAllByType(Text).some(t => t.props.children === label));

async function fillForm(root, { name, email, password, confirm }) {
  const inputs = root.findAllByType(TextInput);
  await ReactTestRenderer.act(async () => {
    inputs[0].props.onChangeText(name);
    inputs[1].props.onChangeText(email);
    inputs[2].props.onChangeText(password);
    inputs[3].props.onChangeText(confirm);
  });
}

describe('RegisterScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders the sign-up form', async () => {
    let tree;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<RegisterScreen navigation={navigation} />);
    });
    expect(tree.root.findAllByType(TextInput)).toHaveLength(4);
    expect(findButtonByText(tree.root, 'Sign Up')).toBeTruthy();
  });

  it('registers on success (nav is driven by the auth-state flip, not replace)', async () => {
    authService.register.mockResolvedValueOnce({ id: 1 });
    let tree;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<RegisterScreen navigation={navigation} />);
    });

    await fillForm(tree.root, {
      name: 'New User',
      email: 'new@example.com',
      password: 'secret123',
      confirm: 'secret123',
    });
    await ReactTestRenderer.act(async () => {
      findButtonByText(tree.root, 'Sign Up').props.onPress();
    });

    expect(authService.register).toHaveBeenCalledWith(
      'New User',
      'new@example.com',
      'secret123',
    );
    // The root navigator (App.tsx) swaps to Main when authStore.isLoggedIn flips,
    // so the screen no longer imperatively replaces to 'Main'.
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it('blocks mismatched passwords without calling the API', async () => {
    let tree;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<RegisterScreen navigation={navigation} />);
    });

    await fillForm(tree.root, {
      name: 'New User',
      email: 'new@example.com',
      password: 'secret123',
      confirm: 'different',
    });
    await ReactTestRenderer.act(async () => {
      findButtonByText(tree.root, 'Sign Up').props.onPress();
    });

    expect(authService.register).not.toHaveBeenCalled();
    const texts = tree.root.findAllByType(Text).map(t => t.props.children);
    expect(texts).toContain('Passwords do not match.');
  });

  it('shows the API error message on failure', async () => {
    authService.register.mockRejectedValueOnce(new Error('Email already exists'));
    let tree;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<RegisterScreen navigation={navigation} />);
    });

    await fillForm(tree.root, {
      name: 'New User',
      email: 'dupe@example.com',
      password: 'secret123',
      confirm: 'secret123',
    });
    await ReactTestRenderer.act(async () => {
      findButtonByText(tree.root, 'Sign Up').props.onPress();
    });

    const texts = tree.root.findAllByType(Text).map(t => t.props.children);
    expect(texts).toContain('Email already exists');
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
