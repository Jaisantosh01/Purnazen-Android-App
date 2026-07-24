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
  useWindowDimensions,
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
 *   compact            (bool)    tight, left-aligned header (icon beside the
 *                                title instead of a big centered badge) — for
 *                                pickers, where the list needs the room
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
  compact = false,
}) {
  const { colors } = useTheme();
  const { height: windowH } = useWindowDimensions();
  const styles = makeStyles(colors);
  const accent = destructive ? colors.danger : colors.primary;

  // Cap in pixels, not '%': the card's parent (the KeyboardAvoidingView) is
  // content-sized, so a percentage max-height has nothing to resolve against
  // and Yoga drops it — the card then grew past the screen and pushed its own
  // action buttons off the bottom, which read as the list running under them.
  const maxHeight = Math.round(windowH * (compact ? 0.88 : 0.85));

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
          <Pressable
            style={[styles.card, compact && styles.cardCompact, { maxHeight }]}
            onPress={() => {}}
          >
            {/* Header scrolls WITH the body: when content is long the icon/title
                glide away instead of staying pinned and squeezing the list into
                a sliver. Short dialogs are unaffected (ScrollView is
                content-sized via flexGrow:0). Only the action buttons stay put. */}
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {compact ? (
                (icon || title || subtitle) ? (
                  <View style={styles.compactHeader}>
                    {icon ? (
                      <View style={[styles.iconBadgeCompact, { backgroundColor: iconBg || colors.primaryLight }]}>
                        <MCIcon name={icon} size={18} color={iconColor || accent} />
                      </View>
                    ) : null}
                    <View style={styles.compactHeaderText}>
                      {title ? <Text style={styles.titleCompact}>{title}</Text> : null}
                      {subtitle ? <Text style={styles.subtitleCompact}>{subtitle}</Text> : null}
                    </View>
                  </View>
                ) : null
              ) : (
                <>
                  {icon ? (
                    <View style={[styles.iconBadge, { backgroundColor: iconBg || colors.primaryLight }]}>
                      <MCIcon name={icon} size={26} color={iconColor || accent} />
                    </View>
                  ) : null}

                  {title ? <Text style={styles.title}>{title}</Text> : null}
                  {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                </>
              )}

              {topSlot ? <View style={compact ? styles.topSlotCompact : styles.topSlot}>{topSlot}</View> : null}

              {children ? <View style={compact ? styles.bodyCompact : styles.body}>{children}</View> : null}
            </ScrollView>

            <View style={[styles.actions, compact && styles.actionsCompact]}>
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
    paddingVertical: 24,
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
    overflow: 'hidden',
  },
  // Pickers trade the roomy header for list space: less padding all round.
  cardCompact: { borderRadius: 20, padding: 16 },
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

  compactHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  compactHeaderText: { flex: 1 },
  iconBadgeCompact: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCompact: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  subtitleCompact: { fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 16 },

  // flexGrow:0 keeps short dialogs content-sized; flexShrink:1 lets the scroll
  // area give way to the pinned action buttons when the card hits maxHeight.
  scroll: { flexGrow: 0, flexShrink: 1 },
  // Breathing room under the last row so it doesn't sit flush against the
  // pinned action buttons when the list is scrolled to the end.
  scrollContent: { paddingBottom: 4 },
  topSlot: { marginTop: 16 },
  topSlotCompact: { marginTop: 12 },
  body: { marginTop: 18 },
  bodyCompact: { marginTop: 10 },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  actionsCompact: { marginTop: 12 },
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
