import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import useTheme from '../hooks/useTheme';

/**
 * Avatar — a profile photo with an initial fallback.
 *
 * This file is kept byte-identical across mobile-users, mobile-doctors and
 * mobile-admin (per-app branding comes from the theme tokens). If you change it
 * in one app, copy it to the other two.
 *
 * `uri` is the `avatar_url` / `avatar` / `userAvatar` / `doctorAvatar` the
 * backend sends. Those are short-lived Azure SAS URLs, so two things matter:
 *   - a load failure must fall back to the initial rather than leave a hole, and
 *   - the failure flag has to reset when the URL changes, otherwise a refreshed
 *     token would keep rendering the fallback for the rest of the session.
 */

/** First letter of a name, ignoring an honorific ("Dr Sarah" → "S"). */
export function avatarInitial(name) {
  const cleaned = String(name || '')
    .replace(/^\s*(dr|mr|mrs|ms)\.?\s+/i, '')
    .trim();
  return (cleaned.charAt(0) || '?').toUpperCase();
}

export default function Avatar({
  uri,
  name,
  // Override the fallback text — screens that already show two-letter initials
  // (the patient list) pass their own rather than change how they read.
  initials,
  size = 48,
  style,
  backgroundColor,
  textColor,
  borderWidth = 0,
  borderColor,
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [failed, setFailed] = useState(false);

  // A new URL (e.g. a re-signed SAS, or a freshly uploaded photo) gets a fresh
  // attempt — otherwise one expired token disables the image permanently.
  useEffect(() => { setFailed(false); }, [uri]);

  const box = [
    styles.circle,
    {
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth,
      borderColor: borderColor || colors.border,
    },
    backgroundColor ? { backgroundColor } : null,
    style,
  ];

  if (uri && !failed) {
    return (
      <View style={box}>
        <Image
          source={{ uri }}
          style={styles.image}
          onError={() => setFailed(true)}
          resizeMode="cover"
        />
      </View>
    );
  }

  const fallback = initials || avatarInitial(name);

  return (
    <View style={box}>
      <Text
        style={[
          styles.letter,
          // Two-letter fallbacks need to be a shade smaller to sit in the circle.
          { fontSize: Math.round(size * (fallback.length > 1 ? 0.34 : 0.42)) },
          textColor ? { color: textColor } : null,
        ]}
        allowFontScaling={false}
      >
        {fallback}
      </Text>
    </View>
  );
}

const makeStyles = colors => StyleSheet.create({
  circle: {
    backgroundColor: colors.primaryFaint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  letter: { fontWeight: '800', color: colors.primary },
});
