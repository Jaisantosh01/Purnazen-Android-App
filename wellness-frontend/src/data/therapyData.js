// Later: replace this with an API call
// Example: const response = await fetch('https://your-api.com/therapy-history');

export const THERAPY_STATS = {
  sessions: 5,
  minutes: 70,
  avgRelief: -5,
};

export const THERAPY_SESSIONS = [
  {
    id: '1',
    title: 'Headache Relief',
    date: 'March 18, 2026',
    duration: '15 min',
    status: 'Completed',
    painBefore: 8,
    painAfter: 3,
  },
  {
    id: '2',
    title: 'Back Pain Therapy',
    date: 'March 15, 2026',
    duration: '20 min',
    status: 'Completed',
    painBefore: 7,
    painAfter: 2,
  },
  {
    id: '3',
    title: 'Stress Relief',
    date: 'March 12, 2026',
    duration: '10 min',
    status: 'Completed',
    painBefore: 6,
    painAfter: 1,
  },
  {
    id: '4',
    title: 'Neck Pain Relief',
    date: 'March 10, 2026',
    duration: '15 min',
    status: 'Completed',
    painBefore: 9,
    painAfter: 4,
  },
  {
    id: '5',
    title: 'Anxiety Relief',
    date: 'March 8, 2026',
    duration: '10 min',
    status: 'Completed',
    painBefore: 5,
    painAfter: 1,
  },
  {
    id: '6',
    title: 'Shoulder Pain',
    date: 'March 5, 2026',
    duration: '20 min',
    status: 'Cancelled',
    painBefore: null,
    painAfter: null,
  },
];