import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import apiClient from '../../api/client';
import ManagedListScreen, { validateForm } from '../../components/ManagedListScreen';
import { quickReliefConfig } from '../../screens/QuickReliefManagementScreen';
import { supportContactsConfig } from '../../screens/SupportContactsScreen';

jest.mock('../../api/client', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }));
jest.mock('../../utils/toast', () => ({ showError: jest.fn(), showSuccess: jest.fn() }));
jest.mock('../../utils/alert', () => ({ showConfirm: jest.fn((t, m, onOk) => onOk()), showAlert: jest.fn() }));
jest.mock('@react-navigation/native', () => {
  const ReactLib = require('react');
  return {
    NavigationContext: ReactLib.createContext(null),
    useFocusEffect: cb => ReactLib.useEffect(cb, [cb]),
  };
});
jest.setTimeout(30000);

const labelled = (tree, label) =>
  tree.root.findAll(n => n.type === TextInput && n.props.accessibilityLabel === label)[0];
const buttonWithText = (tree, label) =>
  tree.root.findAll(n => n.type === TouchableOpacity && n.findAllByType(Text).some(t => t.props.children === label))[0];

describe('validateForm', () => {
  it('checks required fields, colours and numbers', () => {
    const fields = quickReliefConfig.fields;
    expect(validateForm(fields, { title: '' })).toBe('Title is required');
    expect(validateForm(fields, { title: 'x', background_color: 'green' })).toMatch(/colour/);
    expect(validateForm(fields, { title: 'x', sort_order: '1.5' })).toMatch(/whole number/);
    expect(validateForm(fields, { title: 'x', background_color: '#aabbcc', sort_order: '3' })).toBeNull();
  });
});

describe('quick relief payloads', () => {
  it('derives the link name from the title and normalises blanks', () => {
    const body = quickReliefConfig.toPayload({
      ...quickReliefConfig.emptyItem,
      title: '  Neck & Shoulder Pain ',
      subtitle: '  ',
      background_color: '#e8f8f2',
      sort_order: '4',
    });
    expect(body).toEqual(expect.objectContaining({
      title: 'Neck & Shoulder Pain',
      name: 'Neck & Shoulder Pain',
      slug: 'neck-shoulder-pain',
      subtitle: null,
      background_color: '#E8F8F2',
      sort_order: 4,
    }));
  });
});

describe('support contact payloads', () => {
  it('maps the backend shape to the form and back', () => {
    const item = { id: 'c1', type: 'whatsapp', title: 'WhatsApp', value: '+91 98765 43210', sortOrder: 2 };
    const form = supportContactsConfig.toForm(item);
    expect(form).toEqual(expect.objectContaining({ contact_type: 'whatsapp', sort_order: '2' }));
    expect(supportContactsConfig.toPayload({ ...form, value: ' ' })).toEqual(expect.objectContaining({
      contact_type: 'whatsapp', value: null, icon: 'whatsapp', sort_order: 2,
    }));
    expect(supportContactsConfig.rowSubtitle({ type: 'chat', value: null })).toBe('Live chat · Not set up yet');
  });
});

describe('ManagedListScreen', () => {
  const rows = [
    { id: 'c1', type: 'phone', title: 'Call us', value: '+911234567890', sortOrder: 0, isActive: true },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    apiClient.get.mockResolvedValue({ success: true, data: rows });
  });

  const render = async () => {
    let tree;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(<ManagedListScreen config={supportContactsConfig} />);
    });
    return tree;
  };

  it('lists rows from the admin endpoint', async () => {
    const tree = await render();
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/support/contacts');
    const texts = tree.root.findAllByType(Text).map(t => t.props.children);
    expect(texts).toContain('Call us');
  });

  it('shows the server validation message and keeps the form open', async () => {
    apiClient.put.mockRejectedValue(new Error('Enter a phone number with country code, e.g. +91 98765 43210'));
    const tree = await render();
    await ReactTestRenderer.act(async () => buttonWithText(tree, 'Call us').props.onPress());
    await ReactTestRenderer.act(async () => labelled(tree, 'Number, email or link').props.onChangeText('call me'));
    await ReactTestRenderer.act(async () => buttonWithText(tree, 'Save').props.onPress());

    expect(apiClient.put).toHaveBeenCalledWith('/api/v1/support/contacts/c1', expect.objectContaining({ value: 'call me' }));
    const texts = tree.root.findAllByType(Text).map(t => t.props.children);
    expect(texts).toContain('Enter a phone number with country code, e.g. +91 98765 43210');
  });

  it('blocks saving without a title', async () => {
    const tree = await render();
    await ReactTestRenderer.act(async () =>
      tree.root.findAll(n => n.props.accessibilityLabel === 'Add contact')[0].props.onPress(),
    );
    await ReactTestRenderer.act(async () => buttonWithText(tree, 'Save').props.onPress());
    expect(apiClient.post).not.toHaveBeenCalled();
    const texts = tree.root.findAllByType(Text).map(t => t.props.children);
    expect(texts).toContain('Title is required');
  });

  it('removes a row after confirmation', async () => {
    apiClient.delete.mockResolvedValue({ success: true, data: {} });
    const tree = await render();
    await ReactTestRenderer.act(async () =>
      tree.root.findAll(n => n.props.accessibilityLabel === 'Remove Call us')[0].props.onPress(),
    );
    expect(apiClient.delete).toHaveBeenCalledWith('/api/v1/support/contacts/c1');
  });
});
