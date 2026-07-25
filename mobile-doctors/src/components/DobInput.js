import React, { useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import useTheme from '../hooks/useTheme';

const pad2 = v => (String(v).length === 1 ? `0${v}` : String(v));

// Split an ISO date ("YYYY-MM-DD") into { dd, mm, yyyy } parts for the inputs.
export const isoToParts = iso => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return { dd: '', mm: '', yyyy: '' };
  return { dd: m[3], mm: m[2], yyyy: m[1] };
};

// Validate { dd, mm, yyyy }. All-empty is treated as valid with no date, since
// date of birth is optional; anything partially filled must be a real past date.
export const validateDobParts = ({ dd = '', mm = '', yyyy = '' } = {}) => {
  if (!dd && !mm && !yyyy) return { ok: true, iso: undefined };
  const d = parseInt(dd, 10);
  const mo = parseInt(mm, 10);
  const y = parseInt(yyyy, 10);
  const now = new Date();
  if (!d || !mo || !y || String(yyyy).length !== 4) return { ok: false };
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return { ok: false };
  if (y < 1900 || y > now.getFullYear()) return { ok: false };
  const dob = new Date(y, mo - 1, d);
  if (dob > now) return { ok: false };
  return { ok: true, iso: `${y}-${pad2(mm)}-${pad2(dd)}` };
};

/**
 * One DD / MM / YYYY box. The hint is drawn as a centred overlay instead of the
 * TextInput's own `placeholder`: on Android a centred empty field with a native
 * placeholder parks the caret after the hint (at the right edge). The box is a
 * fixed height and the input fills it, so the hint overlay and the typed value
 * share the exact same centre — the hint no longer sits off from the value.
 */
const Box = ({ styles, hint, boxStyle, inputRef, value, onChange, maxLength }) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.box, boxStyle, focused && styles.boxFocused]}>
      {!value && !focused ? (
        <View style={styles.placeholderWrap} pointerEvents="none">
          <Text style={styles.placeholder}>{hint}</Text>
        </View>
      ) : null}
      <TextInput
        ref={inputRef}
        style={styles.input}
        value={value}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        maxLength={maxLength}
        textAlign="center"
      />
    </View>
  );
};

/**
 * Controlled date-of-birth entry. `value` is { dd, mm, yyyy } strings and
 * `onChange` receives the next object. Use validateDobParts(value) to check it
 * and isoToParts(iso) to seed it from a stored date.
 */
export default function DobInput({ value, onChange }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { dd = '', mm = '', yyyy = '' } = value || {};

  const mmRef = useRef(null);
  const yyyyRef = useRef(null);

  const set = patch => onChange({ dd, mm, yyyy, ...patch });

  return (
    <View style={styles.row}>
      <Box
        styles={styles}
        hint="DD"
        value={dd}
        maxLength={2}
        onChange={t => {
          const v = t.replace(/[^0-9]/g, '').slice(0, 2);
          set({ dd: v });
          if (v.length === 2) mmRef.current?.focus();
        }}
      />
      <Text style={styles.sep}>/</Text>
      <Box
        styles={styles}
        hint="MM"
        inputRef={mmRef}
        value={mm}
        maxLength={2}
        onChange={t => {
          const v = t.replace(/[^0-9]/g, '').slice(0, 2);
          set({ mm: v });
          if (v.length === 2) yyyyRef.current?.focus();
        }}
      />
      <Text style={styles.sep}>/</Text>
      <Box
        styles={styles}
        hint="YYYY"
        boxStyle={styles.year}
        inputRef={yyyyRef}
        value={yyyy}
        maxLength={4}
        onChange={t => set({ yyyy: t.replace(/[^0-9]/g, '').slice(0, 4) })}
      />
    </View>
  );
}

const makeStyles = colors => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  box: {
    flex: 1,
    height: 52,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  boxFocused: { borderColor: colors.primary },
  year: { flex: 1.4 },
  // Input fills the fixed-height box and centres both ways, so it lines up
  // pixel-for-pixel with the placeholder overlay.
  input: {
    width: '100%',
    height: '100%',
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
    textAlignVertical: 'center',
    padding: 0,
    includeFontPadding: false,
  },
  placeholderWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
    includeFontPadding: false,
  },
  sep: { fontSize: 18, color: colors.textMuted, fontWeight: '700' },
});
