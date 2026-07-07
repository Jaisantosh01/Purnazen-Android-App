import { BASE_URL, API_VERSION } from '../config';

// Re-exported for callers that build absolute URLs; the value itself is
// env-driven — see src/config/index.js.
export { BASE_URL };

export const ENDPOINTS = {

  // Auth
  LOGIN: `${API_VERSION}/auth/login`,
  SOCIAL_LOGIN: `${API_VERSION}/auth/social`,
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

  // Notifications
  NOTIFICATIONS: `${API_VERSION}/notifications`,
  NOTIFICATIONS_READ_ALL: `${API_VERSION}/notifications/read-all`,
  NOTIFICATION_READ: id => `${API_VERSION}/notifications/${id}/read`,
  DEVICE_TOKENS: `${API_VERSION}/notifications/device-tokens`,
  DEVICE_TOKENS_REMOVE: `${API_VERSION}/notifications/device-tokens/remove`,

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
  APPOINTMENTS: `${API_VERSION}/appointments`,
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

  // Face Glow — routines
  FACE_GLOW_ROUTINES: `${API_VERSION}/face-glow/routines`,
  FACE_GLOW_ROUTINE: (key) => `${API_VERSION}/face-glow/routines/${key}`,

  // Consent
  CONSENT: `${API_VERSION}/consent`,

  // Help & Support (admin-configurable contacts + FAQs)
  SUPPORT_HELP: `${API_VERSION}/support/help`,

  // Error reporting
  ERROR_REPORT: `${API_VERSION}/errors/report`,

  // Face Glow — scan pipeline (Sprint 2)
  FACE_GLOW_QUALITY_PREVIEW: `${API_VERSION}/face-glow/quality-preview`,
  FACE_GLOW_SCAN_UPLOAD: `${API_VERSION}/face-glow/scan/upload`,
  FACE_GLOW_SCAN_STATUS: (id) => `${API_VERSION}/face-glow/scan/${id}/status`,
  FACE_GLOW_SCAN_HISTORY: `${API_VERSION}/face-glow/history`,
  FACE_GLOW_SCAN_DELETE: (id) => `${API_VERSION}/face-glow/scan/${id}`,

  // Face Glow — dashboard / trends / compare (Sprint 4)
  FACE_GLOW_DASHBOARD: `${API_VERSION}/face-glow/dashboard`,
  FACE_GLOW_TRENDS: `${API_VERSION}/face-glow/trends`,
  FACE_GLOW_SCAN_COMPARE: (id) => `${API_VERSION}/face-glow/scan/${id}/compare`,

  // Video Groups
  VIDEO_GROUPS: `${API_VERSION}/videos/groups`,
  VIDEO_GROUP_CATALOG: (id) => `${API_VERSION}/videos/groups/${id}/catalog`,

  // Chat
  CHAT_FLOW: (startId) => `${API_VERSION}/chat/flow/${startId}`,

  // Therapy Feedback
  THERAPY_FEEDBACK: `${API_VERSION}/therapy-feedback`,
  THERAPY_FEEDBACK_BY_GROUP: (videoGroupId) => `${API_VERSION}/therapy-feedback/by-group/${videoGroupId}`,
  THERAPY_FEEDBACK_PAIN_AFTER: (feedbackId) => `${API_VERSION}/therapy-feedback/${feedbackId}/pain-after`,

  // Therapy History — completed count
  THERAPY_HISTORY_COMPLETED_COUNT: (groupId) => `${API_VERSION}/therapy-history/completed-count/${groupId}`,

  // User Addresses
  USER_ADDRESSES: `${API_VERSION}/user-addresses`,
  USER_ADDRESS: (id) => `${API_VERSION}/user-addresses/${id}`,

};
