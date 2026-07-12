import { BASE_URL, API_VERSION } from '../config';

// Re-exported for callers that build absolute URLs; the value itself is
// env-driven — see src/config/index.js.
export { BASE_URL };

/**
 * Backend endpoints the doctor app uses. These point at the SAME FastAPI
 * server as the patient app. Endpoints marked TODO are referenced by the
 * scaffolded screens but may need backend additions (e.g. a doctor-scoped
 * "my appointments" / "my patients" view) — wire them up during feature dev.
 */
export const ENDPOINTS = {
  // Auth (shared with patients; doctors log in with their own accounts)
  LOGIN: `${API_VERSION}/auth/login`,
  SOCIAL_LOGIN: `${API_VERSION}/auth/social`,
  SOCIAL_LINK: `${API_VERSION}/auth/social/link`,
  SOCIAL_UNLINK: `${API_VERSION}/auth/social/unlink`,
  CHANGE_EMAIL: `${API_VERSION}/auth/change-email`,
  LOGOUT: `${API_VERSION}/auth/logout`,
  REFRESH: `${API_VERSION}/auth/refresh`,
  ME: `${API_VERSION}/auth/me`,
  CHANGE_PASSWORD: `${API_VERSION}/auth/change-password`,

  // App releases (OTA) — backend-brokered update check + short-lived SAS download
  APP_RELEASE_LATEST: slug => `${API_VERSION}/app-releases/latest?app=${slug}`,
  APP_RELEASE_DOWNLOAD: (slug, version) =>
    `${API_VERSION}/app-releases/${slug}/${encodeURIComponent(version)}/download`,

  // User preferences (user-scoped; the shared route serves any authenticated role)
  PREFERENCES: `${API_VERSION}/users/me/preferences`,

  // Notifications
  NOTIFICATIONS: `${API_VERSION}/notifications`,
  NOTIFICATIONS_READ_ALL: `${API_VERSION}/notifications/read-all`,
  NOTIFICATION_READ: id => `${API_VERSION}/notifications/${id}/read`,
  DEVICE_TOKENS: `${API_VERSION}/notifications/device-tokens`,
  DEVICE_TOKENS_REMOVE: `${API_VERSION}/notifications/device-tokens/remove`,

  // Doctor directory / profile
  DOCTORS: `${API_VERSION}/doctors`,
  DOCTOR_DETAIL: id => `${API_VERSION}/doctors/${id}`,

  // Availability / schedule (backend: doctor_availability.py)
  AVAILABILITY: `${API_VERSION}/doctor-availability`,
  AVAILABILITY_ITEM: id => `${API_VERSION}/doctor-availability/${id}`,
  SLOT_TIMINGS: `${API_VERSION}/slot-timings`,

  // Self-service leave requests
  LEAVE_REQUEST: `${API_VERSION}/doctor-leaves`,
  LEAVE_HISTORY: `${API_VERSION}/doctor-leaves`,
  LEAVE_ITEM: id => `${API_VERSION}/doctor-leaves/${id}`,
  LEAVE_CANCEL: id => `${API_VERSION}/doctor-leaves/${id}`,

  // Appointments (backend: appointments.py)
  // NOTE: backend currently exposes booking from the patient side; a
  // doctor-scoped list endpoint is a likely follow-up (TODO).
  APPOINTMENTS: `${API_VERSION}/appointments`,
  APPOINTMENTS_DOCTOR: `${API_VERSION}/appointments/doctor`,
  APPOINTMENT_DETAIL: id => `${API_VERSION}/appointments/${id}`,

  // Clinical records (doctor notes / diagnosis / prescription) for an appointment
  CONSULTATION_RECORDS: id => `${API_VERSION}/appointments/${id}/records`,
  CONSULTATION_RECORD: (id, recordId) => `${API_VERSION}/appointments/${id}/records/${recordId}`,

  // Patients — a doctor's patients view (TODO: backend endpoint).
  PATIENTS: `${API_VERSION}/patients`,
  PATIENT_DETAIL: id => `${API_VERSION}/patients/${id}`,
  // A patient's face-scan history (backend: face_glow history is user-scoped).
  PATIENT_SCANS: id => `${API_VERSION}/patients/${id}/face-glow/history`,

  // Content Pages (terms, privacy, faq — admin-configured)
  ROLES: `${API_VERSION}/roles`,
  CONTENT_PAGES: `${API_VERSION}/content-pages`,
  SUPPORT_FAQS: `${API_VERSION}/support-faqs`,

  // User details
  USER_DETAIL: id => `${API_VERSION}/users/${id}`,
};
