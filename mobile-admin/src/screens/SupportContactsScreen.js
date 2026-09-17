/**
 * Help & Support contact channels shown in the patient app
 * (backend: /support/contacts). The value is what a patient's phone opens.
 */
import React from 'react';
import ManagedListScreen from '../components/ManagedListScreen';
import { ENDPOINTS } from '../constants/apiEndpoints';

const TYPES = [
  { value: 'phone', label: 'Phone', icon: 'phone-outline', placeholder: '+91 98765 43210' },
  { value: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp', placeholder: '+91 98765 43210' },
  { value: 'email', label: 'Email', icon: 'email-outline', placeholder: 'care@purnazen.com' },
  { value: 'chat', label: 'Live chat', icon: 'chat-outline', placeholder: 'https://…' },
  { value: 'other', label: 'Link', icon: 'link-variant', placeholder: 'https://…' },
];
const typeMeta = t => TYPES.find(x => x.value === t) || TYPES[4];
const blankToNull = v => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());

export const supportContactsConfig = {
  title: 'Support Contacts',
  subtitle: 'How patients reach you from Help & Support',
  itemLabel: 'contact',
  endpoint: ENDPOINTS.SUPPORT_CONTACTS,
  hint: 'Patients tap these to call, message or email you. Numbers need the country code. A contact with no value shows as “coming soon”.',
  fields: [
    { key: 'contact_type', label: 'Type', type: 'choice', required: true,
      options: TYPES.map(({ value, label }) => ({ value, label })) },
    { key: 'title', label: 'Title', placeholder: 'Call us', required: true },
    { key: 'subtitle', label: 'Subtitle', placeholder: 'Mon–Sat, 9am–7pm' },
    { key: 'value', label: 'Number, email or link', autoCapitalize: 'none', keyboardType: 'default',
      help: 'Checked against the type before it is saved.' },
    { key: 'sort_order', label: 'Position', type: 'number', placeholder: '0' },
  ],
  emptyItem: { contact_type: 'phone', title: '', subtitle: '', value: '', sort_order: '0' },
  isActive: item => item.isActive !== false,
  activePayload: active => ({ is_active: active }),
  rowTitle: item => item.title,
  rowSubtitle: item => [typeMeta(item.type).label, item.value || 'Not set up yet'].join(' · '),
  rowIcon: item => typeMeta(item.type).icon,
  toForm: item => ({
    contact_type: item.type || 'phone',
    title: item.title || '',
    subtitle: item.subtitle || '',
    value: item.value || '',
    sort_order: String(item.sortOrder ?? 0),
  }),
  toPayload: form => ({
    contact_type: form.contact_type,
    title: form.title.trim(),
    subtitle: blankToNull(form.subtitle),
    value: blankToNull(form.value),
    icon: typeMeta(form.contact_type).icon,
    sort_order: parseInt(form.sort_order || '0', 10) || 0,
  }),
  deleteCopy: {
    title: 'Remove contact',
    message: item => `“${item.title}” will no longer appear in Help & Support.`,
  },
};

const SupportContactsScreen = () => <ManagedListScreen config={supportContactsConfig} />;

export default SupportContactsScreen;
