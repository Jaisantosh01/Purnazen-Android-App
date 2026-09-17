import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import FeedbackReviewScreen, { painSummary } from '../screens/FeedbackReviewScreen';
import feedbackReviewService from '../services/feedbackReviewService';
import { showError, showSuccess } from '../utils/toast';

jest.mock('../services/feedbackReviewService', () => ({
  __esModule: true,
  REVIEWER: 'doctor',
  PAGE_SIZE: 20,
  default: { list: jest.fn(), reply: jest.fn() },
}));
jest.mock('../utils/toast', () => ({ showError: jest.fn(), showSuccess: jest.fn() }));
jest.mock('@react-navigation/native', () => {
  const ReactLib = require('react');
  return {
    NavigationContext: ReactLib.createContext(null),
    useFocusEffect: cb => ReactLib.useEffect(cb, [cb]),
  };
});
jest.setTimeout(30000);

const ITEM = {
  id: 'f1',
  patientName: 'Meera Nair',
  programTitle: 'Neck Relief',
  createdAt: '2026-09-10T10:00:00',
  painBefore: 7,
  painAfter: 3,
  userFeedback: 'Much lighter after the session',
  doctorFeedback: null,
};

const textOf = tree =>
  tree.root.findAllByType(Text).map(t => {
    const c = t.props.children;
    return (Array.isArray(c) ? c : [c]).filter(x => typeof x === 'string' || typeof x === 'number').join('');
  });

const render = async (params) => {
  let tree;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<FeedbackReviewScreen route={{ params }} />);
  });
  return tree;
};

const press = async (tree, label) => {
  const btn = tree.root.findAll(
    n => n.type === TouchableOpacity && n.findAllByType(Text).some(t => t.props.children === label),
  )[0];
  await ReactTestRenderer.act(async () => btn.props.onPress());
};

describe('painSummary', () => {
  it('describes the change in pain', () => {
    expect(painSummary(7, 3)).toEqual({ text: 'Pain 7 → 3', tone: 'better' });
    expect(painSummary(2, 5).tone).toBe('worse');
    expect(painSummary(4, 4).tone).toBe('neutral');
    expect(painSummary(6, null)).toEqual({ text: 'Pain 6/10', tone: 'neutral' });
    expect(painSummary(null, null)).toBeNull();
  });
});

describe('FeedbackReviewScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    feedbackReviewService.list.mockResolvedValue({ items: [ITEM], total: 1, offset: 0 });
  });

  it('loads what is awaiting a reply, scoped to the patient when given', async () => {
    const tree = await render({ patientId: 'p1', patientName: 'Meera Nair' });
    expect(feedbackReviewService.list).toHaveBeenCalledWith({ status: 'pending', patientId: 'p1', offset: 0 });
    const texts = textOf(tree);
    expect(texts).toContain('Meera Nair');
    expect(texts).toContain('Pain 7 → 3');
    expect(texts.some(t => t.includes('Much lighter'))).toBe(true);
  });

  it('switches filter and reloads', async () => {
    const tree = await render();
    await press(tree, 'Replied');
    expect(feedbackReviewService.list).toHaveBeenLastCalledWith({ status: 'reviewed', patientId: undefined, offset: 0 });
  });

  it('sends a reply and drops the record from "Awaiting reply"', async () => {
    feedbackReviewService.reply.mockResolvedValue({ ...ITEM, doctorFeedback: 'Keep going' });
    const tree = await render();
    await press(tree, 'Reply');
    const input = tree.root.findByType(TextInput);
    await ReactTestRenderer.act(async () => input.props.onChangeText('  Keep going  '));
    await press(tree, 'Send reply');

    expect(feedbackReviewService.reply).toHaveBeenCalledWith('f1', 'Keep going');
    expect(showSuccess).toHaveBeenCalled();
    expect(textOf(tree)).not.toContain('Meera Nair');
  });

  it('shows the error and keeps the sheet open when saving fails', async () => {
    feedbackReviewService.reply.mockRejectedValue(new Error('Therapy feedback not found'));
    const tree = await render();
    await press(tree, 'Reply');
    await ReactTestRenderer.act(async () => tree.root.findByType(TextInput).props.onChangeText('Hi'));
    await press(tree, 'Send reply');
    expect(showError).toHaveBeenCalledWith('Therapy feedback not found');
    expect(tree.root.findAllByType(TextInput)).toHaveLength(1);
  });

  it('shows an empty state', async () => {
    feedbackReviewService.list.mockResolvedValue({ items: [], total: 0, offset: 0 });
    const tree = await render();
    expect(textOf(tree)).toContain('All caught up');
  });
});
