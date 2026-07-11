export const AUDIENCES = [
  { key: 'all', label: 'Everyone', icon: 'account-group' },
  { key: 'users', label: 'Patients', icon: 'account' },
  { key: 'doctors', label: 'Doctors', icon: 'doctor' },
];

export const SEGMENTS = [
  { key: 'everyone', label: 'All', hint: 'No extra filtering' },
  { key: 'new_users', label: 'New users', hint: 'Joined in the last 30 days' },
  { key: 'inactive_users', label: 'Inactive', hint: 'No appointment in 60 days' },
];

export const CATEGORIES = [
  { key: 'promo', label: 'Promotional', hint: "Respects each user\u2019s offers opt-out" },
  { key: 'system', label: 'Important', hint: 'Delivered to everyone (ignores opt-outs)' },
];

export const GLOBAL_SWITCHES = [
  { key: 'appointmentsEnabled', icon: 'calendar-clock', title: 'Appointment updates', sub: 'Bookings, confirmations, cancellations' },
  { key: 'paymentsEnabled', icon: 'credit-card-outline', title: 'Payment updates', sub: 'Receipts and payment failures' },
  { key: 'promosEnabled', icon: 'tag-outline', title: 'Promotions', sub: 'Offers and marketing broadcasts' },
  { key: 'remindersEnabled', icon: 'bell-ring-outline', title: 'Appointment reminders', sub: 'Scheduled before each appointment' },
];

export const STATUS_CHIP = {
  sent:      { label: 'Sent',      color: '#10B981' },
  scheduled: { label: 'Scheduled', color: '#2563EB' },
  cancelled: { label: 'Cancelled', color: '#9CA3AF' },
};

export const PRESETS = [
  {
    key: 'hour', label: 'In 1 hour',
    make: () => new Date(Date.now() + 60 * 60 * 1000),
  },
  {
    key: 'tonight', label: 'Tonight 7 PM',
    make: () => {
      const d = new Date();
      d.setHours(19, 0, 0, 0);
      if (d <= new Date()) d.setDate(d.getDate() + 1);
      return d;
    },
  },
  {
    key: 'tomorrow', label: 'Tomorrow 9 AM',
    make: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d;
    },
  },
];

export const pad2 = n => String(n).padStart(2, '0');
export const toDateText = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const toTimeText = d => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

export const formatWhen = iso => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) +
    ', ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};
