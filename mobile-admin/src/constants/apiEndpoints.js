import { BASE_URL, API_VERSION } from '../config';

// Re-exported for callers that build absolute URLs; the value itself is
// env-driven — see src/config/index.js.
export { BASE_URL };

export const ENDPOINTS = {

  // Auth
  LOGIN: `${API_VERSION}/auth/login`,
  SOCIAL_LOGIN: `${API_VERSION}/auth/social`,
  SOCIAL_LINK: `${API_VERSION}/auth/social/link`,
  SOCIAL_UNLINK: `${API_VERSION}/auth/social/unlink`,
  CHANGE_EMAIL: `${API_VERSION}/auth/change-email`,
  REGISTER: `${API_VERSION}/auth/register`,
  LOGOUT: `${API_VERSION}/auth/logout`,
  REFRESH: `${API_VERSION}/auth/refresh`,
  ME: `${API_VERSION}/auth/me`,
  CHANGE_PASSWORD: `${API_VERSION}/auth/change-password`,

  // App releases (OTA) — backend-brokered update check + short-lived SAS download
  APP_RELEASE_LATEST: slug => `${API_VERSION}/app-releases/latest?app=${slug}`,
  APP_RELEASE_DOWNLOAD: (slug, version) =>
    `${API_VERSION}/app-releases/${slug}/${encodeURIComponent(version)}/download`,

  // User preferences
  PREFERENCES: `${API_VERSION}/users/me/preferences`,

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
  DOCTOR_AVAILABILITY: (id) => `${API_VERSION}/doctors/${id}/availability`,
  VISIT_TYPES: (id) => `${API_VERSION}/doctors/${id}/visit-types`,
  TIME_SLOTS: (id) => `${API_VERSION}/doctors/${id}/time-slots`,

  // Booking & Payment
  APPOINTMENTS: `${API_VERSION}/appointments`,
  APPOINTMENTS_ADMIN: `${API_VERSION}/appointments/admin`,
  CONSULTATION_TYPES: `${API_VERSION}/appointments/consultation-types`,
  BOOK_APPOINTMENT: `${API_VERSION}/appointments/book`,
  PAYMENT: `${API_VERSION}/payments/process`,
  PAYMENT_VERIFY: `${API_VERSION}/payments/verify`,

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

  // Video Groups
  VIDEO_GROUPS: `${API_VERSION}/videos/groups`,
  VIDEO_GROUP_CATALOG: (id) => `${API_VERSION}/videos/groups/${id}/catalog`,
  ALL_VIDEOS: `${API_VERSION}/videos`,
  VIDEO_STORAGE_DIRECTORIES: `${API_VERSION}/videos/storage/directories`,
  VIDEO_ADD_FOLDER: `${API_VERSION}/videos/storage/add-folder`,
  VIDEO_UPLOAD: `${API_VERSION}/videos/upload`,
  VIDEO_STORAGE_FILE_INFO: `${API_VERSION}/videos/storage/file-info`,
  VIDEO_STORAGE_MOVE: `${API_VERSION}/videos/storage/move`,
  VIDEO_STORAGE_RENAME: `${API_VERSION}/videos/storage/rename`,
  VIDEO_STORAGE_DELETE_FILE: `${API_VERSION}/videos/storage/file`,

  // Chat
  CHAT_FLOW: (startId) => `${API_VERSION}/chat/flow/${startId}`,

  // Admin
  ADMIN_STATS: `${API_VERSION}/admin/stats`,
  DOCTOR_STATS: `${API_VERSION}/admin/doctors/stats`,
  EXPERTISES: `${API_VERSION}/expertises`,
  LANGUAGES: `${API_VERSION}/languages`,
  SPECIALTIES: `${API_VERSION}/specialties`,
  USERS: `${API_VERSION}/users`,
  ROLES: `${API_VERSION}/roles`,
  SLOT_TIMINGS: `${API_VERSION}/slot-timings`,
  SUPPORT_FAQS: `${API_VERSION}/support-faqs`,
  CONTENT_PAGES: `${API_VERSION}/content-pages`,

  // Notifications (admin)
  NOTIFICATION_SETTINGS: `${API_VERSION}/notifications/admin/settings`,
  NOTIFICATION_BROADCAST: `${API_VERSION}/notifications/admin/broadcast`,
  NOTIFICATION_BROADCASTS: `${API_VERSION}/notifications/admin/broadcasts`,
  NOTIFICATION_BROADCAST_CANCEL: (id) => `${API_VERSION}/notifications/admin/broadcasts/${id}`,
  DOCTOR_LEAVES: `${API_VERSION}/doctor-leaves`,
  DOCTOR_LEAVES_STATS: `${API_VERSION}/doctor-leaves/stats`,
  DOCTOR_LEAVES_UPDATE_STATUS: (id) => `${API_VERSION}/doctor-leaves/${id}/status`,

};
