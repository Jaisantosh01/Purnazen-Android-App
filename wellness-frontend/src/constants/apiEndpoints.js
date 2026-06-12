const IP_ADDRESS = '10.0.2.2';
const BACKEND_PORT = 5000;

export const BASE_URL = `http://${IP_ADDRESS}:${BACKEND_PORT}`;

const API_VERSION = '/api/v1';

export const ENDPOINTS = {

  // Auth
  LOGIN: `${API_VERSION}/auth/login`,
  REGISTER: `${API_VERSION}/auth/register`,
  LOGOUT: `${API_VERSION}/auth/logout`,
  REFRESH: `${API_VERSION}/auth/refresh`,
  ME: `${API_VERSION}/auth/me`,

  // Home
  HOME_QUICK_RELIEF: `${API_VERSION}/home/quick-relief`,

  // Consult
  FILTER_TABS: `${API_VERSION}/filter-tabs`,
  DOCTORS: `${API_VERSION}/doctors`,
  DOCTORS_TODAY: `${API_VERSION}/doctors/available-today`,
  DOCTORS_VIDEO: `${API_VERSION}/doctors/video-call`,
  DOCTORS_HOME: `${API_VERSION}/doctors/home-visit`,
  DOCTORS_TOP: `${API_VERSION}/doctors/top-rated`,

  // Dynamic endpoints
  DOCTOR_DETAIL: (id) => `${API_VERSION}/doctors/${id}`,
  VISIT_TYPES: (id) => `${API_VERSION}/doctors/${id}/visit-types`,
  TIME_SLOTS: (id) => `${API_VERSION}/doctors/${id}/time-slots`,

  // Booking & Payment
  BOOK_APPOINTMENT: `${API_VERSION}/appointments/book`,
  PAYMENT: `${API_VERSION}/payments/process`,

  // Wellness Sessions
  ALL_SESSIONS: `${API_VERSION}/sessions`,
  SESSION: (key) => `${API_VERSION}/sessions/${key}`,

  // Relief Sessions
  ALL_RELIEF_SESSIONS: `${API_VERSION}/relief-sessions`,
  RELIEF_SESSION: (key) => `${API_VERSION}/relief-sessions/${key}`,

  // Therapy History
  THERAPY_HISTORY: `${API_VERSION}/therapy-history`,
  SAVE_THERAPY_SESSION: `${API_VERSION}/therapy-history/save`,

  // Face Glow
  FACE_GLOW_ROUTINES: `${API_VERSION}/face-glow/routines`,
  FACE_GLOW_ROUTINE: (key) => `${API_VERSION}/face-glow/routines/${key}`,
  FACE_GLOW_SCAN: `${API_VERSION}/face-glow/scan`,
  FACE_GLOW_SCAN_HISTORY: `${API_VERSION}/face-glow/history`,

};
