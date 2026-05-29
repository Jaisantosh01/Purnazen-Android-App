export const BASE_URL = 'http://YOUR_BACKEND_URL';

const V = '';

export const ENDPOINTS = {

  // Auth
  LOGIN:         `${V}/api/auth/login`,

  // Consult
  FILTER_TABS:   `${V}/api/filter-tabs`,
  DOCTORS:       `${V}/api/doctors`,
  DOCTORS_TODAY: `${V}/api/doctors/available-today`,
  DOCTORS_VIDEO: `${V}/api/doctors/video-call`,
  DOCTORS_HOME:  `${V}/api/doctors/home-visit`,
  DOCTORS_TOP:   `${V}/api/doctors/top-rated`,

  // Dynamic endpoints
  DOCTOR_DETAIL:    (id) => `${V}/api/doctors/${id}`,
  VISIT_TYPES:      (id) => `${V}/api/doctors/${id}/visit-types`,
  TIME_SLOTS:       (id) => `${V}/api/doctors/${id}/time-slots`,

  // Booking & Payment
  BOOK_APPOINTMENT: `${V}/api/appointments/book`,
  PAYMENT:          `${V}/api/payments/process`,

  // Wellness Sessions
  ALL_SESSIONS:  `${V}/api/sessions`,
  SESSION:       (key) => `${V}/api/sessions/${key}`,

  // Relief Sessions
  ALL_RELIEF_SESSIONS: `${V}/api/relief-sessions`,
  RELIEF_SESSION:      (key) => `${V}/api/relief-sessions/${key}`,

  // Therapy History
  THERAPY_HISTORY:      `${V}/api/therapy-history`,
  SAVE_THERAPY_SESSION: `${V}/api/therapy-history/save`,

  // Face Glow
  FACE_GLOW_ROUTINES:        `${V}/api/face-glow/routines`,
  FACE_GLOW_ROUTINE:         (key) => `${V}/api/face-glow/routines/${key}`,
  FACE_GLOW_SCAN:            `${V}/api/face-glow/scan`,
  FACE_GLOW_SCAN_HISTORY:    `${V}/api/face-glow/history`,

};
