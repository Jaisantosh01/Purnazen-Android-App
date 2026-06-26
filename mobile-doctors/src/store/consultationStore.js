import { create } from 'zustand';
import consultationService from '../services/consultationService';

// Maps the backend record_type to the per-section array the UI groups by.
const TYPE_TO_KEY = {
  doctor_note: 'doctorNotes',
  diagnosis: 'diagnoses',
  prescription: 'prescriptions',
};

/**
 * Consultation records store — backed by the API
 * (/appointments/:id/records). Records are scoped to the appointment passed to
 * `hydrate(appointmentId)`; add/update/delete persist to the backend and then
 * mirror the result into the in-memory section arrays the UI reads.
 *
 * The per-type action names (addDoctorNote, deleteDiagnosis, …) are kept so the
 * editor screens and ConsultationNotes screen need no behavioural change beyond
 * awaiting the (now async) calls.
 */
const useConsultationStore = create((set, get) => ({
  appointmentId: null,
  doctorNotes: [],
  diagnoses: [],
  prescriptions: [],
  loading: false,

  /** Load all records for an appointment into the section arrays. */
  hydrate: async (appointmentId) => {
    set({ appointmentId, loading: true, doctorNotes: [], diagnoses: [], prescriptions: [] });
    try {
      const records = await consultationService.list(appointmentId);
      const buckets = { doctorNotes: [], diagnoses: [], prescriptions: [] };
      for (const r of records) {
        const key = TYPE_TO_KEY[r.recordType];
        if (key) buckets[key].push(r);
      }
      set({ ...buckets, loading: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  _add: async (recordType, content) => {
    const { appointmentId } = get();
    const rec = await consultationService.create(appointmentId, recordType, content);
    const key = TYPE_TO_KEY[recordType];
    if (rec) set((s) => ({ [key]: [...s[key], rec] }));
    return rec;
  },

  _update: async (recordType, id, content) => {
    const { appointmentId } = get();
    const rec = await consultationService.update(appointmentId, id, content);
    const key = TYPE_TO_KEY[recordType];
    if (rec) set((s) => ({ [key]: s[key].map((r) => (r.id === id ? rec : r)) }));
    return rec;
  },

  _delete: async (recordType, id) => {
    const { appointmentId } = get();
    await consultationService.remove(appointmentId, id);
    const key = TYPE_TO_KEY[recordType];
    set((s) => ({ [key]: s[key].filter((r) => r.id !== id) }));
  },

  // ── Doctor Notes ────────────────────────────────────────────────────────────
  addDoctorNote: (content) => get()._add('doctor_note', content),
  updateDoctorNote: (id, content) => get()._update('doctor_note', id, content),
  deleteDoctorNote: (id) => get()._delete('doctor_note', id),

  // ── Diagnoses ───────────────────────────────────────────────────────────────
  addDiagnosis: (content) => get()._add('diagnosis', content),
  updateDiagnosis: (id, content) => get()._update('diagnosis', id, content),
  deleteDiagnosis: (id) => get()._delete('diagnosis', id),

  // ── Prescriptions ───────────────────────────────────────────────────────────
  addPrescription: (content) => get()._add('prescription', content),
  updatePrescription: (id, content) => get()._update('prescription', id, content),
  deletePrescription: (id) => get()._delete('prescription', id),

  // ── Reset ───────────────────────────────────────────────────────────────────
  reset: () => set({ appointmentId: null, doctorNotes: [], diagnoses: [], prescriptions: [] }),
}));

export default useConsultationStore;
