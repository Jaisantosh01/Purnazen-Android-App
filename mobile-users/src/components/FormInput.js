import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
// @ts-ignore
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import useTheme from '../hooks/useTheme';

/**
 * FormInput — the app-wide standard for labelled text inputs.
 *
 * Matches the login-screen input aesthetic (rounded surface, leading icon,
 * focus highlight) so every form in the app feels the same. Fully themed via
 * useTheme(), so it follows dark mode automatically.
 *
 * Props:
 *   label          (string)  field label shown above the input
 *   icon           (string)  leading MaterialCommunityIcons name
 *   error          (string)  inline error message shown below
 *   secureTextEntry          renders a show/hide eye toggle
 *   containerStyle           style override for the outer wrapper
 *   ...rest                  forwarded to the underlying TextInput
 */
export default function FormInput({
  label,
  icon,
  error,
  secureTextEntry,
  containerStyle,
  onFocus,
  onBlur,
  ...rest
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [focused, setFocused] = useState(false);
  const [reveal, setReveal] = useState(false);

  return (
    <View style={[styles.wrap, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.field,
          focused && styles.fieldFocused,
          !!error && styles.fieldError,
        ]}
      >
        {icon ? (
          <MCIcon
            name={icon}
            size={20}
            color={focused ? colors.primary : colors.textMuted}
            style={styles.icon}
          />
        ) : null}
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secureTextEntry && !reveal}
          onFocus={e => { setFocused(true); onFocus?.(e); }}
          onBlur={e => { setFocused(false); onBlur?.(e); }}
          {...rest}
        />
        {secureTextEntry ? (
          <TouchableOpacity
            onPress={() => setReveal(r => !r)}
            style={styles.eye}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MCIcon
              name={reveal ? 'eye-outline' : 'eye-off-outline'}
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const makeStyles = colors => StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: {
    fontSize: 12.5,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 7,
    marginLeft: 2,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
  },
  fieldFocused: { borderColor: colors.primary, backgroundColor: colors.primaryFaint },
  fieldError: { borderColor: colors.danger },
  icon: { marginRight: 10 },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    padding: 0,
    includeFontPadding: false,
  },
  eye: { padding: 4 },
  error: { fontSize: 12, color: colors.danger, marginTop: 6, marginLeft: 2 },
});
