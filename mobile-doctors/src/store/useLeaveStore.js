import { create } from 'zustand';
import leaveService from '../services/leaveService';

export const useLeaveStore = create((set, get) => ({
  leaves: [],
  loading: false,
  error: null,

  fetchLeaves: async () => {
    set({ loading: true, error: null });
    try {
      const data = await leaveService.list();
      set({ leaves: data, loading: false });
    } catch (err) {
      set({ error: err.message || 'Failed to fetch leaves', loading: false });
    }
  },

  addLeave: async (leaveData) => {
    set({ loading: true, error: null });
    try {
      const newLeave = await leaveService.create(leaveData);
      if (newLeave && typeof newLeave === 'object' && newLeave.id) {
        set((state) => ({
          leaves: [newLeave, ...(Array.isArray(state.leaves) ? state.leaves : [])],
          loading: false,
        }));
      } else {
        // Leave was created but we couldn't parse the response — just refetch
        set({ loading: false });
      }
      return newLeave;
    } catch (err) {
      set({ error: err.message || 'Failed to create leave', loading: false });
      throw err;
    }
  },

  cancelLeave: async (id) => {
    set({ loading: true, error: null });
    try {
      await leaveService.cancel(id);
      // DELETE returns no body — update the local leave status optimistically
      set((state) => ({
        leaves: (Array.isArray(state.leaves) ? state.leaves : []).map((l) =>
          l.id === id ? { ...l, status: 'cancelled' } : l
        ),
        loading: false,
      }));
    } catch (err) {
      set({ error: err.message || 'Failed to cancel leave', loading: false });
      throw err;
    }
  },
}));
