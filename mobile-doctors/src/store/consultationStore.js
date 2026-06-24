import { create } from 'zustand';

// Simple unique ID generator
const uid = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 6);

const useConsultationStore = create((set) => ({
  doctorNotes: [],
  diagnoses: [],
  prescriptions: [],

  // ── Doctor Notes ────────────────────────────────────────────────────────────
  addDoctorNote: (content) =>
    set((s) => ({
      doctorNotes: [...s.doctorNotes, { id: uid(), content, createdAt: new Date().toISOString() }],
    })),
  updateDoctorNote: (id, content) =>
    set((s) => ({
      doctorNotes: s.doctorNotes.map((n) => (n.id === id ? { ...n, content } : n)),
    })),
  deleteDoctorNote: (id) =>
    set((s) => ({ doctorNotes: s.doctorNotes.filter((n) => n.id !== id) })),

  // ── Diagnoses ───────────────────────────────────────────────────────────────
  addDiagnosis: (content) =>
    set((s) => ({
      diagnoses: [...s.diagnoses, { id: uid(), content, createdAt: new Date().toISOString() }],
    })),
  updateDiagnosis: (id, content) =>
    set((s) => ({
      diagnoses: s.diagnoses.map((n) => (n.id === id ? { ...n, content } : n)),
    })),
  deleteDiagnosis: (id) =>
    set((s) => ({ diagnoses: s.diagnoses.filter((n) => n.id !== id) })),

  // ── Prescriptions ───────────────────────────────────────────────────────────
  addPrescription: (content) =>
    set((s) => ({
      prescriptions: [...s.prescriptions, { id: uid(), content, createdAt: new Date().toISOString() }],
    })),
  updatePrescription: (id, content) =>
    set((s) => ({
      prescriptions: s.prescriptions.map((n) => (n.id === id ? { ...n, content } : n)),
    })),
  deletePrescription: (id) =>
    set((s) => ({ prescriptions: s.prescriptions.filter((n) => n.id !== id) })),

  // ── Reset ───────────────────────────────────────────────────────────────────
  reset: () => set({ doctorNotes: [], diagnoses: [], prescriptions: [] }),
}));

export default useConsultationStore;
