/**
 * Home-screen "Quick relief" cards in the patient app (backend: /quick-relief).
 */
import React from 'react';
import ManagedListScreen from '../components/ManagedListScreen';
import { ENDPOINTS } from '../constants/apiEndpoints';

const slugify = s =>
  String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const blankToNull = v => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());

export const quickReliefConfig = {
  title: 'Quick Relief Cards',
  subtitle: 'Shortcuts on the patient Home screen',
  itemLabel: 'card',
  endpoint: ENDPOINTS.QUICK_RELIEF_ADMIN,
  hint: 'The first three visible cards, in order, appear on Home. Switch a card off to hide it without deleting it.',
  fields: [
    { key: 'title', label: 'Title', placeholder: 'Neck Pain', required: true },
    { key: 'subtitle', label: 'Subtitle', placeholder: 'Relief in 5 minutes' },
    { key: 'slug', label: 'Link name', placeholder: 'neck-pain', autoCapitalize: 'none',
      help: 'Lowercase letters, numbers and dashes. Leave empty to generate it from the title.' },
    { key: 'icon_name', label: 'Icon', placeholder: 'human-handsup', autoCapitalize: 'none',
      help: 'A Material Community Icons name.' },
    { key: 'background_color', label: 'Card colour', type: 'color', placeholder: '#E8F8F2' },
    { key: 'text_color', label: 'Text colour', type: 'color', placeholder: '#1FA77A' },
    { key: 'description', label: 'Description', type: 'multiline' },
    { key: 'sort_order', label: 'Position', type: 'number', placeholder: '0' },
  ],
  emptyItem: { title: '', subtitle: '', slug: '', icon_name: 'spa-outline', background_color: '#E8F8F2',
    text_color: '#1FA77A', description: '', sort_order: '0' },
  isActive: item => item.is_active !== false,
  activePayload: active => ({ is_active: active }),
  rowTitle: item => item.title,
  rowSubtitle: item => [item.subtitle, `Position ${item.sort_order ?? 0}`].filter(Boolean).join(' · '),
  rowIcon: item => item.icon_name || 'spa-outline',
  rowColor: item => item.background_color,
  toForm: item => ({
    title: item.title || '',
    subtitle: item.subtitle || '',
    slug: item.slug || '',
    icon_name: item.icon_name || '',
    background_color: item.background_color || '',
    text_color: item.text_color || '',
    description: item.description || '',
    sort_order: String(item.sort_order ?? 0),
  }),
  toPayload: form => {
    const title = form.title.trim();
    const slug = blankToNull(form.slug) || slugify(title);
    return {
      title,
      name: title.slice(0, 100),
      slug,
      subtitle: blankToNull(form.subtitle),
      icon_name: blankToNull(form.icon_name),
      background_color: blankToNull(form.background_color)?.toUpperCase() ?? null,
      text_color: blankToNull(form.text_color)?.toUpperCase() ?? null,
      description: blankToNull(form.description),
      sort_order: parseInt(form.sort_order || '0', 10) || 0,
    };
  },
  deleteCopy: {
    title: 'Remove card',
    message: item => `“${item.title}” will be removed from the patient Home screen.`,
  },
};

const QuickReliefManagementScreen = () => <ManagedListScreen config={quickReliefConfig} />;

export default QuickReliefManagementScreen;
