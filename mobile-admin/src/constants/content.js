export const CONTENT_TABS = [
  { key: 'terms', label: 'Terms & Conditions', icon: 'file-document-outline' },
  { key: 'privacy', label: 'Privacy Policy', icon: 'shield-lock-outline' },
];

/**
 * Per-content-type hints for the editor. Writing a privacy policy and writing
 * terms are different jobs, so the prompts (and the starter outline) follow the
 * type the admin picked rather than always describing terms.
 */
export const CONTENT_PLACEHOLDERS = {
  terms: {
    title: 'e.g. Terms & Conditions v2',
    content:
      'Write the terms of service here — who may use the app, what they agree to, and the limits of that agreement.',
    outline: [
      '# Terms & Conditions',
      '',
      '## 1. Acceptance of Terms',
      'By creating an account or using Purnazen you agree to these terms.',
      '',
      '## 2. Who Can Use the Service',
      'Eligibility, account accuracy, and one-account-per-person rules.',
      '',
      '## 3. Bookings, Payments and Cancellations',
      'How appointments are booked, charged, rescheduled and refunded.',
      '',
      '## 4. Acceptable Use',
      'What users must not do with the app or its content.',
      '',
      '## 5. Medical Disclaimer',
      'The app supports wellness and does not replace professional medical advice.',
      '',
      '## 6. Limitation of Liability',
      '',
      '## 7. Changes to These Terms',
      '',
      '## 8. Contact Us',
    ].join('\n'),
  },
  privacy: {
    title: 'e.g. Privacy Policy v2',
    content:
      'Write the privacy policy here — what personal data is collected, why, who it is shared with, and how users control it.',
    outline: [
      '# Privacy Policy',
      '',
      '## 1. Information We Collect',
      'Account details, health and wellness inputs, scan images, device and usage data.',
      '',
      '## 2. How We Use Your Information',
      'Delivering consultations, personalising recommendations, and improving the service.',
      '',
      '## 3. Health Data and Scans',
      'How face/tongue scan images and results are stored, retained and deleted.',
      '',
      '## 4. Sharing and Disclosure',
      'Doctors involved in your care, service providers, and legal requirements.',
      '',
      '## 5. Data Retention',
      '',
      '## 6. Your Rights and Choices',
      'Accessing, exporting, correcting and deleting your data; withdrawing consent.',
      '',
      '## 7. Security',
      '',
      '## 8. Children’s Privacy',
      '',
      '## 9. Changes to This Policy',
      '',
      '## 10. Contact Us',
    ].join('\n'),
  },
};

export const FORMAT_ACTIONS = [
  { key: 'bold', icon: 'format-bold', label: 'Bold' },
  { key: 'italic', icon: 'format-italic', label: 'Italic' },
  { key: 'heading', icon: 'format-size', label: 'Larger' },
  { key: 'small', icon: 'format-text', label: 'Smaller' },
  { key: 'bullet', icon: 'format-list-bulleted', label: 'Bullets' },
];
