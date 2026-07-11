export const CONTENT_TABS = [
  { key: 'terms', label: 'Terms & Conditions', icon: 'file-document-outline' },
  { key: 'privacy', label: 'Privacy Policy', icon: 'shield-lock-outline' },
];

export const FORMAT_ACTIONS = [
  { key: 'bold', icon: 'format-bold', label: 'Bold' },
  { key: 'italic', icon: 'format-italic', label: 'Italic' },
  { key: 'heading', icon: 'format-size', label: 'Larger' },
  { key: 'small', icon: 'format-text', label: 'Smaller' },
  { key: 'bullet', icon: 'format-list-bulleted', label: 'Bullets' },
];

export const TAG_MAP = {
  bold: { open: '<b>', close: '</b>' },
  italic: { open: '<i>', close: '</i>' },
  heading: { open: '<h3>', close: '</h3>' },
  small: { open: '<small>', close: '</small>' },
  bullet: { open: '\n<li>', close: '</li>' },
};
