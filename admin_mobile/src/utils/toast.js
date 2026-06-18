import { create } from 'zustand';

const useToastStore = create((set) => ({
  message: '',
  type: 'success',
  visible: false,
  show: (message, type = 'success') => set({ message, type, visible: true }),
  hide: () => set({ visible: false }),
}));

export const showToast = (message, type = 'success') =>
  useToastStore.getState().show(message, type);

export const showError   = (msg) => showToast(msg, 'error');
export const showSuccess = (msg) => showToast(msg, 'success');
export const showInfo    = (msg) => showToast(msg, 'info');
export const showWarning = (msg) => showToast(msg, 'warning');

export default useToastStore;
