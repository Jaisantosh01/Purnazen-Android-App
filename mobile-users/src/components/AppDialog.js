import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Pressable,
  ScrollView,
} from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';

/**
 * AppDialog — the app-wide standard for modal dialogs (edit forms, confirms).
 *
 * Replaces the ad-hoc per-screen Modal markup with one themed, keyboard-aware,
 * backdrop-dismissable card. A centered icon badge + title gives every dialog a
 * consistent, premium look; the body slot holds arbitrary content (usually a
 * stack of <FormInput/>).
 *
 * Props:
 *   visible            (bool)    controls visibility
 *   onClose            (fn)      called on cancel / backdrop tap / hardware back
 *   icon               (string)  MaterialCommunityIcons name for the header badge
 *   iconColor/iconBg   (string)  override the badge tint
 *   title / subtitle   (string)  header text
 *   children           (node)    body content
 *   confirmLabel       (string)  primary button text (default "Save")
 *   cancelLabel        (string)  secondary button text (default "Cancel")
 *   onConfirm          (fn)      primary action; omit to render a single-button dialog
 *   confirmLoading     (bool)    shows a spinner on the primary button
 *   confirmDisabled    (bool)    disables the primary button
 *   destructive        (bool)    renders the primary button in the danger color
 *   dismissOnBackdrop  (bool)    tap-outside-to-close (default true)
 */
export default function AppDialog({
  visible,
  onClose,
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  children,
  topSlot,
  confirmLabel = 'Save',
  cancelLabel = 'Cancel',
  onConfirm,
  confirmLoading = false,
  confirmDisabled = false,
  destructive = false,
  dismissOnBackdrop = true,
  showCancel = true,
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const accent = destructive ? colors.danger : colors.primary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={dismissOnBackdrop ? onClose : undefined}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kav}
          pointerEvents="box-none"
        >
          {/* Inner Pressable swallows taps so they don't bubble to the backdrop */}
          <Pressable style={styles.card} onPress={() => {}}>
            {icon ? (
              <View style={[styles.iconBadge, { backgroundColor: iconBg || colors.primaryLight }]}>
                <MCIcon name={icon} size={26} color={iconColor || accent} />
              </View>
            ) : null}

            {title ? <Text style={styles.title}>{title}</Text> : null}
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

            {topSlot ? <View style={styles.topSlot}>{topSlot}</View> : null}

            {children ? (
              <ScrollView
                style={styles.body}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {children}
              </ScrollView>
            ) : null}

            <View style={styles.actions}>
              {onClose && showCancel ? (
                <TouchableOpacity
                  style={[styles.btn, styles.btnCancel]}
                  onPress={onClose}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnCancelText}>{cancelLabel}</Text>
                </TouchableOpacity>
              ) : null}
              {onConfirm ? (
                <TouchableOpacity
                  style={[
                    styles.btn,
                    styles.btnConfirm,
                    { backgroundColor: accent },
                    confirmDisabled && styles.btnDisabled,
                  ]}
                  onPress={onConfirm}
                  disabled={confirmLoading || confirmDisabled}
                  activeOpacity={0.85}
                >
                  {confirmLoading ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.btnConfirmText}>{confirmLabel}</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const makeStyles = colors => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  kav: { width: '100%' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
    maxHeight: '92%',
    overflow: 'hidden',
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
  title: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13.5,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  topSlot: { marginTop: 16 },
  body: { marginTop: 18 },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnCancel: { backgroundColor: colors.surfaceMuted },
  btnCancelText: { fontSize: 14.5, fontWeight: '700', color: colors.textSecondary },
  btnConfirm: {},
  btnConfirmText: { fontSize: 14.5, fontWeight: '800', color: colors.white },
  btnDisabled: { opacity: 0.6 },
});
