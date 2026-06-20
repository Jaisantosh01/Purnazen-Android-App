import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';

/**
 * Simple top app bar used across the doctor screens. Shows a title, an optional
 * back button, and an optional right-side action.
 */
const ScreenHeader = ({ title, subtitle, onBack, right }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 12) + 4 }]}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />
      <View style={styles.row}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <MCIcon name="arrow-left" size={24} color={COLORS.white} />
          </TouchableOpacity>
        ) : (
          <View style={styles.spacer} />
        )}
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.right}>{right || <View style={styles.spacer} />}</View>
      </View>
    </View>
  );
};

export default ScreenHeader;

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.primary,
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  titleWrap: { flex: 1, marginHorizontal: SPACING.md },
  title: { fontSize: 19, fontWeight: '800', color: COLORS.white },
  subtitle: { fontSize: 12.5, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  right: { minWidth: 24, alignItems: 'flex-end' },
  spacer: { width: 24, height: 24 },
});
