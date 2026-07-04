import { create } from 'zustand';

/**
 * App-wide themed alert / confirm dialog.
 *
 * A drop-in replacement for React Native's `Alert.alert` whose look follows the
 * app theme (see AppAlertHost). The signature mirrors the native API so call
 * sites migrate almost mechanically:
 *
 *   showAlert('Title', 'Message')
 *   showAlert('Logout', 'Are you sure?', [
 *     { text: 'Cancel', style: 'cancel' },
 *     { text: 'Logout', style: 'destructive', onPress: doLogout },
 *   ])
 *
 * Buttons: { text, onPress?, style?: 'default' | 'cancel' | 'destructive' }.
 * When omitted, a single "OK" button is shown.
 */
const useAlertStore = create(set => ({
  visible: false,
  title: '',
  message: '',
  buttons: [],
  cancelable: true,
  hide: () => set({ visible: false }),
}));

export const showAlert = (title, message, buttons, options) => {
  const list =
    Array.isArray(buttons) && buttons.length
      ? buttons
      : [{ text: 'OK', style: 'default' }];
  useAlertStore.getState();
  useAlertStore.setState({
    visible: true,
    title: title || '',
    message: message || '',
    buttons: list,
    cancelable: options?.cancelable !== false,
  });
};

/** Convenience: a yes/no confirm. `onConfirm` runs on the primary action. */
export const showConfirm = (
  title,
  message,
  onConfirm,
  { confirmLabel = 'Confirm', cancelLabel = 'Cancel', destructive = false } = {},
) =>
  showAlert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
  ]);

export default useAlertStore;
