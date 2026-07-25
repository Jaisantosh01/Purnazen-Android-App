import React from 'react';
import { Modal, View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';
import useAlertStore from '../utils/alert';

/**
 * AppAlertHost — single globally-mounted renderer for showAlert()/showConfirm().
 *
 * Replaces the dated native `Alert.alert` popup with a themed, rounded card.
 * Mounted once in App.tsx; driven entirely by the alert store so any module can
 * trigger it imperatively without prop drilling.
 */
export default function AppAlertHost() {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { visible, title, message, buttons, cancelable, hide } = useAlertStore();

  const close = () => hide();
  const onBackdrop = () => {
    if (cancelable) close();
  };
  const press = btn => {
    close();
    // Defer so the modal dismiss animation isn't janked by heavy onPress work
    // (navigation resets, network calls) firing on the same frame.
    setTimeout(() => btn.onPress?.(), 10);
  };

  // Derive an icon + accent from the button set: a destructive action implies a
  // warning dialog; otherwise a neutral info badge.
  const hasDestructive = buttons.some(b => b.style === 'destructive');
  const accent = hasDestructive ? colors.danger : colors.primary;
  const icon = hasDestructive ? 'alert-outline' : 'information-outline';

  // Stack buttons vertically when there are more than two (or any label is long).
  const stacked = buttons.length > 2;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onBackdrop}>
      <Pressable style={styles.overlay} onPress={onBackdrop}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={[styles.iconBadge, { backgroundColor: accent + '1A' }]}>
            <MCIcon name={icon} size={26} color={accent} />
          </View>

          {title ? <Text style={styles.title}>{title}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={[styles.actions, stacked && styles.actionsStacked]}>
            {buttons.map((btn, i) => {
              const isCancel = btn.style === 'cancel';
              const isDestructive = btn.style === 'destructive';
              return (
                <TouchableOpacity
                  key={`${btn.text}-${i}`}
                  style={[
                    styles.btn,
                    stacked && styles.btnStacked,
                    isCancel
                      ? styles.btnCancel
                      : { backgroundColor: isDestructive ? colors.danger : colors.primary },
                  ]}
                  onPress={() => press(btn)}
                  activeOpacity={0.85}
                >
                  <Text style={isCancel ? styles.btnCancelText : styles.btnPrimaryText}>{btn.text}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const makeStyles = colors =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      paddingHorizontal: 28,
    },
    card: {
      backgroundColor: colors.modalSurface,
      borderRadius: 22,
      padding: 22,
      borderWidth: 1,
      borderColor: colors.modalBorder,
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 24,
      elevation: 12,
    },
    iconBadge: {
      alignSelf: 'center',
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    title: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
    message: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 20,
    },
    actions: { flexDirection: 'row', gap: 10, marginTop: 22 },
    actionsStacked: { flexDirection: 'column-reverse' },
    btn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    },
    btnStacked: { flex: undefined, width: '100%' },
    btnCancel: { backgroundColor: colors.surfaceMuted },
    btnCancelText: { fontSize: 14.5, fontWeight: '700', color: colors.textSecondary },
    btnPrimaryText: { fontSize: 14.5, fontWeight: '800', color: colors.white },
  });
