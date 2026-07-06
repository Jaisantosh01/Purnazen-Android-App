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

  // User details
  USER_DETAIL: id => `${API_VERSION}/users/${id}`,
};
