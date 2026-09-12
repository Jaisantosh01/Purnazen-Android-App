/**
 * The non-medical-device statement, on every surface that renders a health
 * metric.
 *
 * Google Play's Health apps policy requires an app that presents health-related
 * information without being a registered medical device to say so plainly, and
 * a statement buried behind a tap does not count — so this is persistent and
 * non-dismissible by design. There is deliberately no `onDismiss`, no "don't
 * show again", and no per-screen configuration: one component, one string, five
 * imports. If the wording ever has to be editable by legal it already has a
 * home in `content_pages`; it does not need one before then.
 *
 * `variant="overlay"` is the same text in light-on-dark, for the camera
 * screens where it sits over the preview.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MEDICAL_DISCLAIMER } from '../constants/strings';
import useTheme from '../hooks/useTheme';

export default function MedicalDisclaimer({ variant = 'default', style }) {
  const { colors } = useTheme();
  const overlay = variant === 'overlay';
  return (
    <View style={[styles.wrap, overlay && styles.wrapOverlay, style]}>
      <Text
        style={[
          styles.text,
          overlay ? styles.textOverlay : { color: colors.textMuted },
        ]}
        accessibilityRole="text">
        {MEDICAL_DISCLAIMER}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 4 },
  wrapOverlay: {
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  text: { fontSize: 11.5, lineHeight: 17, textAlign: 'center' },
  textOverlay: { color: 'rgba(255,255,255,0.82)', fontSize: 11, lineHeight: 16 },
});
